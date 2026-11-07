// Store documents: the shop's own policies and FAQs the assistant answers from.
// Limits match the store_documents table (title 1-120, content 1-20000, 30 per store).

export const DOCUMENT_KINDS = ["shipping", "returns", "payment", "size_guide", "faq", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const MAX_DOCUMENTS = 30;
export const MAX_TITLE = 120;
export const MAX_CONTENT = 20000;
// A .txt/.md file bigger than this is surely not a policy page.
export const MAX_FILE_BYTES = 200 * 1024;

export type StoreDocument = {
  id: string;
  kind: DocumentKind;
  title: string;
  content: string;
  indexed_at: string | null;
  updated_at: string;
};

export const KIND_LABEL: Record<DocumentKind, string> = {
  shipping: "Delivery & shipping",
  returns: "Returns & exchanges",
  payment: "Payment",
  size_guide: "Size guide",
  faq: "FAQ",
  other: "Other",
};

/** Starting text per kind; the owner replaces the bracketed parts. */
export const TEMPLATES: Record<DocumentKind, { title: string; content: string }> = {
  shipping: {
    title: "Delivery & shipping",
    content: `Inside Dhaka: delivery in [1-2] working days. Delivery charge [60] taka.

Outside Dhaka: we deliver all over Bangladesh by [courier name]. Delivery takes [3-5] working days and costs [120] taka.

Free delivery on orders over [3000] taka.

[Do you ship outside Bangladesh? Say yes or no.]`,
  },
  returns: {
    title: "Returns & exchanges",
    content: `You can exchange an item for a different size within [7] days of delivery, if it is unworn with tags attached.

Refunds: [when do you refund, and how?]

To start a return, contact us at [phone / WhatsApp / email] with your order number.`,
  },
  payment: {
    title: "Payment",
    content: `We accept: [cash on delivery, bKash, Nagad, cards].

Cash on delivery is available [everywhere / inside Dhaka only].

[Any advance payment needed for outside Dhaka orders?]`,
  },
  size_guide: {
    title: "Size guide",
    content: `Shirts (chest, inches): S [36-38], M [38-40], L [40-42], XL [42-44].

Trousers (waist, inches): 30, 32, 34, 36.

Shoes: EU sizes [39-44]. [Do they run small or large?]`,
  },
  faq: {
    title: "Frequently asked questions",
    content: `Q: Do you have a physical shop?
A: [Yes, at ... / No, we are online only.]

Q: How can I contact you?
A: [Phone, WhatsApp, Facebook page, email, hours.]

Q: How do I track my order?
A: [How tracking works.]`,
  },
  other: { title: "", content: "" },
};

export type DocumentDraft = { kind: DocumentKind; title: string; content: string };

/** Returns an error message for the owner, or null when the draft can be saved. */
export function validateDocument(draft: DocumentDraft): string | null {
  const title = draft.title.trim();
  const content = draft.content.trim();
  if (!DOCUMENT_KINDS.includes(draft.kind)) return "Pick a type for this document.";
  if (!title) return "Give the document a title.";
  if (title.length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  if (!content) return "Write the document's text, or load it from a file.";
  if (content.length > MAX_CONTENT) {
    return `This is ${content.length.toLocaleString()} characters; the limit is ${MAX_CONTENT.toLocaleString()}. Split it into two documents.`;
  }
  if (/\[[^\]]{2,}\](?!\()/.test(content)) return "Replace the [bracketed] parts of the template with your store's details.";
  return null;
}

export function isTextFile(file: { name: string; type: string }): boolean {
  return /\.(txt|md|markdown)$/i.test(file.name) || file.type === "text/plain" || file.type === "text/markdown";
}

/** "Delivery & shipping.md" -> "Delivery & shipping". */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, MAX_TITLE);
}
