import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { indexStore } from "@/lib/embed-products";
import {
  DOCUMENT_KINDS,
  type DocumentDraft,
  type DocumentKind,
  isTextFile,
  KIND_LABEL,
  MAX_CONTENT,
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  MAX_TITLE,
  type StoreDocument,
  TEMPLATES,
  titleFromFileName,
  validateDocument,
} from "@/lib/store-documents";

const COLUMNS = "id, kind, title, content, indexed_at, updated_at";
const STARTERS: DocumentKind[] = ["shipping", "returns", "payment", "size_guide", "faq"];

type Editing = { id: string | null; draft: DocumentDraft };

const StoreKnowledge = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StoreDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (bizId: string) => {
    const { data, error: loadError } = await supabase
      .from("store_documents")
      .select(COLUMNS)
      .eq("business_id", bizId)
      .order("created_at", { ascending: true });
    if (loadError) setError("Couldn't load your store documents. Please refresh.");
    else setDocuments((data ?? []) as StoreDocument[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: lookupError } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (lookupError) setError("Couldn't load your store. Please refresh.");
      if (data) {
        setBusinessId(data.id);
        await load(data.id);
      }
      setLoading(false);
    })();
  }, [user, load]);

  const reindex = async (bizId: string) => {
    const toastId = toast.loading("Updating your assistant...");
    try {
      await indexStore(bizId);
      toast.success("Your assistant now knows this.", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the AI search. Your changes were saved.", {
        id: toastId,
      });
    }
    await load(bizId);
  };

  const save = async (editing: Editing): Promise<boolean> => {
    if (!businessId) return false;
    const draft = { kind: editing.draft.kind, title: editing.draft.title.trim(), content: editing.draft.content.trim() };
    const { error: saveError } = editing.id
      ? await supabase.from("store_documents").update(draft).eq("id", editing.id)
      : await supabase.from("store_documents").insert({ business_id: businessId, ...draft });
    if (saveError) {
      toast.error(
        /store_documents_limit|at most/i.test(saveError.message)
          ? `A store can have up to ${MAX_DOCUMENTS} documents.`
          : `Couldn't save: ${saveError.message}`,
      );
      return false;
    }
    await load(businessId);
    void reindex(businessId);
    return true;
  };

  const remove = async (doc: StoreDocument) => {
    const { error: deleteError } = await supabase.from("store_documents").delete().eq("id", doc.id);
    if (deleteError) {
      toast.error("Couldn't delete the document.");
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success(`Deleted "${doc.title}".`);
  };

  if (loading) return <LoadingSpinner message="Loading store knowledge..." />;

  return (
    <StoreKnowledgeView
      documents={documents}
      error={error}
      hasStore={Boolean(businessId)}
      onSave={save}
      onDelete={remove}
    />
  );
};

export function StoreKnowledgeView({
  documents,
  error,
  hasStore,
  onSave,
  onDelete,
}: {
  documents: StoreDocument[];
  error: string | null;
  hasStore: boolean;
  onSave: (editing: Editing) => Promise<boolean>;
  onDelete: (doc: StoreDocument) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<StoreDocument | null>(null);
  const atLimit = documents.length >= MAX_DOCUMENTS;

  const startNew = (kind: DocumentKind) => setEditing({ id: null, draft: { kind, ...TEMPLATES[kind] } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Store knowledge
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Your assistant answers questions about delivery, returns, payment and sizes only from these documents. If
            something isn't here, it tells the shopper to contact you.
          </p>
        </div>
        {hasStore && (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {documents.length} of {MAX_DOCUMENTS}
            </Badge>
            <Button onClick={() => startNew("other")} disabled={atLimit}>
              <Plus className="mr-2 h-4 w-4" />
              Add document
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!hasStore && !error && (
        <p className="text-sm text-muted-foreground">Set up your store first, then add its policies here.</p>
      )}

      {hasStore && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Start from a template:</span>
          {STARTERS.map((kind) => (
            <Button key={kind} variant="outline" size="sm" onClick={() => startNew(kind)} disabled={atLimit}>
              {KIND_LABEL[kind]}
            </Button>
          ))}
        </div>
      )}

      {hasStore && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
            <BookOpen className="h-8 w-8 text-blue-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No documents yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Shoppers often ask "Do you deliver outside Dhaka?" or "Can I exchange the size?". Add your delivery and
            returns policy so the assistant can answer.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {documents.map((doc) => (
          <Card key={doc.id} className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{doc.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {KIND_LABEL[doc.kind] ?? doc.kind}
                    </Badge>
                    {doc.indexed_at ? (
                      <span className="text-xs text-green-400">Assistant knows this</span>
                    ) : (
                      <span className="text-xs text-amber-400">Updating...</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${doc.title}`}
                    onClick={() => setEditing({ id: doc.id, draft: { kind: doc.kind, title: doc.title, content: doc.content } })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${doc.title}`}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setDeleting(doc)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">{doc.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DocumentEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
        onSave={async () => {
          if (editing && (await onSave(editing))) setEditing(null);
        }}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Your assistant will stop using it straight away. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleting) void onDelete(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentEditor({
  editing,
  onClose,
  onChange,
  onSave,
}: {
  editing: Editing | null;
  onClose: () => void;
  onChange: (draft: DocumentDraft) => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const draft = editing?.draft;

  const open = editing !== null;
  const editingId = editing?.id;
  useEffect(() => setProblem(null), [editingId, open]);

  const loadFile = async (file: File) => {
    if (!draft) return;
    if (!isTextFile(file)) {
      setProblem("Only .txt and .md files for now. For a PDF or Word file, copy its text and paste it here.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setProblem("That file is too large. Paste the relevant part instead.");
      return;
    }
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }).catch(() => null);
    if (text === null) {
      setProblem("Couldn't read that file.");
      return;
    }
    onChange({ ...draft, content: text.slice(0, MAX_CONTENT), title: draft.title.trim() || titleFromFileName(file.name) });
    setProblem(text.length > MAX_CONTENT ? `Only the first ${MAX_CONTENT.toLocaleString()} characters were loaded.` : null);
  };

  const submit = async () => {
    if (!draft) return;
    const invalid = validateDocument(draft);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setSaving(true);
    await onSave();
    setSaving(false);
  };

  return (
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Edit document" : "Add document"}</DialogTitle>
          <DialogDescription>
            Write it the way you'd answer a customer. Short paragraphs or Q: / A: pairs work best.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="doc-kind">Type</Label>
                <Select value={draft.kind} onValueChange={(kind) => onChange({ ...draft, kind: kind as DocumentKind })}>
                  <SelectTrigger id="doc-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {KIND_LABEL[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-title">Title</Label>
                <Input
                  id="doc-title"
                  value={draft.title}
                  maxLength={MAX_TITLE}
                  placeholder="e.g. Delivery & shipping"
                  onChange={(e) => onChange({ ...draft, title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="doc-content">Text</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Load from file (.txt, .md)
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  className="hidden"
                  data-testid="doc-file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void loadFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <Textarea
                id="doc-content"
                rows={14}
                value={draft.content}
                maxLength={MAX_CONTENT}
                onChange={(e) => onChange({ ...draft, content: e.target.value })}
              />
              <p className="text-xs text-muted-foreground text-right">
                {draft.content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
              </p>
            </div>
            {problem && (
              <p role="alert" className="text-sm text-red-400">
                {problem}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StoreKnowledge;
