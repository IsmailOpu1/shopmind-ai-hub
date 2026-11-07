# ShopMind AI

An AI shopping assistant that online stores add to their site with one script tag. Store owners upload their catalog and set up the bot in a dashboard; shoppers chat with it like a shopkeeper who knows every product, price, promo and stock level.

## How it works

- **Dashboard** (React app in `src/`): sign up, upload products (CSV/XLSX), set bot name, greeting, colour, button position and currency, and copy the embed snippet.
- **Embed widget** (`public/embed.js`, built from `scripts/shopmind-embed.template.js`): a dependency-free chat bubble that loads the store's settings and streams replies.
- **Chat function** (`supabase/functions/chat`): rate-limits the visitor, searches the store's catalog (70% vector similarity + 30% keyword, budget-aware), asks Gemini for a grounded reply, and streams it back with product cards.
- **Embedding function** (`supabase/functions/embed-products`): owner-only; creates product embeddings after upload.

Each store's data is isolated: product search runs only on the server with a required store ID, the public key cannot read any table, and owners can only see their own store through row-level security.

## Tech stack

React 18, TypeScript, Vite 5, Tailwind + shadcn/ui, TanStack Query · Supabase (Auth, Postgres + pgvector, Edge Functions) · Gemini (`gemini-2.5-flash-lite` for replies, `gemini-embedding-001` for search).

## Local setup

```bash
npm install
cp .env.example .env   # fill in your Supabase URL, anon key and project ID
npm run dev            # http://localhost:8080
```

`public/embed-demo.html` is a demo storefront for the widget (`/embed-demo.html`, add `?nudge=fast` to see the proactive prompt after 3 seconds).

### Supabase

1. Apply the migrations in `supabase/migrations/` (in order).
2. Set the edge function secrets: `GEMINI_API_KEY` (required), `IP_HASH_SALT` (recommended), and optionally `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` — used automatically when Gemini is busy or out of quota.
3. Deploy the functions:
   ```bash
   supabase functions deploy chat --project-ref <ref> --use-api
   supabase functions deploy embed-products --project-ref <ref> --use-api
   ```
4. In Auth settings, enable email sign-in and leaked-password protection.

## Embedding on a store

```html
<script src="https://<your-dashboard-domain>/embed.js" data-business-id="<store id>" defer></script>
```

Optional attributes override the dashboard settings: `data-bot-name`, `data-greeting`, `data-primary-color`, `data-position` (`bottom-right` / `bottom-left`), `data-currency`, `data-proactive-delay` (seconds, or `off`), and `data-enable-cart="true"`, which shows "Add to cart" on in-stock cards and fires a `shopmind:add-to-cart` event on `window` with `{ id, sku, name, price, product_url }`.

## Chat API

`POST /functions/v1/chat` with `{ message, business_id, session_id, stream?, page? }`.

- Without `stream`, it returns `{ reply, products, currency }`.
- With `stream: true`, it returns server-sent events: `{"type":"delta","text":...}` while the reply is written, then `{"type":"done","reply","products","currency"}` (or `{"type":"error","error"}`).
- Errors before the reply starts (validation, rate limits, AI busy) are normal JSON errors with status 400/404/429/503.

`GET /functions/v1/chat?business_id=...` returns the store's public widget settings.

Limits: 500 characters per message, 30 messages per chat, 60 per visitor per hour, and the store's daily limit (default 500).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dashboard dev server |
| `npm run build` | Production build (also regenerates `public/embed.js`) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `node scripts/test-chat.js <business_id>` | End-to-end chat scenarios against the deployed function (uses ~10 Gemini calls) |
