import '@testing-library/jest-dom/vitest';

// Node 25+ ships its own localStorage global, which shadows jsdom's and throws
// unless Node is started with --localstorage-file. Use an in-memory one instead.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});
