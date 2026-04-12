import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

const GEMINI_CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_SHOPKEEPER =
  "You are a helpful, enthusiastic, and persuasive shopkeeper assistant for an online store. " +
  "You have access to the store's product catalog. Your job is to help customers find products " +
  "they love, make personalized recommendations, and gently persuade them to make a purchase. " +
  "Be warm, friendly, and knowledgeable. Only recommend products that exist in the provided " +
  "context. Never make up product details. If a product is out of stock, suggest alternatives. " +
  "Always try to upsell or cross-sell naturally.";

type ChatMessage = { role: string; content: string };

type MatchedProduct = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  stock_status: string;
  promo: string | null;
  created_at: string;
  similarity: number;
};

async function embedUserMessage(
  apiKey: string,
  text: string,
): Promise<number[]> {
  const res = await fetch(GEMINI_EMBED_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      outputDimensionality: 3072,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini embedContent failed (${res.status}): ${raw}`);
  }

  let data: { embedding?: { values?: number[] } };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini embedContent returned non-JSON body");
  }

  const values = data.embedding?.values;
  if (!values || values.length !== 3072) {
    throw new Error(
      `Expected 3072 embedding values, got ${values?.length ?? 0}`,
    );
  }
  return values;
}

function toGeminiRole(role: string): "user" | "model" | null {
  const r = role.trim().toLowerCase();
  if (r === "system") return null;
  if (r === "assistant" || r === "model") return "model";
  return "user";
}

function buildGeminiContents(
  history: ChatMessage[],
  message: string,
): Array<{ role: "user" | "model"; parts: { text: string }[] }> {
  const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> =
    [];
  for (const h of history) {
    const gr = toGeminiRole(h.role);
    if (gr === null) continue;
    const t = typeof h.content === "string" ? h.content.trim() : "";
    if (!t) continue;
    contents.push({ role: gr, parts: [{ text: t }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });
  return contents;
}

async function generateGeminiReply(
  apiKey: string,
  systemWithCatalog: string,
  contents: Array<{ role: "user" | "model"; parts: { text: string }[] }>,
): Promise<string> {
  const res = await fetch(GEMINI_CHAT_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemWithCatalog }] },
      contents,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini generateContent failed (${res.status}): ${raw}`);
  }

  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini generateContent returned non-JSON body");
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text ?? "").join("")?.trim();
  if (!text) {
    throw new Error("Gemini generateContent returned no text");
  }
  return text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase configuration" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: {
    message?: string;
    business_id?: string;
    conversation_history?: ChatMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const businessId = body.business_id;
  const history = Array.isArray(body.conversation_history)
    ? body.conversation_history
    : [];

  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!businessId || typeof businessId !== "string") {
    return new Response(JSON.stringify({ error: "business_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const embedding = await embedUserMessage(geminiKey, message);
    const supabase = createClient(supabaseUrl, serviceKey);

    const vectorLiteral = `[${embedding.join(",")}]`;
    const { data: rawMatches, error: rpcError } = await supabase.rpc(
      "match_products",
      {
        query_embedding: vectorLiteral,
        match_threshold: 0.3,
        match_count: 5,
      },
    );

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = (rawMatches ?? []) as MatchedProduct[];
    const products = rows.filter(
      (p) => String(p.business_id) === String(businessId),
    );

    const catalogJson = JSON.stringify(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image_url: p.image_url,
        category: p.category,
        stock_status: p.stock_status,
        promo: p.promo,
        similarity: p.similarity,
      })),
    );

    const systemWithCatalog =
      `${SYSTEM_SHOPKEEPER}\n\nRelevant products for this store (JSON). ` +
      `Only recommend items from this list:\n${catalogJson}`;

    const contents = buildGeminiContents(history, message);
    const reply = await generateGeminiReply(
      geminiKey,
      systemWithCatalog,
      contents,
    );

    return new Response(
      JSON.stringify({
        reply,
        products,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
