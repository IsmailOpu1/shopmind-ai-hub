import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  stock_status: string;
  promo: string | null;
};

function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildProductText(p: ProductRow): string {
  return (
    `Product: ${field(p.name)}. Category: ${field(p.category)}. ` +
    `Price: ${field(p.price)}. Description: ${field(p.description)}. ` +
    `Stock: ${field(p.stock_status)}. Promo: ${field(p.promo)}`
  );
}

async function embedWithGemini(
  apiKey: string,
  productText: string,
): Promise<number[]> {
  const res = await fetch(GEMINI_EMBED_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: productText }] },
      taskType: "RETRIEVAL_DOCUMENT",
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
      `Gemini embedContent expected 3072 embedding values, got ${
        values?.length ?? 0
      }`,
    );
  }
  return values;
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
    return new Response(
      JSON.stringify({ error: "Missing GEMINI_API_KEY secret" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment configuration" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { business_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const businessId = body.business_id;
  if (!businessId || typeof businessId !== "string") {
    return new Response(
      JSON.stringify({ error: "business_id (string) is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select(
      "id, name, description, category, price, stock_status, promo",
    )
    .eq("business_id", businessId)
    .is("embedding", null);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (products ?? []) as ProductRow[];
  let embeddedCount = 0;

  try {
    for (const product of rows) {
      const text = buildProductText(product);
      const vector = await embedWithGemini(geminiKey, text);

      const { error: updateError } = await supabase
        .from("products")
        .update({ embedding: JSON.stringify(vector) })
        .eq("id", product.id);

      if (updateError) {
        return new Response(
          JSON.stringify({
            error: updateError.message,
            embedded_count: embeddedCount,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      embeddedCount++;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        error: message,
        embedded_count: embeddedCount,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ embedded_count: embeddedCount }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
