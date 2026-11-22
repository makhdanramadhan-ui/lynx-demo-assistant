import { MAX_CONTENT_CHARS, MAX_MESSAGES, MAX_PAGE_CHARS } from "./constants";
import type { ChatMessage, ChatRequest, ChatRole } from "./types";

export interface ValidationOk {
  ok: true;
  value: { messages: ChatMessage[]; page: string };
}

export interface ValidationErr {
  ok: false;
}

export type ValidationResult = ValidationOk | ValidationErr;

function isRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateChatRequest(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false };

  const { messages, page } = body;

  if (!Array.isArray(messages)) return { ok: false };
  if (messages.length < 1 || messages.length > MAX_MESSAGES) return { ok: false };

  const normalized: ChatMessage[] = [];
  for (const item of messages) {
    if (!isPlainObject(item)) return { ok: false };
    if (!isRole(item.role)) return { ok: false };
    if (typeof item.content !== "string") return { ok: false };
    if (item.content.length > MAX_CONTENT_CHARS) return { ok: false };
    normalized.push({ role: item.role, content: item.content });
  }

  if (normalized[normalized.length - 1].role !== "user") return { ok: false };

  let normalizedPage = "";
  if (page !== undefined) {
    if (typeof page !== "string") return { ok: false };
    if (page.length > MAX_PAGE_CHARS) return { ok: false };
    normalizedPage = page;
  }

  return { ok: true, value: { messages: normalized, page: normalizedPage } };
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
