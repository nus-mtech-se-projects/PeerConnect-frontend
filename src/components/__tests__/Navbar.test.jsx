import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../Navbar";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNavbar(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navbar />
    </MemoryRouter>
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the PeerConnect brand name", () => {
    renderNavbar();
    expect(screen.getByText("PeerConnect")).toBeInTheDocument();
  });

  it("renders the brand tagline", () => {
    renderNavbar();
    expect(screen.getByText(/learn together, faster/i)).toBeInTheDocument();
  });

  it("renders Home and About / Contact nav links", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about \/ contact/i })).toBeInTheDocument();
  });

  it("renders Login and Sign up action buttons", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /^login$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^sign up$/i })).toBeInTheDocument();
  });

  it("renders Profile and Logout actions for logged-in users", () => {
    localStorage.setItem("accessToken", "token");

    renderNavbar();

    expect(screen.getByRole("link", { name: /^profile$/i })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^login$/i })).not.toBeInTheDocument();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("brand button navigates to /", async () => {
    const user = userEvent.setup();
    renderNavbar();
    await user.click(screen.getByRole("button", { name: /peerconnect/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getAllByRole("button", { name: /close menu/i }).find((button) =>
      button.classList.contains("navHamburger"),
    )).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getAllByRole("button", { name: /close menu/i }).find((button) =>
      button.classList.contains("navOverlay"),
    ));

    expect(screen.getByRole("button", { name: /open menu/i })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("cancels logout from the confirmation dialog", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", "token");

    renderNavbar();

    await user.click(screen.getByRole("button", { name: /^logout$/i }));
    expect(screen.getByText(/are you sure you want to logout/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByText(/are you sure you want to logout/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBe("token");
  });

  it("logs out even when the backend logout request fails", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", "token");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    renderNavbar();

    await user.click(screen.getByRole("button", { name: /^logout$/i }));
    await user.click(screen.getByRole("button", { name: /^yes$/i }));

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("Login link points to /login", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /^login$/i })).toHaveAttribute("href", "/login");
  });

  it("Sign up link points to /signup", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute("href", "/signup");
  });

  it("Home link points to /", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute("href", "/");
  });

  it("About / Contact link points to /contact", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /about \/ contact/i })).toHaveAttribute("href", "/contact");
  });

  // ── Active state ───────────────────────────────────────────────────────────

  it("Home link has active class when on /", () => {
    renderNavbar("/");
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveClass("active");
  });

  it("About / Contact link has active class when on /contact", () => {
    renderNavbar("/contact");
    expect(screen.getByRole("link", { name: /about \/ contact/i })).toHaveClass("active");
  });

  it("Home link is not active when on /contact", () => {
    renderNavbar("/contact");
    expect(screen.getByRole("link", { name: /^home$/i })).not.toHaveClass("active");
  });
});
