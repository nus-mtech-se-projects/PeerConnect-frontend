import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ForgotPassword from "../ForgotPassword";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

describe("ForgotPassword page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Reset password heading", () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /reset password/i })).toBeInTheDocument();
  });

  it("renders the identifier input and send code button on step 1", () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/johntan@u\.nus\.edu or A1234567X/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send verification code/i })).toBeInTheDocument();
  });

  it("has a link to /login", () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
  });

  // ── Step 1 Validation ──────────────────────────────────────────────────────

  it("shows error when submitting with empty identifier", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /send verification code/i }));
    expect(await screen.findByText(/please enter your email or nus student id/i)).toBeInTheDocument();
  });

  // ── Step 1 Loading ─────────────────────────────────────────────────────────

  it("shows loading state while sending code", async () => {
    const user = userEvent.setup({ delay: null });
    let resolve;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((r) => { resolve = r; })
    );

    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu or A1234567X/i), "test@u.nus.edu");
    await user.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByRole("button", { name: /sending code/i })).toBeDisabled();

    resolve({ ok: true, text: async () => "" });
  });

  // ── Step 1 Success → Step 2 ────────────────────────────────────────────────

  it("advances to step 2 on successful code request", async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu or A1234567X/i), "test@u.nus.edu");
    await user.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  // ── Step 1 Failure ─────────────────────────────────────────────────────────

  it("shows error message when code request fails", async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "User not found",
    });

    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu or A1234567X/i), "unknown@u.nus.edu");
    await user.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByText(/user not found/i)).toBeInTheDocument();
  });

  // ── Step 2 Validation ──────────────────────────────────────────────────────

  async function advanceToStep2() {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    await user.type(screen.getByPlaceholderText(/johntan@u\.nus\.edu or A1234567X/i), "test@u.nus.edu");
    await user.click(screen.getByRole("button", { name: /send verification code/i }));
    await screen.findByPlaceholderText(/enter 6-digit code/i);
    return user;
  }

  it("shows error when code is empty on step 2 submit", async () => {
    const user = await advanceToStep2();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/please enter the verification code/i)).toBeInTheDocument();
  });

  it("shows error when new password is empty on step 2 submit", async () => {
    const user = await advanceToStep2();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/please enter a new password/i)).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    const user = await advanceToStep2();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "password1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "password2");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("shows error when password is less than 6 characters", async () => {
    const user = await advanceToStep2();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "abc");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "abc");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  // ── Step 2 Success ─────────────────────────────────────────────────────────

  it("shows success message and navigates to /login on successful reset", async () => {
    const user = await advanceToStep2();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "newpass1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "newpass1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/password reset successfully/i)).toBeInTheDocument();
    await waitFor(() => expect(mockNav).toHaveBeenCalledWith("/login"), { timeout: 3000 });
  }, 10000);

  // ── Step 2 Failure ─────────────────────────────────────────────────────────

  it("shows 'Invalid or expired code' on 400 response", async () => {
    const user = await advanceToStep2();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Invalid or expired code.",
    });

    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "000000");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "newpass1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "newpass1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/invalid or expired code/i)).toBeInTheDocument();
  });

  // ── Back button ────────────────────────────────────────────────────────────

  it("returns to step 1 when 'Back to enter email' is clicked", async () => {
    const user = await advanceToStep2();
    await user.click(screen.getByRole("button", { name: /back to enter email/i }));
    expect(screen.getByRole("button", { name: /send verification code/i })).toBeInTheDocument();
  });
});
