import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";

describe("Login page", () => {
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

  beforeEach(() => alertSpy.mockClear());
  afterEach(() => alertSpy.mockClear());

  it("renders heading and fields", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /login to start learning now/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
  });
it("renders and allows clicking OAuth buttons (Google/Facebook/Microsoft)", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  const googleBtn = screen.getByRole("button", { name: /continue with google/i });
  const facebookBtn = screen.getByRole("button", { name: /continue with facebook/i });
  const microsoftBtn = screen.getByRole("button", { name: /continue with microsoft/i });

  expect(googleBtn).toBeInTheDocument();
  expect(facebookBtn).toBeInTheDocument();
  expect(microsoftBtn).toBeInTheDocument();

  // They currently have no handlers, but this ensures they're interactable
  await user.click(googleBtn);
  await user.click(facebookBtn);
  await user.click(microsoftBtn);
});
  it("submits email and password", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText(/email/i), "test@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("has a link to signup", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /sign up now/i })).toBeInTheDocument();
  });
});
