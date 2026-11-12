import { RepositoryError } from '../repositories/errors';
import { WriteQueue, type SyncState } from './writeQueue';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('WriteQueue', () => {
  it('runs writes queued after clear() even while an old write is still in flight', async () => {
    let state!: SyncState;
    const queue = new WriteQueue((s) => (state = s));
    let release!: () => void;
    const oldRan = vi.fn();
    queue.enqueue([
      {
        run: () => new Promise<void>((r) => (release = r)).then(oldRan),
      },
    ]);
    await tick();
    queue.clear();
    const ran = vi.fn(async () => {});
    queue.enqueue([{ run: ran }]);
    release();
    await vi.waitFor(() => expect(ran).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(state).toMatchObject({ status: 'saved', pending: 0 }));
  });

  it('keeps saving when a confirmation callback throws', async () => {
    let state!: SyncState;
    const queue = new WriteQueue((s) => (state = s));
    const second = vi.fn(async () => {});
    queue.enqueue([
      {
        run: async () => {},
        after: () => {
          throw new Error('toast failed');
        },
      },
      { run: second },
    ]);
    await vi.waitFor(() => expect(second).toHaveBeenCalled());
    await vi.waitFor(() => expect(state.status).toBe('saved'));
  });

  it('marks a rejected write as not retryable and ignores retry()', async () => {
    let state!: SyncState;
    const queue = new WriteQueue((s) => (state = s));
    const run = vi.fn(async () => {
      throw new RepositoryError('validation', 'bad');
    });
    queue.enqueue([{ run }]);
    await vi.waitFor(() => expect(state.status).toBe('error'));
    expect(state.retryable).toBe(false);
    queue.retry();
    await tick();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
