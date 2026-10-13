import { Redis } from 'ioredis';

// Create a mock Redis implementation for testing environments
class MockRedis {
  private data: Map<string, any> = new Map();
  private expiry: Map<string, number> = new Map();

  private sweep(key: string) {
    const at = this.expiry.get(key);
    if (at !== undefined && at <= Date.now()) {
      this.data.delete(key);
      this.expiry.delete(key);
    }
  }

  async get(key: string) {
    this.sweep(key);
    return this.data.get(key);
  }

  async set(key: string, value: any) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    this.data.delete(key);
    this.expiry.delete(key);
    return 1;
  }

  async incr(key: string) {
    this.sweep(key);
    const next = Number(this.data.get(key) || 0) + 1;
    this.data.set(key, String(next));
    return next;
  }

  async pexpire(key: string, ms: number) {
    this.expiry.set(key, Date.now() + ms);
    return 1;
  }

  async pttl(key: string) {
    this.sweep(key);
    const at = this.expiry.get(key);
    if (at === undefined || !this.data.has(key)) {
      return -1;
    }
    return Math.max(0, at - Date.now());
  }

  async rpush(key: string, value: any) {
    this.data.set(key, [...(this.data.get(key) || []), value]);
    return this.data.get(key).length;
  }

  async lrange(key: string, start: number, end: number) {
    const list = this.data.get(key) || [];
    return list.slice(start, end === -1 ? undefined : end + 1);
  }

  async expire() {
    return 1;
  }

  // Add other Redis methods as needed for your tests
}

// Use real Redis if REDIS_URL is defined, otherwise use MockRedis
export const ioRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
    })
  : (new MockRedis() as unknown as Redis); // Type cast to Redis to maintain interface compatibility
