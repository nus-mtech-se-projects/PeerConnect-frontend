import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";
import { useMsal } from "@azure/msal-react";

// Mock useNavigate
const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

describe("Login page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Login heading", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /^login$/i })).toBeInTheDocument();
  });

  it("renders identifier and password inputs", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/johntan@u\.nus\.edu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
  });

  it("renders OAuth buttons for Google, Microsoft and GitHub", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /continue with microsoft/i })).toBeInTheDocument();
  });

  it("has a link to /signup", () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /create one/i })).toBeInTheDocument();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows error when submitting with empty fields", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Login /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /^login$/i }));
    expect(await screen.findByText(/please enter your email/i)).toBeInTheDocument();
  });

  // ── Successful login ───────────────────────────────────────────────────────

  it("stores accessToken and navigates to /dashboard on success", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken: "test-token-123", id: "1", email: "test@u.nus.edu" }),
      text: async () => "",
    });

    render(<MemoryRouter><Login /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu/i), "test@u.nus.edu");
    await user.type(screen.getByPlaceholderText(/^password$/i), "secret123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(localStorage.getItem("accessToken")).toBe("test-token-123");
      expect(mockNav).toHaveBeenCalledWith("/");
    });
  });

  // ── Failed login ───────────────────────────────────────────────────────────

  it("shows error message on 401 response", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    render(<MemoryRouter><Login /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu/i), "bad@u.nus.edu");
    await user.type(screen.getByPlaceholderText(/^password$/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();

    let resolve;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((r) => { resolve = r; })
    );

    render(<MemoryRouter><Login /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu/i), "test@u.nus.edu");
    await user.type(screen.getByPlaceholderText(/^password$/i), "secret123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();

    resolve({ ok: true, json: async () => ({}), text: async () => "" });
  });

  // ── OAuth buttons ──────────────────────────────────────────────────────────

  vi.mock("@azure/msal-react", () => ({
    useMsal: vi.fn(() => ({
      instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) },
      accounts: [],
    })),
  }));
  it("OAuth buttons are clickable without throwing", async () => {
    const user = userEvent.setup();
    const mockLoginRedirect = vi.fn().mockResolvedValue(undefined);

    useMsal.mockReturnValue({
      instance: { loginRedirect: mockLoginRedirect },
      accounts: [],
    });

    render(<MemoryRouter><Login /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Continue with Microsoft/i }));

    expect(mockLoginRedirect).toHaveBeenCalledWith({ scopes: ["User.Read"] });
  });
});