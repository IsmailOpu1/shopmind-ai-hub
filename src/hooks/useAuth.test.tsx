import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const signOut = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ user: { id: "owner-1", email: "owner@shop.test" } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session } }),
      signOut,
    },
  },
}));

import { AuthProvider, useAuth } from "./useAuth";

const KEY = "sb-test-auth-token";

function Probe() {
  const { user, signOut: logOut } = useAuth();
  return (
    <>
      <p>{user ? `in:${user.email}` : "out"}</p>
      <button onClick={() => void logOut()}>log out</button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  signOut.mockReset();
  localStorage.clear();
});

describe("signOut", () => {
  it("signs out even when the server call hangs", async () => {
    vi.useFakeTimers();
    signOut.mockReturnValue(new Promise(() => {})); // never settles
    localStorage.setItem(KEY, "{}");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("in:owner@shop.test")).toBeInTheDocument();

    await act(async () => {
      screen.getByText("log out").click();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText("out")).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs out when the server returns an error", async () => {
    signOut.mockResolvedValue({ error: new Error("session not found") });
    localStorage.setItem(KEY, "{}");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("in:owner@shop.test")).toBeInTheDocument();
    await act(async () => {
      screen.getByText("log out").click();
    });
    expect(await screen.findByText("out")).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
