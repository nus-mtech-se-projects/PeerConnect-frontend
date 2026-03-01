import React from "react";
import { render, screen } from "@testing-library/react";
import About from "../About";

describe("About/Contact page", () => {
  it("renders info sections properly", () => {
    render(<About />);

    expect(screen.getByText(/who are we\?/i)).toBeInTheDocument();
    expect(screen.getByText(/why we created this portal\?/i)).toBeInTheDocument();
    expect(screen.getByText(/contact us/i)).toBeInTheDocument();
  });

  it("shows contact details accurately", () => {
    render(<About />);

    expect(screen.getByText(/email:/i)).toBeInTheDocument();
    expect(screen.getByText(/hours:/i)).toBeInTheDocument();
  });
});
