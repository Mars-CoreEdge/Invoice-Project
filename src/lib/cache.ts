interface CacheOptions {
  ttl: number;  // Time to live in milliseconds
  maxSize: number;  // Maximum number of items in cache
}

interface CacheItem<T> {
  value: T;
  timestamp: number;
}

export class Cache {
  private store: Map<string, CacheItem<any>>;
  private options: CacheOptions;

  constructor(options: CacheOptions) {
    this.store = new Map();
    this.options = options;
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > this.options.ttl) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  set<T>(key: string, value: T): void {
    // Remove oldest item if cache is full
    if (this.store.size >= this.options.maxSize) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Get all valid (non-expired) items
  getAll<T>(): T[] {
    const now = Date.now();
    const validItems: T[] = [];

    for (const [key, item] of this.store.entries()) {
      if (now - item.timestamp <= this.options.ttl) {
        validItems.push(item.value);
      } else {
        this.store.delete(key);
      }
    }

    return validItems;
  }
} 