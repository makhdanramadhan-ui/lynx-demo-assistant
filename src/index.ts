import knowledge from "../knowledge.md";
import { isAllowedOrigin, jsonResponse, preflightResponse, forbiddenOriginResponse } from "./cors";
import { callGemini, MODEL_ID } from "./gemini";
import { checkRateLimitForIp, RateLimiterDO } from "./rateLimit";
import { parseJsonBody, validateChatRequest } from "./validate";
import type { Env } from "./types";

export { RateLimiterDO };

function logStatus(status: number): void {
  console.log(JSON.stringify({ event: "response", status }));
}

function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");

    if (!isAllowedOrigin(origin)) {
      const resp = forbiddenOriginResponse();
      logStatus(resp.status);
      return resp;
    }

    const url = new URL(request.url);
    if (url.pathname !== "/chat") {
      const resp = jsonResponse({ error: "not_found" }, 404, origin);
      logStatus(resp.status);
      return resp;
    }

    if (request.method === "OPTIONS") {
      const resp = preflightResponse(origin);
      logStatus(resp.status);
      return resp;
    }

    if (request.method !== "POST") {
      const resp = jsonResponse({ error: "not_found" }, 404, origin);
      logStatus(resp.status);
      return resp;
    }

    const rawBody = await parseJsonBody(request);
    const validation = validateChatRequest(rawBody);
    if (!validation.ok) {
      const resp = jsonResponse({ error: "bad_request" }, 400, origin);
      logStatus(resp.status);
      return resp;
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimitForIp(env.RATE_LIMITER, ip);
    if (!rate.allowed) {
      const resp = jsonResponse(
        { error: "rate_limited", retryAfterSec: rate.retryAfterSec },
        429,
        origin,
      );
      logStatus(resp.status);
      return resp;
    }

    try {
      const reply = await callGemini({
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL || MODEL_ID,
        knowledge,
        page: validation.value.page,
        messages: validation.value.messages,
      });
      const resp = jsonResponse({ reply }, 200, origin);
      logStatus(resp.status);
      return resp;
    } catch {
      const resp = jsonResponse({ error: "upstream" }, 502, origin);
      logStatus(resp.status);
      return resp;
    }
  },
};
