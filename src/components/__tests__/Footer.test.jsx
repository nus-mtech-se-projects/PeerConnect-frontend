import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Footer from "../Footer";

describe("Footer", () => {
  const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});

  beforeEach(() => alertSpy.mockClear());
  afterEach(() => alertSpy.mockClear());

  it("renders footer sections", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/product/i)).toBeInTheDocument();
    expect(screen.getByText(/company/i)).toBeInTheDocument();
    expect(screen.getByText(/support/i)).toBeInTheDocument();
    expect(screen.getByText(/get updates/i)).toBeInTheDocument();
  });

  it("newsletter submit triggers placeholder handler", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
