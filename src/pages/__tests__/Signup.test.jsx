import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Signup from "../Signup";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

describe("Signup page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Create account heading", () => {
    render(<MemoryRouter><Signup /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders all form fields", () => {
    render(<MemoryRouter><Signup /></MemoryRouter>);
    expect(screen.getByLabelText(/nus student id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<MemoryRouter><Signup /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders OAuth buttons for Microsoft", () => {
    render(<MemoryRouter><Signup /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /continue with microsoft/i })).toBeInTheDocument();
  });

  it("has a link to /login", () => {
    render(<MemoryRouter><Signup /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /^login$/i })).toBeInTheDocument();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows error when submitting with empty fields", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Signup /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/please fill in all fields/i)).toBeInTheDocument();
  });

  // ── Successful registration ────────────────────────────────────────────────

  it("navigates to /login on successful registration", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", email: "test@u.nus.edu" }),
      text: async () => "",
    });

    render(<MemoryRouter><Signup /></MemoryRouter>);

    await user.type(screen.getByLabelText(/nus student id/i), "A1234567X");
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Tan");
    await user.type(screen.getByLabelText(/email/i), "test@u.nus.edu");
    await user.type(screen.getByLabelText(/phone/i), "91234567");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith("/login");
    });
  });

  // ── Failed registration ────────────────────────────────────────────────────

  it("shows error on 409 duplicate email", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => "Email already registered",
    });

    render(<MemoryRouter><Signup /></MemoryRouter>);

    await user.type(screen.getByLabelText(/nus student id/i), "A1234567X");
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Tan");
    await user.type(screen.getByLabelText(/email/i), "dupe@u.nus.edu");
    await user.type(screen.getByLabelText(/phone/i), "91234567");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();

    let resolve;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((r) => { resolve = r; })
    );

    render(<MemoryRouter><Signup /></MemoryRouter>);

    await user.type(screen.getByLabelText(/nus student id/i), "A1234567X");
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Tan");
    await user.type(screen.getByLabelText(/email/i), "test@u.nus.edu");
    await user.type(screen.getByLabelText(/phone/i), "91234567");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("button", { name: /creating account/i })).toBeDisabled();

    resolve({ ok: true, json: async () => ({}), text: async () => "" });
  });
});