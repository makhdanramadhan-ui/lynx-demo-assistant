import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./constants";
import type { RateLimitResult } from "./types";

export interface RateLimitState {
  count: number;
  resetAt: number;
}

export interface RateLimitStorage {
  get(key: string): Promise<RateLimitState | undefined>;
  put(key: string, value: RateLimitState): Promise<void>;
}

export async function checkRateLimit(
  storage: RateLimitStorage,
  key: string,
  now: number,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS,
): Promise<RateLimitResult> {
  const current = await storage.get(key);
  let state: RateLimitState;

  if (!current || now >= current.resetAt) {
    state = { count: 0, resetAt: now + windowMs };
  } else {
    state = current;
  }

  if (state.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  state.count += 1;
  await storage.put(key, state);
  return { allowed: true, retryAfterSec: 0 };
}

export class RateLimiterDO {
  private storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const now = Date.now();
    const storage: RateLimitStorage = {
      get: async (key) => (await this.storage.get<RateLimitState>(key)) ?? undefined,
      put: async (key, value) => {
        await this.storage.put(key, value);
      },
    };
    const result = await checkRateLimit(storage, "limit", now);
    return Response.json(result);
  }
}

export async function checkRateLimitForIp(
  limiter: DurableObjectNamespace,
  ip: string,
): Promise<RateLimitResult> {
  const id = limiter.idFromName(ip);
  const stub = limiter.get(id);
  const resp = await stub.fetch("https://rate-limit/check", { method: "POST" });
  if (!resp.ok) {
    return { allowed: true, retryAfterSec: 0 };
  }
  const data = (await resp.json()) as RateLimitResult;
  return {
    allowed: Boolean(data.allowed),
    retryAfterSec: Number(data.retryAfterSec) || 0,
  };
}
