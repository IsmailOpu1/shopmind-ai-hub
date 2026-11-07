import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OnboardingChecklist from "./OnboardingChecklist";
import { onboardingSteps, type OnboardingState } from "@/lib/onboarding";

const renderList = (state: OnboardingState, onIndexNow = vi.fn(), indexing = false) =>
  render(
    <MemoryRouter>
      <OnboardingChecklist steps={onboardingSteps(state)} onIndexNow={onIndexNow} indexing={indexing} />
    </MemoryRouter>,
  );

const currentStep = () => screen.getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step")!;

describe("OnboardingChecklist", () => {
  it("starts with the upload step, a link to Products and the sample CSV", () => {
    renderList({ productCount: 0, unindexedCount: 0, shopperChats: 0, flags: {} });
    expect(screen.getByText("0 of 6 done")).toBeInTheDocument();
    const step = currentStep();
    expect(within(step).getByText("Upload your catalog")).toBeInTheDocument();
    expect(within(step).getByRole("link", { name: /go/i })).toHaveAttribute("href", "/dashboard/products");
    expect(within(step).getByRole("link", { name: /sample catalog/i })).toHaveAttribute("href", "/sample-catalog.csv");
  });

  it("offers Index now when products are waiting, and disables it while running", () => {
    const onIndexNow = vi.fn();
    const state = { productCount: 8, unindexedCount: 2, shopperChats: 0, flags: {} };
    const { unmount } = renderList(state, onIndexNow);
    fireEvent.click(within(currentStep()).getByRole("button", { name: /index now/i }));
    expect(onIndexNow).toHaveBeenCalledOnce();
    unmount();

    renderList(state, onIndexNow, true);
    expect(within(currentStep()).getByRole("button", { name: /indexing/i })).toBeDisabled();
  });

  it("moves on to the website step once customised and tested", () => {
    renderList({
      productCount: 8,
      unindexedCount: 0,
      shopperChats: 0,
      flags: { customized_at: "t", tested_at: "t" },
    });
    expect(screen.getByText("4 of 6 done")).toBeInTheDocument();
    expect(within(currentStep()).getByText("Add it to your website")).toBeInTheDocument();
  });
});
