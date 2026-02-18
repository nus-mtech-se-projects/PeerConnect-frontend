import React from "react";
import { describe, it, expect, vi } from "vitest";
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

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("brand button navigates to /", async () => {
    const user = userEvent.setup();
    renderNavbar();
    await user.click(screen.getByRole("button", { name: /peerconnect/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
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