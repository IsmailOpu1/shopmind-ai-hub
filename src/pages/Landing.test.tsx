import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The 3D scene needs WebGL, which jsdom doesn't have.
vi.mock("@/components/landing/HeroScene", () => ({ default: () => <div data-testid="hero-scene" /> }));
const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string } } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

import Landing from "./Landing";

const renderPage = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );

describe("Landing", () => {
  it("pitches the product and sends visitors to sign up", async () => {
    auth.value = { user: null };
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your store’s best salesperson, awake 24/7.");
    const ctas = screen.getAllByRole("link", { name: /Create your assistant/ });
    expect(ctas).toHaveLength(2); // hero and closing banner
    ctas.forEach((l) => expect(l).toHaveAttribute("href", "/signup"));
    screen.getAllByRole("link", { name: "Log in" }).forEach((l) => expect(l).toHaveAttribute("href", "/login"));
    expect(await screen.findByTestId("hero-scene")).toBeInTheDocument();
  });

  it("lists the real features and setup steps", () => {
    auth.value = { user: null };
    renderPage();
    for (const title of ["Hands off to your team", "Remembers returning shoppers", "Never makes things up"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Paste one line" })).toBeInTheDocument();
  });

  it("takes signed-in owners to their dashboard", () => {
    auth.value = { user: { id: "owner-1" } };
    renderPage();
    const links = screen.getAllByRole("link", { name: /Open dashboard/ });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l).toHaveAttribute("href", "/dashboard"));
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});
