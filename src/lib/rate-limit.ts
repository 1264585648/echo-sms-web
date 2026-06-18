type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = Map<string, RateLimitBucket>;

export type RateLimitOptions = {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
  store?: RateLimitStore;
  maxEntries?: number;
  sweepIntervalMs?: number;
};

export type RateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
  count: number;
};

export const DEFAULT_RATE_LIMIT_MAX_ENTRIES = 10_000;
export const DEFAULT_RATE_LIMIT_SWEEP_INTERVAL_MS = 30_000;
export const defaultRateLimitStore: RateLimitStore = new Map();
const sweepState = new WeakMap<RateLimitStore, number>();

function sweepExpiredBuckets(store: RateLimitStore, now: number) {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) {
      store.delete(key);
    }
  }
}

function sweepExpiredBucketsIfDue(
  store: RateLimitStore,
  now: number,
  sweepIntervalMs: number,
) {
  const lastSweepAt = sweepState.get(store);
  if (
    lastSweepAt !== undefined &&
    now >= lastSweepAt &&
    now - lastSweepAt < sweepIntervalMs
  ) {
    return;
  }

  sweepExpiredBuckets(store, now);
  sweepState.set(store, now);
}

function enforceStoreLimit(store: RateLimitStore, maxEntries: number) {
  while (store.size > maxEntries) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) return;
    store.delete(oldestKey);
  }
}

export function checkRateLimit({
  key,
  max,
  windowMs,
  now = Date.now(),
  store = defaultRateLimitStore,
  maxEntries = DEFAULT_RATE_LIMIT_MAX_ENTRIES,
  sweepIntervalMs = DEFAULT_RATE_LIMIT_SWEEP_INTERVAL_MS,
}: RateLimitOptions): RateLimitResult {
  if (!key) {
    throw new RangeError('Rate limit key is required.');
  }
  if (!Number.isFinite(max) || max < 1) {
    throw new RangeError('Rate limit max must be at least 1.');
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new RangeError('Rate limit windowMs must be at least 1.');
  }
  if (!Number.isFinite(maxEntries) || maxEntries < 1) {
    throw new RangeError('Rate limit maxEntries must be at least 1.');
  }
  if (!Number.isFinite(sweepIntervalMs) || sweepIntervalMs < 0) {
    throw new RangeError('Rate limit sweepIntervalMs must be at least 0.');
  }

  sweepExpiredBucketsIfDue(store, now, sweepIntervalMs);

  const existing = store.get(key);
  const bucket =
    !existing || now >= existing.resetAt
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  bucket.count += 1;
  if (existing) store.delete(key);
  store.set(key, bucket);
  enforceStoreLimit(store, maxEntries);

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now) / 1000),
  );
  const remaining = Math.max(0, max - bucket.count);

  return {
    limited: bucket.count > max,
    limit: max,
    remaining,
    retryAfterSeconds,
    resetAt: bucket.resetAt,
    count: bucket.count,
  };
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  if (forwardedIp) return forwardedIp;

  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const connectingIp = headers.get('cf-connecting-ip')?.trim();
  return connectingIp || 'unknown';
}
