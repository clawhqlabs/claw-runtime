export interface MemoryStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  entries(): Array<[string, unknown]>;
}

export class InMemoryStore implements MemoryStore {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  entries(): Array<[string, unknown]> {
    return Array.from(this.store.entries());
  }
}

export type MemoryWriteHook = (key: string, value: unknown) => void | Promise<void>;

export class HookedMemoryStore implements MemoryStore {
  private readonly inner: MemoryStore;
  private readonly onWrite: MemoryWriteHook;

  constructor(inner: MemoryStore, onWrite: MemoryWriteHook) {
    this.inner = inner;
    this.onWrite = onWrite;
  }

  get<T>(key: string): T | undefined {
    return this.inner.get<T>(key);
  }

  set<T>(key: string, value: T): void {
    void this.onWrite(key, value);
    this.inner.set(key, value);
  }

  entries(): Array<[string, unknown]> {
    return this.inner.entries();
  }
}
