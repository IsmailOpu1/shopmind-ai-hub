import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreKnowledgeView } from "./StoreKnowledge";
import type { StoreDocument } from "@/lib/store-documents";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));

const doc: StoreDocument = {
  id: "d1",
  kind: "shipping",
  title: "Delivery & shipping",
  content: "Outside Dhaka: 3-5 working days, 120 taka.",
  indexed_at: "2026-11-07T05:49:12Z",
  updated_at: "2026-11-07T05:49:00Z",
};

const setup = (documents: StoreDocument[] = [doc]) => {
  const onSave = vi.fn(() => Promise.resolve(true));
  const onDelete = vi.fn(() => Promise.resolve());
  render(<StoreKnowledgeView documents={documents} error={null} hasStore onSave={onSave} onDelete={onDelete} />);
  return { onSave, onDelete };
};

describe("StoreKnowledgeView", () => {
  it("lists documents with their status", () => {
    setup();
    expect(screen.getByText("Delivery & shipping", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Assistant knows this")).toBeInTheDocument();
    expect(screen.getByText("1 of 30")).toBeInTheDocument();
  });

  it("explains what to add when empty", () => {
    setup([]);
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });

  it("won't save a template until the placeholders are replaced", async () => {
    const { onSave } = setup([]);
    fireEvent.click(screen.getByRole("button", { name: "Returns & exchanges" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Returns & exchanges");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/bracketed/);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Exchanges within 7 days." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        id: null,
        draft: { kind: "returns", title: "Returns & exchanges", content: "Exchanges within 7 days." },
      }),
    );
  });

  it("edits an existing document", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Delivery & shipping" }));
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "We deliver everywhere in Bangladesh." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" })));
  });

  it("asks before deleting", async () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete Delivery & shipping" }));
    expect(await screen.findByText(/can't be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(doc);
  });

  it("loads text from a .txt file and rejects PDFs", async () => {
    setup([]);
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    const input = screen.getByTestId("doc-file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["We accept bKash."], "payment_policy.txt", { type: "text/plain" })] } });
    await waitFor(() => expect((screen.getByLabelText("Text") as HTMLTextAreaElement).value).toBe("We accept bKash."));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("payment policy");

    fireEvent.change(input, { target: { files: [new File(["%PDF"], "policy.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Only .txt and .md/);
  });
});
