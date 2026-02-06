import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Carousel from "../Carousel";

describe("Carousel", () => {
  it("renders first slide content", () => {
    const slides = [
      { title: "Slide A", description: "Desc A", imageText: "A" },
      { title: "Slide B", description: "Desc B", imageText: "B" },
    ];

    render(<Carousel slides={slides} autoPlayMs={0} />);
    expect(screen.getByText("Slide A")).toBeInTheDocument();
    expect(screen.getByText("Desc A")).toBeInTheDocument();
  });

  it("next/prev buttons change slide", async () => {
    const user = userEvent.setup();
    const slides = [
      { title: "Slide A", description: "Desc A", imageText: "A" },
      { title: "Slide B", description: "Desc B", imageText: "B" },
    ];

    render(<Carousel slides={slides} autoPlayMs={0} />);

    await user.click(screen.getByRole("button", { name: /next slide/i }));
    expect(screen.getByText("Slide B")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous slide/i }));
    expect(screen.getByText("Slide A")).toBeInTheDocument();
  });

  it("dot click jumps to selected slide", async () => {
    const user = userEvent.setup();
    const slides = [
      { title: "Slide A", description: "Desc A", imageText: "A" },
      { title: "Slide B", description: "Desc B", imageText: "B" },
      { title: "Slide C", description: "Desc C", imageText: "C" },
    ];

    render(<Carousel slides={slides} autoPlayMs={0} />);

    // Dots are buttons with aria-label "Go to slide X"
    await user.click(screen.getByRole("button", { name: /go to slide 3/i }));
    expect(screen.getByText("Slide C")).toBeInTheDocument();
  });
});
