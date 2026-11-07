import { describe, expect, it } from "vitest";
import { isTextFile, MAX_CONTENT, TEMPLATES, titleFromFileName, validateDocument } from "./store-documents";

describe("validateDocument", () => {
  const ok = { kind: "shipping" as const, title: "Delivery", content: "We deliver all over Bangladesh." };

  it("accepts a filled-in document", () => {
    expect(validateDocument(ok)).toBeNull();
  });

  it("asks for a title and text", () => {
    expect(validateDocument({ ...ok, title: "  " })).toMatch(/title/);
    expect(validateDocument({ ...ok, content: "" })).toMatch(/text/);
  });

  it("rejects text over the limit", () => {
    expect(validateDocument({ ...ok, content: "a".repeat(MAX_CONTENT + 1) })).toMatch(/limit/);
  });

  it("won't save a template that still has [placeholders]", () => {
    expect(validateDocument({ kind: "shipping", ...TEMPLATES.shipping })).toMatch(/bracketed/);
  });
});

describe("files", () => {
  it("accepts text and markdown files only", () => {
    expect(isTextFile({ name: "faq.md", type: "" })).toBe(true);
    expect(isTextFile({ name: "policy.txt", type: "text/plain" })).toBe(true);
    expect(isTextFile({ name: "policy.pdf", type: "application/pdf" })).toBe(false);
  });

  it("makes a title from the file name", () => {
    expect(titleFromFileName("return_policy.md")).toBe("return policy");
  });
});
