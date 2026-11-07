import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildProductText,
  EMBEDDABLE_COLUMNS,
  type EmbeddableProduct,
  embedText,
} from "../_shared/embedding.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  // Only the store owner may (re)embed their catalog — this spends Gemini quota.
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const { data: authData, error: authError } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null }, error: null };
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Sign in required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", authData.user.id)
    .maybeSingle();
  if (!business) {
    return new Response(JSON.stringify({ error: "Store not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select(EMBEDDABLE_COLUMNS)
    .eq("business_id", businessId)
    .is("embedding", null);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (products ?? []) as EmbeddableProduct[];
  let embeddedCount = 0;

  try {
    for (const product of rows) {
      const result = await embedText(geminiKey, buildProductText(product), "RETRIEVAL_DOCUMENT");
      if (!result.ok) {
        throw new Error(`Gemini embedContent failed (${result.status}): ${result.body.slice(0, 300)}`);
      }
      const vector = result.values;

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
