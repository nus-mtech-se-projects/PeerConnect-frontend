import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen,within } from "@testing-library/react";
import Home from "../Home";

describe("Home page", () => {
  it("renders main heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /study smarter with peers/i })).toBeInTheDocument();
  });

  it("renders 4 feature cards", () => {
    render(<Home />);

        // Get the features section specifically (it has class "featureRow")
    const featureSection = document.querySelector(".featureRow");
    expect(featureSection).toBeTruthy();

    const scoped = within(featureSection);

    // Use exact visible titles (case-sensitive issues avoided by regex anchors)
    expect(scoped.getByText(/^peer tutoring system$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^study groups$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^ai chatbot$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^support system$/i)).toBeInTheDocument();
  });
});
