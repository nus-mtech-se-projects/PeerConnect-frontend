import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMsal } from "@azure/msal-react";
import { MemoryRouter } from "react-router-dom";
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
    text: async () => JSON.stringify(data),
  });
}

function mockDashboardFetch({
  groups = [],
  profile = {},
  classes = [],
  tutorFeedbacks = [],
  tutorFeedbackPost = null,
  tutorClassCreateResponse = null,
  tutorClassEnrollResponse = null,
  tutorClassLeaveResponse = null,
  tutorClassDeleteResponse = null,
  groupDetails = {},
} = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.endsWith("/api/users/me")) return mockJsonResponse(profile);
    if (url.endsWith("/api/profile")) return mockJsonResponse({});
    if (url.endsWith("/api/groups")) return mockJsonResponse(groups);
    if (method === "GET" && url.endsWith("/api/tutoring/classes")) return mockJsonResponse(classes);
    if (method === "POST" && url.endsWith("/api/tutoring/classes")) {
      return tutorClassCreateResponse ?? mockJsonResponse({});
    }
    if (method === "POST" && /\/api\/tutoring\/classes\/[^/]+\/enroll$/.test(url)) {
      return tutorClassEnrollResponse ?? mockJsonResponse({});
    }
    if (method === "POST" && /\/api\/tutoring\/classes\/[^/]+\/leave$/.test(url)) {
      return tutorClassLeaveResponse ?? mockJsonResponse({});
    }
    if (method === "DELETE" && /\/api\/tutoring\/classes\/[^/]+$/.test(url)) {
      return tutorClassDeleteResponse ?? mockJsonResponse({});
    }

    if (method === "GET" && /\/api\/tutoring\/classes\/[^/]+\/feedback$/.test(url)) {
      return mockJsonResponse(tutorFeedbacks);
    }
    if (method === "POST" && /\/api\/tutoring\/classes\/[^/]+\/feedback$/.test(url)) {
      return tutorFeedbackPost ?? mockJsonResponse({});
    }

    const groupIdMatch = url.match(/\/api\/groups\/([^/]+)$/);
    if (groupIdMatch) {
      const detail = groupDetails[groupIdMatch[1]];
      return detail ? mockJsonResponse(detail) : mockJsonResponse({}, false, 404);
    }

    return mockJsonResponse({});
  });
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
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
    renderHome();
    expect(screen.getByRole("heading", { name: /study smarter with peers/i })).toBeInTheDocument();
  });

  it("renders 4 feature cards for guests", () => {
    renderHome();

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

    renderHome();

    expect(await screen.findByRole("heading", { name: /^study groups$/i })).toBeInTheDocument();
    expect(screen.getByText(/discover, create, and join study groups/i)).toBeInTheDocument();
    expect(screen.getByText(/no groups found\. create one to get started!/i)).toBeInTheDocument();
  });

  it("opens the peer tutoring tab from the dashboard", async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    renderHome();

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));

    expect(await screen.findByText(/select your role above to get started with peer tutoring/i)).toBeInTheDocument();
  });

  it("shows the tutor dashboard empty state in peer tutoring", async () => {
    const user = userEvent.setup({ delay: null });
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

    renderHome();

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));

    expect(await screen.findByRole("heading", { name: /tutor dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/no classes yet\. create one to start tutoring!/i)).toBeInTheDocument();
  });

  it("shows available classes in the tutee dashboard", async () => {
    const user = userEvent.setup({ delay: null });
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

    renderHome();

    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));

    expect(await screen.findByRole("heading", { name: /tutee dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/math revision sprint/i)).toBeInTheDocument();
    expect(screen.getByText(/jamie tan/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^join$/i })).toBeInTheDocument();
  });

  /* ── Tutor feedback view helpers ── */

  it("creates a tutor group and shows a success toast", async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [],
      tutorClassCreateResponse: mockJsonResponse({
        id: 21,
        title: "CS2030 Weekly Tutoring",
        moduleCode: "CS2030",
        schedule: "Every Sat 2-4pm",
        mode: "online",
        meetingLink: "https://teams.microsoft.com/l/meetup-join/new-class",
        maxStudents: 5,
        enrolledCount: 0,
        isTutor: true,
      }),
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /create class/i }));

    await user.type(screen.getByLabelText(/class title/i), "CS2030 Weekly Tutoring");
    await user.type(screen.getByLabelText(/module code/i), "CS2030");
    await user.type(screen.getByLabelText(/meeting link/i), "https://teams.microsoft.com/l/meetup-join/new-class");
    await user.type(screen.getByLabelText(/^schedule/i), "Every Sat 2-4pm");
    await user.click(screen.getByRole("button", { name: /^create class$/i }));

    expect(await screen.findByText(/tutor group created successfully/i)).toBeInTheDocument();
    const createCall = fetchSpy.mock.calls.find(([url, opts]) =>
      /\/api\/tutoring\/classes$/.test(String(url)) && (opts?.method || "").toUpperCase() === "POST"
    );
    expect(createCall).toBeTruthy();
  });

  it("joins a tutor group and shows a success toast", async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
      classes: [{
        id: 31,
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
      }],
      tutorClassEnrollResponse: mockJsonResponse({ message: "ok" }),
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));
    await user.click(await screen.findByRole("button", { name: /^join$/i }));

    expect(await screen.findByText(/joined tutor group successfully/i)).toBeInTheDocument();
    const enrollCall = fetchSpy.mock.calls.find(([url, opts]) =>
      /\/api\/tutoring\/classes\/31\/enroll$/.test(String(url)) && (opts?.method || "").toUpperCase() === "POST"
    );
    expect(enrollCall).toBeTruthy();
  });

  it("leaves a tutor group and shows a success toast", async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
      classes: [{
        id: 11,
        title: "CS2030 Tutoring",
        moduleCode: "CS2030",
        tutorId: "tutor-1",
        tutorName: "Jamie Tan",
        tutorEmail: "jamie@u.nus.edu",
        mode: "online",
        meetingLink: "https://teams.microsoft.com/l/meetup-join/tutee-a",
        enrolled: true,
        enrolledCount: 1,
        maxStudents: 5,
        isTutor: false,
      }],
      tutorClassLeaveResponse: mockJsonResponse({ message: "ok" }),
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });

    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));
    await user.click(await screen.findByRole("button", { name: /^leave$/i }));

    expect(await screen.findByText(/left tutor group successfully/i)).toBeInTheDocument();
    const leaveCall = fetchSpy.mock.calls.find(([url, opts]) =>
      /\/api\/tutoring\/classes\/11\/leave$/.test(String(url)) && (opts?.method || "").toUpperCase() === "POST"
    );
    expect(leaveCall).toBeTruthy();
  });

  it("deletes a tutor group through the confirmation modal and shows a success toast", async () => {
    const user = userEvent.setup({ delay: null });
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [{
        id: 7,
        title: "Math Revision Sprint",
        moduleCode: "MA1521",
        topic: "Calculus",
        mode: "online",
        meetingLink: "https://teams.microsoft.com/l/meetup-join/tutor-a",
        enrolledCount: 2,
        maxStudents: 6,
        isTutor: true,
      }],
      tutorClassDeleteResponse: mockJsonResponse({ message: "ok" }),
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/are you sure you want to delete this tutoring class/i)).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/tutor group deleted successfully/i)).toBeInTheDocument();
    const deleteCall = fetchSpy.mock.calls.find(([url, opts]) =>
      /\/api\/tutoring\/classes\/7$/.test(String(url)) && (opts?.method || "").toUpperCase() === "DELETE"
    );
    expect(deleteCall).toBeTruthy();
  });

  const TUTOR_CLASS_A = {
    id: 7,
    title: "Math Revision Sprint",
    moduleCode: "MA1521",
    topic: "Calculus",
    mode: "online",
    meetingLink: "https://teams.microsoft.com/l/meetup-join/tutor-a",
    enrolledCount: 2,
    maxStudents: 6,
    isTutor: true,
  };

  const TUTOR_CLASS_B = {
    id: 8,
    title: "Physics Drill",
    moduleCode: "PC1141",
    topic: "Mechanics",
    mode: "online",
    enrolledCount: 1,
    maxStudents: 6,
    isTutor: true,
  };

  const SAMPLE_FEEDBACK = {
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
  };

  async function openTutorFeedbackModal(user, { tutorClass = TUTOR_CLASS_A, feedbacks = [SAMPLE_FEEDBACK] } = {}) {
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [tutorClass],
      tutorFeedbacks: feedbacks,
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /view feedbacks/i }));
    expect(await screen.findByRole("heading", { name: /submitted feedbacks/i })).toBeInTheDocument();
  }

  async function openCreateClassModal(user, account = { username: "tutor@hotmail.com", name: "Tutor User" }) {
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [account],
    });

    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /create class/i }));
  }

  it("shows View Feedbacks button on each tutor class card", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [TUTOR_CLASS_A, TUTOR_CLASS_B],
      tutorFeedbacks: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));

    expect(await screen.findByText(/math revision sprint/i)).toBeInTheDocument();
    expect(screen.getByText(/physics drill/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /view feedbacks/i })).toHaveLength(2);
  });

  it("opens the tutor meeting link from the tutor dashboard", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    mockDashboardFetch({
      profile: { firstName: "Tutor", lastName: "User" },
      groups: [],
      classes: [TUTOR_CLASS_A],
      tutorFeedbacks: [],
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /view meeting link/i }));

    expect(openSpy).toHaveBeenCalledWith(TUTOR_CLASS_A.meetingLink, "_blank", "noopener,noreferrer");
  });

  it("shows the Teams Free meeting-link flow when creating a class", async () => {
    const user = userEvent.setup({ delay: null });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    await openCreateClassModal(user);

    expect(screen.getByRole("button", { name: /open teams free/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/auto-generate teams link/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open teams free/i }));

    expect(openSpy).toHaveBeenCalledWith("https://teams.live.com/", "_blank", "noopener,noreferrer");
    expect(screen.getAllByText(/open teams free, create the meeting there, then paste the join link below/i).length).toBeGreaterThan(0);
  });

  it("shows empty state when no feedbacks have been submitted for the class", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const user = userEvent.setup({ delay: null });
    await openTutorFeedbackModal(user, { feedbacks: [] });
    expect(screen.getByText(/no feedbacks have been submitted for this class yet/i)).toBeInTheDocument();
  });

  it("shows the class title in the feedback modal heading", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const user = userEvent.setup({ delay: null });
    await openTutorFeedbackModal(user);
    expect(screen.getByRole("heading", { name: /submitted feedbacks.*math revision sprint/i })).toBeInTheDocument();
  });

  it("loads feedbacks for the correct class when multiple classes exist", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.endsWith("/api/users/me")) return mockJsonResponse({ firstName: "Tutor", lastName: "User" });
      if (url.endsWith("/api/profile")) return mockJsonResponse({}, false, 404);
      if (url.endsWith("/api/groups")) return mockJsonResponse([]);
      if (url.endsWith("/api/tutoring/classes")) return mockJsonResponse([TUTOR_CLASS_A, TUTOR_CLASS_B]);
      if (/\/api\/tutoring\/classes\/7\/feedback$/.test(url)) return mockJsonResponse([SAMPLE_FEEDBACK]);
      if (/\/api\/tutoring\/classes\/8\/feedback$/.test(url)) return mockJsonResponse([]);
      return mockJsonResponse({});
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));

    const cards = await screen.findAllByRole("button", { name: /view feedbacks/i });
    // Click "View Feedbacks" on Physics Drill (second card)
    await user.click(cards[1]);

    expect(await screen.findByRole("heading", { name: /submitted feedbacks.*physics drill/i })).toBeInTheDocument();
    expect(screen.getByText(/no feedbacks have been submitted for this class yet/i)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringMatching(/\/api\/tutoring\/classes\/8\/feedback$/), expect.anything());
  });

  it("shows all rating categories when a feedback entry is selected", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const user = userEvent.setup({ delay: null });
    await openTutorFeedbackModal(user);
    await user.click(screen.getByRole("button", { name: /alex lee/i }));

    for (const label of ["Overall Rating", "Preparedness", "Communication", "Helpfulness", "Reliability"]) {
      expect(screen.getByText(new RegExp(label, "i"))).toBeInTheDocument();
    }
    expect(screen.getByText(/clear explanations/i)).toBeInTheDocument();
    expect(screen.getByText(/could share more practice questions/i)).toBeInTheDocument();
  });

  it("shows an error message when feedback loading fails", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.endsWith("/api/users/me")) return mockJsonResponse({ firstName: "Tutor", lastName: "User" });
      if (url.endsWith("/api/profile")) return mockJsonResponse({}, false, 404);
      if (url.endsWith("/api/groups")) return mockJsonResponse([]);
      if (url.endsWith("/api/tutoring/classes")) return mockJsonResponse([TUTOR_CLASS_A]);
      if (/\/api\/tutoring\/classes\/7\/feedback$/.test(url)) return mockJsonResponse({ error: "Internal server error" }, false, 500);
      return mockJsonResponse({});
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "tutor@hotmail.com", name: "Tutor User" }],
    });

    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutor/i }));
    await user.click(await screen.findByRole("button", { name: /view feedbacks/i }));

    expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
  });

  it("lets tutors open submitted feedbacks and inspect a selected entry", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const user = userEvent.setup({ delay: null });
    await openTutorFeedbackModal(user);
    await user.click(screen.getByRole("button", { name: /alex lee/i }));

    expect(screen.getByText(/clear explanations/i)).toBeInTheDocument();
    expect(screen.getByText(/could share more practice questions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5\/5/i).length).toBeGreaterThan(0);
  });

  /* ── Tutee feedback flow ── */

  const ENROLLED_CLASS = {
    id: 11,
    title: "CS2030 Tutoring",
    moduleCode: "CS2030",
    tutorId: "tutor-1",
    tutorName: "Jamie Tan",
    tutorEmail: "jamie@u.nus.edu",
    mode: "online",
    meetingLink: "https://teams.microsoft.com/l/meetup-join/tutee-a",
    enrolled: true,
    enrolledCount: 1,
    maxStudents: 5,
    isTutor: false,
  };

  function setupTuteeEnv({ tutorFeedbackPost = null } = {}) {
    const spy = mockDashboardFetch({
      profile: { firstName: "Test", lastName: "Student" },
      groups: [],
      classes: [ENROLLED_CLASS],
      tutorFeedbackPost,
    });
    useMsal.mockReturnValue({
      instance: { logoutRedirect: vi.fn() },
      accounts: [{ username: "test@hotmail.com", name: "Test Student" }],
    });
    return spy;
  }

  async function openTuteeClassFeedbackForm(user) {
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));
    await user.click(await screen.findByRole("button", { name: /^feedback$/i }));
    expect(await screen.findByRole("heading", { name: /peer feedback/i })).toBeInTheDocument();
  }

  async function completeTutoringFeedbackForm(user, {
    overallRating = 4,
    preparedness = 4,
    communication = 5,
    helpfulness = 4,
    reliability = 3,
    strengths = "Explains concepts clearly.",
    improvements = "Could prepare examples earlier.",
    anonymousToPeer = true,
  } = {}) {
    const comboboxes = screen.queryAllByRole("combobox");
    if (comboboxes.length > 0) {
      for (const combobox of comboboxes) {
        try {
          await user.selectOptions(combobox, "Jamie Tan");
        } catch {
          // ignore
        }
      }
    }

    for (const [label, value] of [
      ["Overall Rating", overallRating],
      ["Preparedness", preparedness],
      ["Communication", communication],
      ["Helpfulness", helpfulness],
      ["Reliability", reliability],
    ]) {
      const group = screen.getByRole("group", { name: new RegExp(label, "i") });
      await user.click(within(group).getByRole("button", { name: new RegExp(`rate ${value} stars?`, "i") }));
    }
    const strengthsInput = screen.getByLabelText(/^strengths$/i);
    await user.clear(strengthsInput);
    await user.type(strengthsInput, strengths);
    const improvementsInput = screen.getByLabelText(/areas for improvement/i);
    await user.clear(improvementsInput);
    await user.type(improvementsInput, improvements);
    const checkbox = screen.getByRole("checkbox", { name: /submit anonymously/i });
    if (anonymousToPeer !== checkbox.checked) await user.click(checkbox);
  }

  it("opens the feedback form when Feedback is clicked on an enrolled tutoring class", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    setupTuteeEnv();
    const user = userEvent.setup({ delay: null });
    await openTuteeClassFeedbackForm(user);
    // Jamie Tan appears in both the card and the select option — check the option specifically
    expect(screen.getByRole("option", { name: /jamie tan/i })).toBeInTheDocument();
  });

  it("opens the meeting link from the tutee dashboard", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    setupTuteeEnv();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(await screen.findByRole("button", { name: /peer tutoring/i }));
    await user.click(screen.getByRole("button", { name: /i'm a tutee/i }));
    await user.click(await screen.findByRole("button", { name: /view meeting link/i }));

    expect(openSpy).toHaveBeenCalledWith(ENROLLED_CLASS.meetingLink, "_blank", "noopener,noreferrer");
  });

  it("submits tutoring feedback with the expected payload", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const fetchSpy = setupTuteeEnv({
      tutorFeedbackPost: mockJsonResponse({ id: "fb-1", revieweeName: "Jamie Tan" }),
    });

    const user = userEvent.setup({ delay: null });
    await openTuteeClassFeedbackForm(user);
    await completeTutoringFeedbackForm(user);
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByText(/feedback submitted successfully/i)).toBeInTheDocument();
    const feedbackCall = fetchSpy.mock.calls.find(([url, opts]) =>
      /\/api\/tutoring\/classes\/11\/feedback$/.test(String(url)) && (opts?.method || "").toUpperCase() === "POST"
    );
    expect(feedbackCall).toBeTruthy();
    expect(JSON.parse(feedbackCall[1].body)).toMatchObject({
      revieweeId: "tutor-1",
      overallRating: 4,
      preparedness: 4,
      communication: 5,
      helpfulness: 4,
      reliability: 3,
      strengths: "Explains concepts clearly.",
      improvements: "Could prepare examples earlier.",
      anonymousToPeer: true,
    });
  });

  it("shows backend error message on rejected tutoring feedback submission", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    setupTuteeEnv({
      tutorFeedbackPost: mockJsonResponse({ error: "You have already submitted feedback for this session." }, false, 409),
    });

    const user = userEvent.setup({ delay: null });
    await openTuteeClassFeedbackForm(user);
    await completeTutoringFeedbackForm(user, { anonymousToPeer: false });
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByText(/you have already submitted feedback for this session/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved locally for demo purposes/i)).not.toBeInTheDocument();
  });

  it("shows 404 error message instead of treating it as backend unavailable", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    setupTuteeEnv({
      tutorFeedbackPost: mockJsonResponse({ error: "Tutoring class or peer could not be found." }, false, 404),
    });

    const user = userEvent.setup({ delay: null });
    await openTuteeClassFeedbackForm(user);
    await completeTutoringFeedbackForm(user, { anonymousToPeer: false });
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByText(/tutoring class or peer could not be found/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved locally for demo purposes/i)).not.toBeInTheDocument();
  });

  it("hides reviewer identity for anonymous feedback", async () => {
    localStorage.setItem("accessToken", makeAccessToken());
    const user = userEvent.setup({ delay: null });
    await openTutorFeedbackModal(user, {
      tutorClass: TUTOR_CLASS_B,
      feedbacks: [{
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
      }],
    });

    expect((await screen.findAllByText(/^anonymous$/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/submitted anonymously/i)).toBeInTheDocument();
    expect(screen.queryByText(/hidden student/i)).not.toBeInTheDocument();
  });
});
