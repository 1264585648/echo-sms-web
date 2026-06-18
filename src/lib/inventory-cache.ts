import { createHash } from 'crypto';

export type InventorySuccessBody = {
  success: true;
  inventory: unknown[];
};

type InventoryCacheEntry = {
  expiresAt: number;
  body: InventorySuccessBody;
};

export type InventoryCache = {
  get: (key: string, now?: number) => InventorySuccessBody | null;
  set: (key: string, body: InventorySuccessBody, ttlMs: number, now?: number) => void;
  size: () => number;
};

export const INVENTORY_CACHE_TTL_MS = 20 * 1000;
export const INVENTORY_CACHE_MAX_ENTRIES = 250;

export function isValidInventoryCountryId(countryId: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(countryId);
}

export function hashInventoryCacheValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function getInventoryCacheKey({
  countryId,
  apiKey,
  exchangeRateConfig,
  servicesConfig,
}: {
  countryId: string;
  apiKey: string;
  exchangeRateConfig: string;
  servicesConfig: string;
}): string {
  return [
    `country:${countryId}`,
    `api:${hashInventoryCacheValue(apiKey)}`,
    `exchange:${exchangeRateConfig}`,
    `services:${hashInventoryCacheValue(servicesConfig)}`,
  ].join('|');
}

export function createInventoryCache({
  maxEntries = INVENTORY_CACHE_MAX_ENTRIES,
}: {
  maxEntries?: number;
} = {}): InventoryCache {
  if (!Number.isFinite(maxEntries) || maxEntries < 1) {
    throw new RangeError('Inventory cache maxEntries must be at least 1.');
  }

  const store = new Map<string, InventoryCacheEntry>();

  function sweep(now: number) {
    for (const [key, entry] of store) {
      if (now >= entry.expiresAt) {
        store.delete(key);
      }
    }
  }

  function enforceLimit() {
    while (store.size > maxEntries) {
      const oldestKey = store.keys().next().value as string | undefined;
      if (!oldestKey) return;
      store.delete(oldestKey);
    }
  }

  return {
    get(key, now = Date.now()) {
      sweep(now);
      const cached = store.get(key);
      if (!cached) return null;

      store.delete(key);
      store.set(key, cached);
      return cached.body;
    },
    set(key, body, ttlMs, now = Date.now()) {
      if (!Number.isFinite(ttlMs) || ttlMs < 1) {
        throw new RangeError('Inventory cache ttlMs must be at least 1.');
      }

      sweep(now);
      store.delete(key);
      store.set(key, {
        expiresAt: now + ttlMs,
        body,
      });
      enforceLimit();
    },
    size() {
      return store.size;
    },
  };
}
