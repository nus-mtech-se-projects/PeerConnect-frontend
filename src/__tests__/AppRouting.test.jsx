import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("App routing", () => {
  it("navigates between pages from navbar", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    // Home loaded
    expect(
      screen.getByRole("heading", { name: /study smarter with peers/i })
    ).toBeInTheDocument();

    // Helper: always scope clicks to the navbar only
    const navClick = async (nameMatcher) => {
      const header = screen.getByRole("banner");
      const nav = within(header);
      await user.click(nav.getByRole("link", { name: nameMatcher }));
    };

    // Go to Login via navbar
    await navClick(/^login$/i);
    expect(
      screen.getByRole("heading", { name: /login to start learning now/i })
    ).toBeInTheDocument();

    // Go to Signup via navbar (exact text avoids "Sign up now")
    await navClick(/^sign up$/i);
    expect(screen.getByRole("heading", { name: /^sign up$/i })).toBeInTheDocument();

    // Go to About/Contact via navbar
    await navClick(/about \/ contact/i);
    expect(screen.getByText(/who are we\?/i)).toBeInTheDocument();
  });
});
