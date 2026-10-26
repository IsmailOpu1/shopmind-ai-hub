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
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_RE = /^[A-Za-z0-9_-]{8,100}$/;
const MAX_MESSAGE_CHARS = 500;
const HISTORY_TURNS = 6;

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  session_limit:
    "You've reached the message limit for this chat. Please refresh the page to start a new one.",
  visitor_limit:
    "You're sending messages too quickly. Please try again in a little while.",
  business_limit:
    "Our assistant is very busy right now. Please try again later.",
};

const shopkeeperPrompt = (botName: string) => `You are ${botName}, a friendly and knowledgeable shopping assistant for this store.

PERSONALITY:
- Warm, confident, and concise
- Speak like a helpful friend
- Maximum 2 sentences per response

RULES:
1. Greetings and small talk → respond warmly in one sentence, ask what they need. Show zero products.

2. Product request → show the most relevant products from the catalog. The catalog IS the store inventory. Trust it completely. Never say a product is unavailable if it appears in the catalog.

3. Price request → immediately show products from catalog matching the price. No clarifying questions.

4. Specific color/style request → show closest matching products from catalog.

5. Empty catalog for query → apologize and ask what else you can help with.

6. Preference expression → acknowledge briefly, ask one clarifying question.

CRITICAL RULES:
- Products in catalog ARE available in this store
- Product cards display automatically
- Write natural text with product names only
- Never show more than 2 product cards
- Never show unrelated products
- Never ask for category when price is given`;

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashIp(req: Request, salt: string): Promise<string | null> {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "";
  if (!ip) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// History comes from the database, never from the client, so shoppers can't
// forge earlier assistant turns.
function buildGeminiContents(
  history: ChatMessage[],
  message: string,
): Array<{ role: "user" | "model"; parts: { text: string }[] }> {
  const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> =
    [];
  for (const h of history) {
    const t = h.content.trim();
    if (!t) continue;
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: t }],
    });
  }
  // Gemini expects the conversation to start with a user turn.
  while (contents.length > 0 && contents[0].role !== "user") contents.shift();
  contents.push({ role: "user", parts: [{ text: message }] });
  return contents;
}

async function generateGeminiReply(
  apiKey: string,
  systemWithCatalog: string,
  contents: Array<{ role: "user" | "model"; parts: { text: string }[] }>,
): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      if (res.status === 503 && attempt < maxRetries) {
        // Service unavailable, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
        lastError = new Error(`Gemini generateContent failed (${res.status}): ${raw}`);
        continue;
      }
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

  // If we've exhausted retries, throw the last error
  throw lastError || new Error("Gemini generateContent failed after retries");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!geminiKey || !supabaseUrl || !serviceKey) {
    console.error("chat: missing GEMINI_API_KEY or Supabase configuration");
    return json({ error: "Assistant is not configured" }, 500);
  }
  const ipSalt = Deno.env.get("IP_HASH_SALT") ?? serviceKey;

  let body: {
    message?: unknown;
    business_id?: unknown;
    session_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const businessId = typeof body.business_id === "string"
    ? body.business_id.trim()
    : "";
  const sessionId = typeof body.session_id === "string"
    ? body.session_id.trim()
    : "";

  if (!message) {
    return json({ error: "message is required" }, 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return json(
      { error: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.` },
      400,
    );
  }
  if (!UUID_RE.test(businessId)) {
    return json({ error: "business_id is invalid" }, 400);
  }
  if (!SESSION_RE.test(sessionId)) {
    return json({ error: "session_id is invalid" }, 400);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const ipHash = await hashIp(req, ipSalt);

    const { data: limitReason, error: limitError } = await supabase.rpc(
      "check_chat_rate_limit",
      { p_business_id: businessId, p_session_id: sessionId, p_ip_hash: ipHash },
    );
    if (limitError) throw new Error(`rate limit check: ${limitError.message}`);
    if (limitReason === "unknown_business") {
      return json({ error: "Store not found" }, 404);
    }
    if (typeof limitReason === "string") {
      return json(
        { error: RATE_LIMIT_MESSAGES[limitReason] ?? "Rate limit exceeded" },
        429,
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("bot_name")
      .eq("id", businessId)
      .single();
    if (businessError || !business) {
      throw new Error(`load business: ${businessError?.message}`);
    }

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .upsert(
        { business_id: businessId, session_id: sessionId, ip_hash: ipHash },
        { onConflict: "business_id,session_id" },
      )
      .select("id")
      .single();
    if (convError || !conversation) {
      throw new Error(`upsert conversation: ${convError?.message}`);
    }

    const { data: recent, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    if (historyError) throw new Error(`load history: ${historyError.message}`);
    const history = ((recent ?? []) as ChatMessage[]).reverse();

    // Short greeting detection: skip product search for greetings/small talk
    const greetings = ["hi", "hello", "hey", "thanks", "thank you", "okay", "ok", "sure", "bye", "good", "nice", "cool", "great", "awesome", "perfect"];
    const messageWords = message.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const isGreeting =
      messageWords.length < 4 &&
      greetings.some((greeting) => message.toLowerCase().includes(greeting));

    let topProducts: MatchedProduct[] = [];
    if (!isGreeting) {
      const embedding = await embedUserMessage(geminiKey, message);

      const vectorLiteral = `[${embedding.join(",")}]`;
      const { data: rawMatches, error: rpcError } = await supabase.rpc(
        "match_products",
        {
          p_business_id: businessId,
          query_embedding: vectorLiteral,
          match_threshold: 0.1,
          match_count: 10,
          query_text: message,
        },
      );
      if (rpcError) throw new Error(`match_products: ${rpcError.message}`);

      let products = (rawMatches ?? []) as MatchedProduct[];

      // Keyword filtering: extract keywords from user message
      const keywords = message
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length >= 3);

      // Check if any product matches keywords
      const keywordMatches = products.filter((p) =>
        keywords.some(
          (keyword) =>
            p.name.toLowerCase().includes(keyword) ||
            (p.category && p.category.toLowerCase().includes(keyword)),
        ),
      );

      // Use keyword matches if found, otherwise use similarity results
      if (keywordMatches.length > 0) {
        products = keywordMatches;
      } else {
        products = products.sort((a, b) => b.similarity - a.similarity);
      }

      // Out of stock filtering: prioritize in_stock products
      const inStockProducts = products.filter((p) => p.stock_status === "in_stock");
      const outOfStockProducts = products.filter((p) => p.stock_status !== "in_stock");

      // Only include out_of_stock products if no in_stock alternatives exist
      const filteredProducts = inStockProducts.length > 0
        ? inStockProducts
        : outOfStockProducts;

      topProducts = filteredProducts.slice(0, 2);
    }

    const catalogJson = JSON.stringify(
      topProducts.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        stock_status: p.stock_status,
        promo: p.promo,
      })),
    );

    // Add out of stock note if any product is out of stock
    const hasOutOfStock = topProducts.some((p) => p.stock_status !== "in_stock");
    const outOfStockNote = hasOutOfStock
      ? "\n\nNOTE: Some products shown are currently out of stock. Mention this clearly to the customer."
      : "";

    const systemWithCatalog =
      `${shopkeeperPrompt(business.bot_name)}\n\nThe following products will be automatically displayed as cards to the customer. ` +
      `Do NOT reference them with tags or IDs in your text. Just write natural conversational text describing them by name only.${outOfStockNote}\n\n` +
      `Relevant products for this store (JSON):\n${catalogJson}`;

    const contents = buildGeminiContents(history, message);
    const reply = await generateGeminiReply(
      geminiKey,
      systemWithCatalog,
      contents,
    );

    const { error: insertError } = await supabase.from("messages").insert([
      { conversation_id: conversation.id, role: "user", content: message },
      { conversation_id: conversation.id, role: "assistant", content: reply },
    ]);
    if (insertError) {
      // Non-fatal for the shopper, but rate limits depend on these rows.
      console.error("chat: failed to save messages:", insertError.message);
    }

    return json({ reply, products: topProducts });
  } catch (e) {
    console.error("chat:", e instanceof Error ? e.message : String(e));
    return json(
      { error: "Sorry, something went wrong. Please try again." },
      500,
    );
  }
});
