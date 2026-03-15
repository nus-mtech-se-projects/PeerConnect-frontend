import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../Home";
import { useMsal } from "@azure/msal-react";

const mockNav = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(),
}));

function createAccessToken() {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${payload}.signature`;
}

function createFetchResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

function mockDashboardFetch({
  groups = [],
  groupDetails = {},
  profile = { firstName: "Test", lastName: "User" },
} = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url.endsWith("/api/users/me")) return createFetchResponse(profile);
    if (url.endsWith("/api/profile")) return createFetchResponse({}, false, 404);
    if (url.endsWith("/api/groups")) return createFetchResponse(groups);

    const groupIdMatch = url.match(/\/api\/groups\/([^/]+)$/);
    if (groupIdMatch) {
      return createFetchResponse(groupDetails[groupIdMatch[1]] || {}, !!groupDetails[groupIdMatch[1]], groupDetails[groupIdMatch[1]] ? 200 : 404);
    }

    throw new Error(`Unhandled fetch: ${url}`);
  });
}

describe("Home page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn(), loginRedirect: vi.fn() },
      accounts: [{ username: "student@u.nus.edu", name: "Student User", idTokenClaims: {} }],
    });
  });

  it("renders 4 feature cards for guests", () => {
    render(<Home />);

    const featureSection = document.querySelector(".featureRow");
    expect(featureSection).toBeTruthy();

    const scoped = within(featureSection);
    expect(scoped.getByText(/^peer tutoring system$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^study groups$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^ai chatbot$/i)).toBeInTheDocument();
    expect(scoped.getByText(/^support system$/i)).toBeInTheDocument();
  });

  it("shows only eligible joined study groups in the peer feedback session picker", async () => {
    localStorage.setItem("accessToken", createAccessToken());

    mockDashboardFetch({
      groups: [
        { id: "g1", name: "Algo Group", joined: true },
        { id: "g2", name: "DB Group", joined: true },
        { id: "g3", name: "OS Group", joined: false },
      ],
      groupDetails: {
        g1: {
          id: "g1",
          name: "Algo Group",
          members: [
            { userId: "peer-1", email: "peer1@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "One" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [{ id: "s1", title: "Week 5 Review", startsAt: "2026-03-20T10:00:00" }],
        },
        g2: {
          id: "g2",
          name: "DB Group",
          members: [
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [{ id: "s2", title: "Schema Workshop", startsAt: "2026-03-21T12:00:00" }],
        },
      },
    });

    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("heading", { name: /study groups/i });
    await user.click(screen.getByRole("button", { name: /peer tutoring/i }));

    expect(await screen.findByRole("heading", { name: /choose feedback session/i })).toBeInTheDocument();

    const groupSelect = screen.getByLabelText(/study group/i);
    const options = within(groupSelect).getAllByRole("option");

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Algo Group");
    expect(screen.getByText(/you can only choose from study groups you have joined/i)).toBeInTheDocument();
  });

  it("lets the user choose a study group and scheduled session before opening the feedback form", async () => {
    localStorage.setItem("accessToken", createAccessToken());

    mockDashboardFetch({
      groups: [
        { id: "g1", name: "Algo Group", joined: true },
        { id: "g2", name: "DB Group", joined: true },
      ],
      groupDetails: {
        g1: {
          id: "g1",
          name: "Algo Group",
          members: [
            { userId: "peer-1", email: "peer1@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "One" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [
            { id: "s1", title: "Week 5 Review", startsAt: "2026-03-20T10:00:00" },
          ],
        },
        g2: {
          id: "g2",
          name: "DB Group",
          members: [
            { userId: "peer-2", email: "peer2@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "Two" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [
            { id: "s2", title: "Schema Workshop", startsAt: "2026-03-21T12:00:00" },
            { id: "s3", title: "Normalization Clinic", startsAt: "2026-03-22T09:00:00" },
          ],
        },
      },
    });

    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("heading", { name: /study groups/i });
    await user.click(screen.getByRole("button", { name: /peer tutoring/i }));

    const groupSelect = await screen.findByLabelText(/study group/i);
    const sessionSelect = screen.getByLabelText(/scheduled session/i);

    await user.selectOptions(groupSelect, "g2");

    await waitFor(() => {
      expect(within(sessionSelect).getByRole("option", { name: /schema workshop/i })).toBeInTheDocument();
      expect(within(sessionSelect).getByRole("option", { name: /normalization clinic/i })).toBeInTheDocument();
    });

    await user.selectOptions(sessionSelect, "s3");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("heading", { name: /give feedback/i })).toBeInTheDocument();
    expect(screen.getByText(/normalization clinic/i)).toBeInTheDocument();
    expect(screen.getByText(/group: db group/i)).toBeInTheDocument();
  });
});
