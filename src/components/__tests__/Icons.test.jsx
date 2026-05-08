import { render, screen } from "@testing-library/react";
import React from "react";
import * as Icons from "../Icons";

describe("Icons", () => {
  it("renders every exported icon component", () => {
    const iconEntries = Object.entries(Icons);

    render(
      <div>
        {iconEntries.map(([name, Icon]) => (
          <span key={name} data-testid={`icon-${name}`}>
            {React.createElement(Icon, { size: 24 })}
          </span>
        ))}
      </div>,
    );

    for (const [name] of iconEntries) {
      expect(screen.getByTestId(`icon-${name}`).querySelector("svg")).toBeInTheDocument();
    }
  });
});
