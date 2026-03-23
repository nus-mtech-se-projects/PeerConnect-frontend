import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMsal } from "@azure/msal-react";
import Home from "../Home";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(() => ({
    instance: { logoutRedirect: vi.fn() },
    accounts: [],
  })),
}));

function makeAccessToken() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
  });
}

function mockDashboardFetch({ groups = [], profile = {}, classes = [], tutorFeedbacks = [] } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.endsWith("/api/users/me")) {
      return mockJsonResponse(profile);
    }

    if (url.endsWith("/api/profile")) {
      return mockJsonResponse({});
    }

    if (url.endsWith("/api/groups")) {
      return mockJsonResponse(groups);
    }

    if (url.endsWith("/api/tutoring/classes")) {
      return mockJsonResponse(classes);
    }

    if (method === "GET" && /\/api\/tutoring\/classes\/[^/]+\/feedback$/.test(url)) {
      return mockJsonResponse(tutorFeedbacks);
    }

    return mockJsonResponse({});
  });
}

describe("Home page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [],
    });
  });

  it("renders main heading for guests", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /study smarter with peers/i })).toBeInTheDocument();
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

  it("renders the study groups dashboard for logged-in users", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    render(<Home />);

    expect(await screen.findByRole("heading", { name: /^study groups$/i })).toBeInTheDocument();
    expect(screen.getByText(/discover, create, and join study groups/i)).toBeInTheDocument();
    expect(screen.getByText(/no groups found\. create one to get started!/i)).toBeInTheDocument();
  });

  it("opens the peer tutoring tab from the dashboard", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));

    expect(await screen.findByText(/select your role above to get started with peer tutoring/i)).toBeInTheDocument();
  });

  it("shows the tutor dashboard empty state in peer tutoring", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
      classes: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));

    expect(await screen.findByRole("heading", { name: /tutor dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/no classes yet\. create one to start tutoring!/i)).toBeInTheDocument();
  });

  it("shows available classes in the tutee dashboard", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
      classes: [
        {
          id: 11,
          title: "Math Revision Sprint",
          moduleCode: "MA1521",
          topic: "Calculus",
          tutorName: "Jamie Tan",
          schedule: "Every Friday 3pm",
          mode: "online",
          enrolledCount: 2,
          maxStudents: 6,
          isTutor: false,
          enrolled: false,
        },
      ],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));

    expect(await screen.findByRole("heading", { name: /tutee dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/math revision sprint/i)).toBeInTheDocument();
    expect(screen.getByText(/jamie tan/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^join$/i })).toBeInTheDocument();
  });

  it("lets tutors open submitted feedbacks and inspect a selected entry", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [
        {
          id: 7,
          title: "Math Revision Sprint",
          moduleCode: "MA1521",
          topic: "Calculus",
          mode: "online",
          enrolledCount: 2,
          maxStudents: 6,
          isTutor: true,
        },
      ],
      tutorFeedbacks: [
        {
          id: 101,
          sessionId: 7,
          revieweeId: "tutor-1",
          revieweeName: "Jamie Tan",
          reviewerName: "Alex Lee",
          reviewerEmail: "alex@u.nus.edu",
          overallRating: 5,
          preparedness: 4,
          communication: 5,
          helpfulness: 5,
          reliability: 4,
          strengths: "Clear explanations",
          improvements: "Could share more practice questions",
          submittedAt: "2026-03-23T10:00:00.000Z",
        },
      ],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /view feedbacks/i }));

    expect(await screen.findByRole("heading", { name: /submitted feedbacks/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /alex lee/i }));

    expect(screen.getByText(/clear explanations/i)).toBeInTheDocument();
    expect(screen.getByText(/could share more practice questions/i)).toBeInTheDocument();
    expect(screen.getByText(/overall rating/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5\/5/i).length).toBeGreaterThan(0);
  });

  it("hides reviewer identity for anonymous feedback", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [
        {
          id: 8,
          title: "Physics Drill",
          moduleCode: "PC1141",
          topic: "Mechanics",
          mode: "online",
          enrolledCount: 1,
          maxStudents: 6,
          isTutor: true,
        },
      ],
      tutorFeedbacks: [
        {
          id: 102,
          sessionId: 8,
          revieweeId: "tutor-2",
          revieweeName: "Tutor User",
          reviewerName: "Hidden Student",
          reviewerEmail: "hidden@u.nus.edu",
          overallRating: 4,
          preparedness: 4,
          communication: 4,
          helpfulness: 4,
          reliability: 4,
          strengths: "Helpful session",
          improvements: "None",
          anonymousToPeer: true,
          submittedAt: "2026-03-23T10:00:00.000Z",
        },
      ],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /view feedbacks/i }));

    expect((await screen.findAllByText(/^anonymous$/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/submitted anonymously/i)).toBeInTheDocument();
    expect(screen.queryByText(/hidden student/i)).not.toBeInTheDocument();
  });
});
