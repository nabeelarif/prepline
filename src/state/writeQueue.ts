import { describeError, RepositoryError } from '../repositories/errors';
import type { SyncOp } from './syncOps';

export interface SyncState {
  /** idle: nothing saved yet this session. saved: the backend confirmed everything. */
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Writes not yet confirmed, including the one in flight. */
  pending: number;
  error: string | null;
  /** False when the server rejected a write for good: retrying cannot help, only discarding. */
  retryable: boolean;
}

export const IDLE_SYNC: SyncState = { status: 'idle', pending: 0, error: null, retryable: true };

/** A write the server refused because of its content or a clash; sending it again fails again. */
function isPermanent(e: unknown): boolean {
  return e instanceof RepositoryError && (e.code === 'validation' || e.code === 'conflict');
}

/**
 * Saves repository writes one at a time, in order, so an older save can never overwrite a
 * newer one. A failed write stops the queue and keeps everything after it; `retry()`
 * continues from the failed write. Nothing is dropped, so no edit is lost.
 */
export class WriteQueue {
  private ops: SyncOp[] = [];
  private current: SyncOp | null = null;
  private loop: Promise<void> | null = null;
  private failed = false;
  private paused = false;
  private generation = 0;
  private error: string | null = null;
  private retryable = true;
  private saved = false;

  constructor(private readonly onState: (s: SyncState) => void) {}

  enqueue(ops: SyncOp[]) {
    for (const op of ops) {
      if (op.key) {
        // A later whole-order write replaces an earlier waiting one for the same list.
        // The failed op at the head stays: it is what retry or discard refers to.
        const i = this.ops.findIndex(
          (o, n) => o.key === op.key && o !== this.current && !(n === 0 && this.failed),
        );
        if (i >= 0) {
          const [old] = this.ops.splice(i, 1);
          if (old!.after) {
            const first = old!.after;
            const second = op.after;
            op.after = () => {
              first();
              second?.();
            };
          }
        }
      }
      this.ops.push(op);
    }
    this.start();
  }

  /** Runs the failed write again, then the rest. */
  retry() {
    if (!this.failed || !this.retryable) return;
    this.failed = false;
    this.error = null;
    this.start();
  }

  /** Resolves when the write in flight (if any) has finished. */
  settled(): Promise<void> {
    return this.loop ?? Promise.resolve();
  }

  /** Forgets everything waiting (user switch or sign-out). */
  clear() {
    this.generation++;
    this.ops = [];
    // The old drain loop exits on its own once it sees the new generation. Detach it so
    // writes queued from now on start a loop of their own.
    this.loop = null;
    this.current = null;
    this.failed = false;
    this.error = null;
    this.retryable = true;
    this.saved = false;
    this.emit();
  }

  /**
   * Runs `fn` with nothing else being saved. If it succeeds, the writes that were waiting
   * are dropped (`fn` replaced the data they belonged to); if it fails, they stay queued.
   */
  async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    this.paused = true;
    try {
      await this.loop;
      const waiting = this.ops.length;
      const generation = this.generation;
      const result = await fn();
      if (generation === this.generation) {
        this.ops.splice(0, waiting);
        this.failed = false;
        this.error = null;
        this.retryable = true;
      }
      return result;
    } finally {
      this.paused = false;
      this.start();
      this.emit();
    }
  }

  private start() {
    if (this.loop || this.failed || this.paused || this.ops.length === 0) {
      this.emit();
      return;
    }
    const loop: Promise<void> = this.drain().finally(() => {
      // A cleared queue may already have started a newer loop; leave that one alone.
      if (this.loop === loop) this.loop = null;
      this.emit();
    });
    this.loop = loop;
  }

  private async drain() {
    const generation = this.generation;
    while (this.ops.length && !this.failed && !this.paused && generation === this.generation) {
      const op = this.ops[0]!;
      this.current = op;
      this.emit();
      try {
        await op.run();
      } catch (e) {
        if (generation !== this.generation) return;
        this.current = null;
        this.failed = true;
        this.retryable = !isPermanent(e);
        this.error = describeError(e);
        return;
      }
      if (generation !== this.generation) return;
      this.current = null;
      this.ops.shift();
      this.saved = true;
      try {
        op.after?.();
      } catch {
        // A faulty callback (a toast) must not stop saving or leave a rejected promise.
      }
    }
  }

  private emit() {
    const pending = this.ops.length;
    const status: SyncState['status'] = this.failed
      ? 'error'
      : pending > 0 || this.loop
        ? 'saving'
        : this.saved
          ? 'saved'
          : 'idle';
    this.onState({ status, pending, error: this.error, retryable: this.retryable });
  }
}
