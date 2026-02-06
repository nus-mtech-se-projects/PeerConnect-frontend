import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";

describe("Navbar", () => {
  it("renders brand and main links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /peerconnect/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about \/ contact/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
  });

  it("navigates to /login when Login clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("link", { name: /login/i }));
    expect(
      screen.getByRole("heading", { name: /login to start learning now/i })
    ).toBeInTheDocument();
  });

  it("navigates to /signup when Sign up clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("link", { name: /sign up/i }));
    expect(screen.getByRole("heading", { name: /^sign up$/i })).toBeInTheDocument();
  });

  it("navigates to /contact when About/Contact clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("link", { name: /about \/ contact/i }));
    expect(screen.getByText(/who are we\?/i)).toBeInTheDocument();
    expect(screen.getByText(/contact us/i)).toBeInTheDocument();
  });

  it("navigates to / when brand clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    // Brand is a button in Navbar
    await user.click(screen.getByRole("button", { name: /peerconnect/i }));
    expect(
      screen.getByRole("heading", { name: /study smarter with peers/i })
    ).toBeInTheDocument();
  });
});
