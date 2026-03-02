import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PublicRoute from "../PublicRoute";

describe("PublicRoute", () => {
  beforeEach(() => localStorage.clear());

  it("renders children when no accessToken exists", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={<PublicRoute><div>Login page</div></PublicRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects to /dashboard when accessToken exists", () => {
    localStorage.setItem("accessToken", "valid-token");

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={<PublicRoute><div>Login page</div></PublicRoute>}
          />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("redirects signup to /dashboard when already logged in", () => {
    localStorage.setItem("accessToken", "valid-token");

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route
            path="/signup"
            element={<PublicRoute><div>Signup page</div></PublicRoute>}
          />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText("Signup page")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });
});