// In-process TTL cache — simple Map-backed store with per-key expiry.
// P2 swaps this for Redis; the interface (get/set/del) stays the same.

type Entry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
    private store = new Map<string, Entry<T>>();

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    del(key: string): void {
        this.store.delete(key);
    }
}

interface CachedUser {
    id: string;
    role: string;
    tokenVersion: number;
}

export const userCache = new TtlCache<CachedUser>();
