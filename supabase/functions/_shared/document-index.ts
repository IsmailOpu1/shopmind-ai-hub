// Indexes a store's documents: splits each new or edited document into
// chunks, embeds them, and marks the document indexed. Used by the
// embed-products function (owner presses "save") and by the chat function
// in the background, so documents heal themselves like products do.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { embedTexts } from "./embedding.ts";
import { chunkDocument, chunkEmbeddingText } from "./store-knowledge.ts";

type PendingDocument = { id: string; title: string; content: string; updated_at: string };

export type DocumentIndexResult = { indexed: number; failed: string | null };

const BATCH = 100; // Gemini batchEmbedContents limit

export async function indexPendingDocuments(
  supabase: SupabaseClient,
  apiKey: string,
  businessId: string,
  maxDocuments = 10,
): Promise<DocumentIndexResult> {
  const { data, error } = await supabase
    .from("store_documents")
    .select("id, title, content, updated_at")
    .eq("business_id", businessId)
    .is("indexed_at", null)
    .order("updated_at", { ascending: true })
    .limit(maxDocuments);
  if (error) return { indexed: 0, failed: `load documents: ${error.message}` };

  let indexed = 0;
  for (const doc of (data ?? []) as PendingDocument[]) {
    const chunks = chunkDocument(doc.content);
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH).map((c) => chunkEmbeddingText(doc.title, c));
      const result = await embedTexts(apiKey, batch, "RETRIEVAL_DOCUMENT");
      if (!result.ok) return { indexed, failed: `embed ${result.status}: ${result.body.slice(0, 200)}` };
      vectors.push(...result.values);
    }

    // Replace whatever chunks exist (a half-finished earlier run, say).
    const { error: deleteError } = await supabase.from("document_chunks").delete().eq("document_id", doc.id);
    if (deleteError) return { indexed, failed: `clear chunks: ${deleteError.message}` };
    if (chunks.length) {
      const { error: insertError } = await supabase.from("document_chunks").insert(
        chunks.map((content, i) => ({
          document_id: doc.id,
          business_id: businessId,
          chunk_index: i,
          content,
          embedding: JSON.stringify(vectors[i]),
        })),
      );
      if (insertError) return { indexed, failed: `save chunks: ${insertError.message}` };
    }
    // Only if the owner didn't edit it meanwhile; otherwise the edit already
    // cleared these chunks' indexed_at and the next run redoes it.
    const { error: markError } = await supabase
      .from("store_documents")
      .update({ indexed_at: new Date().toISOString() })
      .eq("id", doc.id)
      .eq("updated_at", doc.updated_at);
    if (markError) return { indexed, failed: `mark indexed: ${markError.message}` };
    indexed++;
  }
  return { indexed, failed: null };
}
