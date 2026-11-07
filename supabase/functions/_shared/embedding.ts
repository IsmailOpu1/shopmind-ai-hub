// Embeddings shared by embed-products and the chat function's background
// re-indexing. Both must build the same text for a product.
import { normalizeVariants, variantsSearchText } from "./store-knowledge.ts";

export const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
export const GEMINI_BATCH_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";

export const EMBEDDING_DIMENSIONS = 3072;

export type EmbeddableProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  stock_status: string;
  promo: string | null;
  variants?: unknown;
};

export const EMBEDDABLE_COLUMNS = "id, name, description, category, price, stock_status, promo, variants";

function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function buildProductText(p: EmbeddableProduct): string {
  // Products without variants keep exactly the text they were embedded with.
  const variants = variantsSearchText(normalizeVariants(p.variants));
  return (
    `Product: ${field(p.name)}. Category: ${field(p.category)}. ` +
    `Price: ${field(p.price)}. Description: ${field(p.description)}. ` +
    `Stock: ${field(p.stock_status)}. Promo: ${field(p.promo)}` +
    (variants ? `. ${variants}` : "")
  );
}

export async function embedText(
  apiKey: string,
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<{ ok: true; values: number[] } | { ok: false; status: number; body: string }> {
  const res = await fetch(GEMINI_EMBED_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });
  const raw = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: raw };
  let values: number[] | undefined;
  try {
    values = (JSON.parse(raw) as { embedding?: { values?: number[] } }).embedding?.values;
  } catch {
    return { ok: false, status: 502, body: "Gemini embedContent returned non-JSON body" };
  }
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    return {
      ok: false,
      status: 502,
      body: `Expected ${EMBEDDING_DIMENSIONS} embedding values, got ${values?.length ?? 0}`,
    };
  }
  return { ok: true, values };
}

/** Embeds up to 100 texts in one request (Gemini batchEmbedContents). */
export async function embedTexts(
  apiKey: string,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<{ ok: true; values: number[][] } | { ok: false; status: number; body: string }> {
  if (!texts.length) return { ok: true, values: [] };
  const res = await fetch(GEMINI_BATCH_EMBED_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  });
  const raw = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: raw };
  let embeddings: Array<{ values?: number[] }> | undefined;
  try {
    embeddings = (JSON.parse(raw) as { embeddings?: Array<{ values?: number[] }> }).embeddings;
  } catch {
    return { ok: false, status: 502, body: "Gemini batchEmbedContents returned non-JSON body" };
  }
  if (
    !embeddings || embeddings.length !== texts.length ||
    embeddings.some((e) => e.values?.length !== EMBEDDING_DIMENSIONS)
  ) {
    return { ok: false, status: 502, body: `Expected ${texts.length} embeddings of ${EMBEDDING_DIMENSIONS} values` };
  }
  return { ok: true, values: embeddings.map((e) => e.values as number[]) };
}
