import React from "react";
import { render, screen } from "@testing-library/react";
import FeatureCard from "../FeatureCard";

describe("FeatureCard component", () => {
  it("renders the title prop", () => {
    render(<FeatureCard title="Study Groups" description="Find peers to study with" />);
    expect(screen.getByText("Study Groups")).toBeInTheDocument();
  });

  it("renders the description prop", () => {
    render(<FeatureCard title="Study Groups" description="Find peers to study with" />);
    expect(screen.getByText("Find peers to study with")).toBeInTheDocument();
  });

  it("renders as an article element", () => {
    const { container } = render(<FeatureCard title="Test" description="Desc" />);
    expect(container.querySelector("article")).toBeInTheDocument();
  });

  it("renders different title and description when props change", () => {
    render(<FeatureCard title="Mentorship" description="Connect with seniors" />);
    expect(screen.getByText("Mentorship")).toBeInTheDocument();
    expect(screen.getByText("Connect with seniors")).toBeInTheDocument();
  });
});
