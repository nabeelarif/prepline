import { STORAGE_KEY } from '../domain/constants';
import type { StorageAdapter } from './StorageAdapter';

export function createLocalStorageAdapter(key: string = STORAGE_KEY): StorageAdapter {
  let available = true;
  return {
    get available() {
      return available;
    },
    load() {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        available = false;
        return null;
      }
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        available = true;
      } catch {
        available = false;
      }
      return available;
    },
  };
}
