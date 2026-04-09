import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

// Prevent App's getSwaUser() from making real fetch calls in tests
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    if (url === "/.auth/me") {
      return Promise.resolve({ json: async () => ({ clientPrincipal: null }) });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

    // Login
    await navClick(/^login$/i);
    expect(
      screen.getByRole("heading", { name: /^login$/i })
    ).toBeInTheDocument();

    // Signup
    await navClick(/^sign up$/i);
    expect(
      screen.getByRole("heading", { name: /create account/i })
    ).toBeInTheDocument();

    // Go to About/Contact via navbar
    await navClick(/about \/ contact/i);
    expect(screen.getByText(/who are we\?/i)).toBeInTheDocument();
  });
});
