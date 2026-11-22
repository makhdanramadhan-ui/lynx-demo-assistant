# lynx-demo-assistant

Cloudflare Worker proxy for the LyNx Agent Control public demo assistant. It accepts chat requests from the demo dashboard, validates input, enforces per-IP rate limiting, and forwards prompts to the Gemini API with a bundled knowledge base.

## Endpoint

- `POST /chat`
- `OPTIONS /chat` (CORS preflight)

Request JSON:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "page": "ringkasan",
  "uiLang": "id"
}
```

Rules:
- Allowed origins: `https://makhdanramadhan-ui.github.io` and `http://localhost:*`
- `messages`: 1-10 items, roles `user|assistant`, last item must be `user`, each content <= 500 chars
- `page`: optional string, <= 80 chars
- Rate limit: 100 requests/hour per client IP (`CF-Connecting-IP`), Durable Object fixed window
- Responses: `200 {reply}`, `400 bad_request`, `403 forbidden_origin`, `429 rate_limited + retryAfterSec`, `502 upstream`

## Deployed URLs

- Reachable (Pages): `https://lynx-demo-assistant-api.pages.dev/chat`
- Worker (workers.dev): `https://lynx-demo-assistant.lynx-akhdan.workers.dev/chat` (may be unreachable from some Indonesian ISPs / certain VPS TLS paths; Pages URL is the recommended public endpoint)

## Model

- Gemini model: `gemini-3-flash-preview` (selected from `models.list` as a current Flash model supporting `generateContent`; verified live). `maxOutputTokens` set to 1024 to accommodate Gemini 3 thinking-token overhead.

## Setup

```bash
npm install
```

## Secret

Set the Gemini API key as a Worker secret (never commit it):

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler pages secret put GEMINI_API_KEY --project-name lynx-demo-assistant-api
```

## Test

```bash
npm test
npm run typecheck
```

## Deploy

```bash
npx wrangler deploy
# Pages (reachable hostname): build bundle, inline knowledge, then:
npx wrangler pages deploy dist-pages --project-name lynx-demo-assistant-api --branch main --force --commit-dirty=true
```

## Notes

- The Worker only answers from `knowledge.md`.
- Message contents are not stored or logged; logs contain status only.
- Rate limiting uses a Durable Object (`RateLimiterDO`) for correctness across isolates.
