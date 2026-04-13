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

const SYSTEM_SHOPKEEPER = `You are Alex, a sharp and friendly shopping assistant for this store.

PERSONALITY:
- Warm, confident, and concise
- Speak like a helpful friend, not a salesperson
- Maximum 2 sentences per response

RULES — FOLLOW EXACTLY:
1. Greetings and small talk (hi, hello, thanks, okay, cool, nice) → respond warmly in one sentence, ask what they are looking for. Show zero products.

2. Customer asks for a product → only show products that EXACTLY match the category or name they asked for. Maximum 2 products.

3. Product not available or out of stock → say exactly "Sorry, I don't have [what they asked for] available right now." Then ask "Is there anything else I can help you find?" Show zero products.

4. Customer expresses preference ("I liked X", "that looks good") → acknowledge in one sentence and ask one clarifying question. Do not search for new products.

5. Customer asks a question about a product → answer from catalog data only in 1-2 sentences.

ABSOLUTE RULES:
- NEVER show unrelated products as alternatives
- NEVER mention product IDs, XML tags, or markup
- NEVER make up product details
- NEVER show more than 2 product cards
- NEVER use more than 1 emoji
- Product cards are shown automatically — just write natural text`;

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
  // Only include last 3 messages from history
  const recentHistory = history.slice(-3);
  for (const h of recentHistory) {
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
    session_id?: string;
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
  const sessionId = body.session_id;
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
  if (!sessionId || typeof sessionId !== "string") {
    return new Response(JSON.stringify({ error: "session_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Rate limiting: check message count per session_id (max 20 messages)
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("business_id", businessId)
      .eq("session_id", sessionId)
      .single();

    let conversationId: string | null = null;
    if (conversation && !convError) {
      conversationId = conversation.id;
      const { count, error: countError } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (countError) {
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (count !== null && count >= 20) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded: maximum 20 messages per session",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

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
          query_embedding: vectorLiteral,
          match_threshold: 0.3,
          match_count: 10,
        },
      );

      if (rpcError) {
        return new Response(JSON.stringify({ error: rpcError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rows = (rawMatches ?? []) as MatchedProduct[];
      let products = rows.filter((p) => String(p.business_id) === String(businessId));

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
      let filteredProducts: MatchedProduct[];
      if (inStockProducts.length > 0) {
        filteredProducts = inStockProducts;
      } else {
        filteredProducts = outOfStockProducts;
      }

      topProducts = filteredProducts.slice(0, 2);
    }

    const catalogJson = JSON.stringify(
      topProducts.map((p) => ({
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

    // Add out of stock note if any product is out of stock
    const hasOutOfStock = topProducts.some((p) => p.stock_status !== "in_stock");
    const outOfStockNote = hasOutOfStock
      ? "\n\nNOTE: Some products shown are currently out of stock. Mention this clearly to the customer."
      : "";

    const systemWithCatalog =
      `${SYSTEM_SHOPKEEPER}\n\nThe following products will be automatically displayed as cards to the customer. ` +
      `Do NOT reference them with tags or IDs in your text. Just write natural conversational text describing them by name only.${outOfStockNote}\n\n` +
      `Relevant products for this store (JSON):\n${catalogJson}`;

    const contents = buildGeminiContents(history, message);
    const reply = await generateGeminiReply(
      geminiKey,
      systemWithCatalog,
      contents,
    );

    // Ensure conversation exists, create if not
    let finalConversationId: string;
    if (conversationId) {
      finalConversationId = conversationId;
    } else {
      const { data: newConv, error: createConvError } = await supabase
        .from("conversations")
        .insert({
          business_id: businessId,
          session_id: sessionId,
        })
        .select("id")
        .single();

      if (createConvError || !newConv) {
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      finalConversationId = newConv.id;
    }

    // Save user message and assistant reply to messages table
    const { error: insertError } = await supabase.from("messages").insert([
      {
        conversation_id: finalConversationId,
        role: "user",
        content: message,
      },
      {
        conversation_id: finalConversationId,
        role: "assistant",
        content: reply,
      },
    ]);

    if (insertError) {
      // Log error but don't fail the request - message saving is non-critical
      console.error("Failed to save messages:", insertError.message);
    }

    return new Response(
      JSON.stringify({
        reply,
        products: topProducts,
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
