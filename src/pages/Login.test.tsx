import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/landing/HeroScene", () => ({ default: () => null }));
const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import Login from "./Login";
import Signup from "./Signup";

const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  auth.signIn.mockReset();
  auth.signUp.mockReset();
  navigate.mockReset();
});

describe("Login", () => {
  it("logs in and goes to the dashboard", async () => {
    auth.signIn.mockResolvedValue(undefined);
    inRouter(<Login />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " owner@shop.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
    expect(auth.signIn).toHaveBeenCalledWith("owner@shop.test", "secret123");
  });

  it("shows the error inline when login fails", async () => {
    auth.signIn.mockRejectedValue(new Error("Invalid login credentials"));
    inRouter(<Login />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("can show and hide the password", () => {
    inRouter(<Login />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});

describe("Signup", () => {
  it("creates the account with the store name, then goes to log in", async () => {
    auth.signUp.mockResolvedValue(undefined);
    inRouter(<Signup />);
    fireEvent.change(screen.getByLabelText("Store name"), { target: { value: "Dhaka Threads" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@shop.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
    expect(auth.signUp).toHaveBeenCalledWith("owner@shop.test", "longpassphrase", "Dhaka Threads");
  });
});
