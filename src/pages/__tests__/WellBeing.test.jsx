import { render, screen, fireEvent } from "@testing-library/react";
import WellBeing from "../WellBeing";

function makeToken(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe("WellBeing page", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to NUS resources for NUS users", () => {
    localStorage.setItem("accessToken", makeToken({ email: "student@u.nus.edu" }));

    render(<WellBeing />);

    expect(screen.getByRole("heading", { name: /well-being resources/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /nus resources/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("note")).toHaveTextContent(/NUS students and staff/i);
    expect(screen.getByText(/University Counselling Services/i)).toBeInTheDocument();
  });

  it("defaults to Singapore community resources for external users", () => {
    localStorage.setItem("accessToken", makeToken({ email: "person@example.com" }));

    render(<WellBeing />);

    expect(screen.getByRole("tab", { name: /singapore community/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/everyone in Singapore/i)).toBeInTheDocument();
    expect(screen.getByText(/MindSG/i)).toBeInTheDocument();
  });

  it("switches tabs and renders phone and external links", () => {
    render(<WellBeing />);

    fireEvent.click(screen.getByRole("tab", { name: /nus resources/i }));

    expect(screen.getByRole("note")).toHaveTextContent(/NUS students and staff/i);
    expect(screen.getByRole("link", { name: /6516 1972/i })).toHaveAttribute("href", "tel:65161972");
    expect(screen.getAllByRole("link", { name: /visit/i })[0]).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("tab", { name: /singapore community/i }));
    expect(screen.getByText("Institute of Mental Health (IMH)")).toBeInTheDocument();
  });

  it("renders emergency support alert", () => {
    render(<WellBeing />);

    expect(screen.getByRole("alert")).toHaveTextContent("995");
    expect(screen.getByRole("alert")).toHaveTextContent("1767");
  });
});
