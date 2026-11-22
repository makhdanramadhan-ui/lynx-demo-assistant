import { ALLOWED_ORIGINS, LOCALHOST_ORIGIN_PATTERN } from "./constants";

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if ((ALLOWED_ORIGINS as readonly string[]).includes(origin)) return true;
  return LOCALHOST_ORIGIN_PATTERN.test(origin);
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin?: string,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (origin) {
    Object.assign(headers, corsHeaders(origin));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function preflightResponse(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function forbiddenOriginResponse(): Response {
  return jsonResponse({ error: "forbidden_origin" }, 403);
}
