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
