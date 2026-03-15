import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ChangePassword from "../ChangePassword";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

describe("ChangePassword page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Change password heading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, text: async () => "" });
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
  });

  it("shows sending subtitle while code is being sent on mount", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise(() => {}));
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);
    expect(screen.getByText(/sending a verification code/i)).toBeInTheDocument();
  });

  // ── On-mount fetch ─────────────────────────────────────────────────────────

  it("shows success banner and form after mount fetch succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, text: async () => "" });
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);

    expect(await screen.findByText(/verification code has been sent/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
  });

  it("shows error banner and form after mount fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server error",
    });
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);

    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
  });

  // ── Form validation ────────────────────────────────────────────────────────

  async function renderWithForm() {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, text: async () => "" });
    const user = userEvent.setup();
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);
    await screen.findByPlaceholderText(/enter 6-digit code/i);
    return user;
  }

  it("shows error when code is empty on submit", async () => {
    const user = await renderWithForm();
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/please enter the verification code/i)).toBeInTheDocument();
  });

  it("shows error when new password is empty on submit", async () => {
    const user = await renderWithForm();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/please enter a new password/i)).toBeInTheDocument();
  });

  it("shows error when password is less than 6 characters", async () => {
    const user = await renderWithForm();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "abc");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "abc");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    const user = await renderWithForm();
    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "password1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "password2");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  // ── Submission ─────────────────────────────────────────────────────────────

  it("shows loading state while submitting", async () => {
    const user = await renderWithForm();

    let resolve;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "newpass1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "newpass1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByRole("button", { name: /changing/i })).toBeDisabled();

    resolve({ ok: true, text: async () => "" });
  });

  it("shows success and navigates to /profile on successful change", async () => {
    const user = await renderWithForm();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, text: async () => "" });

    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "123456");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "newpass1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "newpass1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByText(/password changed successfully/i)).toBeInTheDocument();
    await waitFor(() => expect(mockNav).toHaveBeenCalledWith("/profile"), { timeout: 3000 });
  }, 10000);

  it("shows 'Invalid or expired code' on 400 response", async () => {
    const user = await renderWithForm();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Invalid or expired code.",
    });

    await user.type(screen.getByPlaceholderText(/enter 6-digit code/i), "000000");
    await user.type(screen.getByPlaceholderText(/^new password$/i), "newpass1");
    await user.type(screen.getByPlaceholderText(/retype new password/i), "newpass1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByText(/invalid or expired code/i)).toBeInTheDocument();
  });

  // ── Resend ─────────────────────────────────────────────────────────────────

  it("calls the request endpoint again when Resend is clicked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, text: async () => "" }) // mount
      .mockResolvedValueOnce({ ok: true, text: async () => "" }); // resend

    const user = await renderWithForm();
    await user.click(screen.getByRole("button", { name: /resend verification code/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/new verification code has been sent/i)).toBeInTheDocument();
  });

  // ── Back button ────────────────────────────────────────────────────────────

  it("navigates to /profile when Back to Profile is clicked", async () => {
    const user = await renderWithForm();
    await user.click(screen.getByRole("button", { name: /back to profile/i }));
    expect(mockNav).toHaveBeenCalledWith("/profile");
  });
});
