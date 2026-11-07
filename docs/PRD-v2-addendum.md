# ShopMind AI — PRD v2 Addendum

Extends PRD v1.0 (April 8, 2026). Where this conflicts with v1.0, this wins. Owner: Opu. Date: November 7, 2026.

## Status of v1.0 scope

| v1.0 item | Status |
|---|---|
| MVP (auth, dashboard, upload, widget, product cards) | Done |
| Phase 2 (RAG, Gemini, persona, OOS fallback, promos, proactive nudge, embed script, rate limits, multi-tenant isolation, guardrails) | Done |
| Phase 3: bot personality config (name, greeting, colour, position, currency) | Done early |
| Phase 3: multi-language | Partly done (replies in the shopper's language: English, Bangla, Banglish) |
| Streamed replies (risk mitigation in §11) | Done |
| Hosting on Vercel | Not yet |

## Week 1 features, in build order

### 1. Model fallback via OpenRouter — P0
**Why:** the free Gemini key allows 20 replies a day; when Gemini is busy or out of quota shoppers currently see "busy".
**What:** if Gemini returns 429/503, the chat function retries the same prompt on an OpenRouter model. Model is configurable (`OPENROUTER_MODEL`); the key lives only in the `OPENROUTER_API_KEY` edge secret. Streaming, grounding and product cards work the same on either model. Product search embeddings stay on Gemini.
**Done when:** with Gemini quota exhausted, shoppers still get grounded replies; logs show which model answered.

### 2. Add to cart / View product buttons — P0 (v1.0 §6.1)
**What:**
- "View product" opens the product's page (`product_url`).
- "Add to cart" works three ways, chosen per store: (a) a `shopmind:add-to-cart` browser event for custom sites, (b) a cart URL template with `{id}`, `{sku}` or `{product_url}` (e.g. Shopify `/cart/add?id={sku}`), (c) off.
- Optional `sku` column in the catalog upload.
- Every card view and button click is recorded as an analytics event.
**Done when:** a demo store can add a product to its cart from the chat, and the clicks show up in the database.

### 3. Client onboarding flow — P1 (v1.0 §4 goal: signup → live bot in under 15 minutes)
**What:** a first-run checklist on the dashboard: upload catalog → products indexed → customise bot → test chat → copy embed code → "bot is live" (first real chat seen). Sample catalog download. Progress persists.
**Done when:** a new owner can reach a working embed without reading docs.

### 4. RAG Level 1 — better product matching — P1
**What:**
- Query rewriting: the conversation is turned into a standalone search query plus filters (category, colour, price) before searching.
- Re-ranking of the top matches before they go to the reply model.
- Products are indexed automatically after upload or edit (no manual step).
- Fast search on large catalogs (vector index).
**Done when:** the e2e scenarios pass and multi-turn refinements ("in black", "something cheaper") find the right products.

### 5. Analytics dashboard — P2 (v1.0 §6.1)
**What:** chats per day, messages, top questions, most-shown and most-clicked products, card → view → add-to-cart funnel, questions with no matching product (catalog gaps), share of replies served by the fallback model.
**Done when:** owners see the v1.0 §4 success metrics for their own store only.

### 6. RAG Level 2 — store knowledge — P2
**What:**
- Owners add store documents (FAQ, shipping, returns, size guide) as text or file; they are chunked and searched alongside products.
- Product variants (size, colour) with their own stock.
- The bot answers policy questions from these documents and says so when it doesn't know.
**Done when:** "Do you deliver outside Dhaka?" and "Is size M in stock?" are answered from the store's own data.

## Later (not scheduled)
- Shopper photo search (send a photo, get similar products).
- Persistent memory across sessions, human handoff (WhatsApp/email), npm package, Shopify/WooCommerce catalog sync.

## Open decisions (owner)
- Paid Gemini key (or paid OpenRouter credits) before launch.
- Pricing model for stores.
- Production domain.
- Final product name (rename deferred).
