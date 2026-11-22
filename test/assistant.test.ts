import { describe, expect, it, vi } from "vitest";
import worker, { RateLimiterDO } from "../src/index";
import { isAllowedOrigin, corsHeaders } from "../src/cors";
import { validateChatRequest } from "../src/validate";
import { buildSystemInstruction } from "../src/gemini";
import { checkRateLimit, type RateLimitStorage, type RateLimitState } from "../src/rateLimit";
import type { Env } from "../src/types";

const FAKE_SECRET = "test-secret-DO-NOT-ECHO";

function mockStorage(initial?: Record<string, RateLimitState>): RateLimitStorage {
  const store = new Map<string, RateLimitState>(Object.entries(initial || {}));
  return {
    async get(key: string) {
      return store.get(key);
    },
    async put(key: string, value: RateLimitState) {
      store.set(key, value);
    },
  };
}

function mockEnv(overrides?: Partial<Env>): Env {
  const limiter = {
    idFromName: (name: string) => ({ name }),
    get: (_id: unknown) => ({
      fetch: async () =>
        Response.json({ allowed: true, retryAfterSec: 0 }),
    }),
  } as unknown as DurableObjectNamespace;

  return {
    GEMINI_API_KEY: FAKE_SECRET,
    RATE_LIMITER: limiter,
    ...overrides,
  };
}

function makeRequest(
  url: string,
  init?: RequestInit & { origin?: string | null },
): Request {
  const headers = new Headers(init?.headers);
  if (init?.origin !== null && init?.origin !== undefined) {
    headers.set("Origin", init.origin);
  } else if (init?.origin === undefined) {
    headers.set("Origin", "https://makhdanramadhan-ui.github.io");
  }
  return new Request(url, { ...init, headers });
}

describe("CORS", () => {
  it("allows the production origin", () => {
    expect(isAllowedOrigin("https://makhdanramadhan-ui.github.io")).toBe(true);
  });

  it("allows localhost preview origins", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://localhost")).toBe(true);
  });

  it("denies other origins", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("https://makhdanramadhan-ui.github.io.evil.com")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it("returns 403 for disallowed origin", async () => {
    const req = makeRequest("https://worker.example/chat", {
      method: "POST",
      origin: "https://evil.example",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], page: "ringkasan" }),
    });
    const resp = await worker.fetch(req, mockEnv());
    expect(resp.status).toBe(403);
    const body = await resp.json() as { error: string };
    expect(body.error).toBe("forbidden_origin");
  });

  it("returns preflight CORS headers for allowed origin", async () => {
    const req = makeRequest("https://worker.example/chat", {
      method: "OPTIONS",
      origin: "http://localhost:3000",
    });
    const resp = await worker.fetch(req, mockEnv());
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(resp.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("corsHeaders include required values", () => {
    const h = corsHeaders("https://makhdanramadhan-ui.github.io") as Record<string, string>;
    expect(h["Access-Control-Allow-Methods"]).toContain("OPTIONS");
    expect(h["Access-Control-Allow-Headers"]).toContain("Content-Type");
  });
});

describe("validation", () => {
  it("accepts a valid request", () => {
    const result = validateChatRequest({
      messages: [{ role: "user", content: "Halo" }],
      page: "ringkasan",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing messages", () => {
    expect(validateChatRequest({ page: "ringkasan" }).ok).toBe(false);
  });

  it("rejects empty messages array", () => {
    expect(validateChatRequest({ messages: [], page: "x" }).ok).toBe(false);
  });

  it("rejects more than 10 messages", () => {
    const messages = Array.from({ length: 11 }, () => ({ role: "user", content: "hi" }));
    expect(validateChatRequest({ messages, page: "x" }).ok).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(validateChatRequest({ messages: [{ role: "system", content: "hi" }], page: "x" }).ok).toBe(false);
  });

  it("rejects last message not from user", () => {
    expect(validateChatRequest({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      page: "x",
    }).ok).toBe(false);
  });

  it("rejects content longer than 500 chars", () => {
    expect(validateChatRequest({
      messages: [{ role: "user", content: "a".repeat(501) }],
      page: "x",
    }).ok).toBe(false);
  });

  it("rejects page longer than 80 chars", () => {
    expect(validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      page: "p".repeat(81),
    }).ok).toBe(false);
  });

  it("rejects non-string content", () => {
    expect(validateChatRequest({
      messages: [{ role: "user", content: 123 }],
      page: "x",
    }).ok).toBe(false);
  });

  it("handler returns 400 for bad body", async () => {
    const req = makeRequest("https://worker.example/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    const resp = await worker.fetch(req, mockEnv());
    expect(resp.status).toBe(400);
    const body = await resp.json() as { error: string };
    expect(body.error).toBe("bad_request");
  });

  it("handler returns 400 for malformed JSON", async () => {
    const req = makeRequest("https://worker.example/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const resp = await worker.fetch(req, mockEnv());
    expect(resp.status).toBe(400);
  });
});

describe("rate limit", () => {
  it("allows requests under limit and blocks at limit with retryAfterSec", async () => {
    const storage = mockStorage();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 100; i++) {
      const r = await checkRateLimit(storage, "ip", now, 100, 3_600_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(storage, "ip", now + 1000, 100, 3_600_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(3600);
  });

  it("resets after window", async () => {
    const storage = mockStorage();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 100; i++) {
      await checkRateLimit(storage, "ip", now, 100, 3_600_000);
    }
    const blocked = await checkRateLimit(storage, "ip", now + 1000, 100, 3_600_000);
    expect(blocked.allowed).toBe(false);
    const afterWindow = await checkRateLimit(storage, "ip", now + 3_600_001, 100, 3_600_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it("handler returns 429 when rate limited", async () => {
    const limiter = {
      idFromName: (name: string) => ({ name }),
      get: (_id: unknown) => ({
        fetch: async () => Response.json({ allowed: false, retryAfterSec: 42 }),
      }),
    } as unknown as DurableObjectNamespace;

    const req = makeRequest("https://worker.example/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], page: "ringkasan" }),
    });
    const resp = await worker.fetch(req, mockEnv({ RATE_LIMITER: limiter }));
    expect(resp.status).toBe(429);
    const body = await resp.json() as { error: string; retryAfterSec: number };
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfterSec).toBe(42);
  });
});

describe("system instruction and secrets", () => {
  it("includes language instruction", () => {
    const instruction = buildSystemInstruction("knowledge", "ringkasan");
    expect(instruction.toLowerCase()).toContain("indonesian");
    expect(instruction.toLowerCase()).toContain("english");
    expect(instruction).toContain("Current page context: ringkasan");
  });

  it("does not include the secret in system instruction", () => {
    const instruction = buildSystemInstruction("knowledge", "ringkasan");
    expect(instruction).not.toContain(FAKE_SECRET);
  });

  it("handler does not echo secret in upstream error response", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(`boom ${FAKE_SECRET}`));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const req = makeRequest("https://worker.example/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], page: "ringkasan" }),
      });
      const resp = await worker.fetch(req, mockEnv());
      expect(resp.status).toBe(502);
      const text = await resp.text();
      expect(text).not.toContain(FAKE_SECRET);
      expect(text).toContain("upstream");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("routing", () => {
  it("returns 404 for unknown path on allowed origin", async () => {
    const req = makeRequest("https://worker.example/unknown", { method: "GET" });
    const resp = await worker.fetch(req, mockEnv());
    expect(resp.status).toBe(404);
  });
});
