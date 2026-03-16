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

async function openFeedbackForm(user, groupId = "g1", sessionId = "s1") {
  render(<Home />);

  await screen.findByRole("heading", { name: /study groups/i });
  await user.click(screen.getByRole("button", { name: /peer tutoring/i }));

  const groupSelect = await screen.findByLabelText(/study group/i);
  const sessionSelect = screen.getByLabelText(/scheduled session/i);

  await user.selectOptions(groupSelect, groupId);
  await user.selectOptions(sessionSelect, sessionId);
  await user.click(screen.getByRole("button", { name: /continue/i }));

  expect(await screen.findByRole("heading", { name: /give feedback/i })).toBeInTheDocument();
}

async function completeFeedbackForm(user, {
  revieweeId = "peer-1",
  overallRating = 4,
  preparedness = "4",
  communication = "5",
  helpfulness = "4",
  reliability = "3",
  strengths = "  Explains concepts clearly.  ",
  improvements = "  Could prepare examples earlier.  ",
  anonymousToPeer = true,
} = {}) {
  await user.selectOptions(screen.getByLabelText(/select peer to review/i), revieweeId);

  await user.click(screen.getByRole("button", { name: new RegExp(`rate ${overallRating} star`, "i") }));
  await user.click(document.querySelector(`input[name="preparedness"][value="${preparedness}"]`));
  await user.click(document.querySelector(`input[name="communication"][value="${communication}"]`));
  await user.click(document.querySelector(`input[name="helpfulness"][value="${helpfulness}"]`));
  await user.click(document.querySelector(`input[name="reliability"][value="${reliability}"]`));

  await user.type(screen.getByLabelText(/what went well\?/i), strengths);
  await user.type(screen.getByLabelText(/suggestions for improvement/i), improvements);

  const anonymousCheckbox = screen.getByRole("checkbox", { name: /anonymous to peer/i });
  if (anonymousToPeer && !anonymousCheckbox.checked) {
    await user.click(anonymousCheckbox);
  }
  if (!anonymousToPeer && anonymousCheckbox.checked) {
    await user.click(anonymousCheckbox);
  }
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

  it("submits peer feedback to the selected group and session with the expected payload", async () => {
    localStorage.setItem("accessToken", createAccessToken());

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      if (url.endsWith("/api/users/me")) {
        return createFetchResponse({ firstName: "Test", lastName: "User" });
      }
      if (url.endsWith("/api/profile")) {
        return createFetchResponse({}, false, 404);
      }
      if (url.endsWith("/api/groups")) {
        return createFetchResponse([{ id: "g1", name: "Algo Group", joined: true }]);
      }
      if (url.endsWith("/api/groups/g1")) {
        return createFetchResponse({
          id: "g1",
          name: "Algo Group",
          members: [
            { userId: "peer-1", email: "peer1@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "One" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [{ id: "s1", title: "Week 5 Review", startsAt: "2026-03-20T10:00:00" }],
        });
      }
      if (url.endsWith("/api/groups/g1/sessions/s1/feedback")) {
        expect(options.method).toBe("POST");
        expect(options.headers).toMatchObject({
          "Content-Type": "application/json",
          Authorization: expect.stringMatching(/^Bearer /),
        });
        expect(JSON.parse(options.body)).toEqual({
          sessionId: "s1",
          groupId: "g1",
          revieweeId: "peer-1",
          overallRating: 4,
          preparedness: 4,
          communication: 5,
          helpfulness: 4,
          reliability: 3,
          strengths: "Explains concepts clearly.",
          improvements: "Could prepare examples earlier.",
          anonymousToPeer: true,
        });

        return createFetchResponse({ id: "fb-1", revieweeName: "Peer One" }, true, 200);
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    await openFeedbackForm(user);
    await completeFeedbackForm(user);
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByText(/feedback submitted successfully/i)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/groups\/g1\/sessions\/s1\/feedback$/),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the backend error message instead of silently falling back to a local draft when submission is rejected", async () => {
    localStorage.setItem("accessToken", createAccessToken());

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.endsWith("/api/users/me")) {
        return createFetchResponse({ firstName: "Test", lastName: "User" });
      }
      if (url.endsWith("/api/profile")) {
        return createFetchResponse({}, false, 404);
      }
      if (url.endsWith("/api/groups")) {
        return createFetchResponse([{ id: "g1", name: "Algo Group", joined: true }]);
      }
      if (url.endsWith("/api/groups/g1")) {
        return createFetchResponse({
          id: "g1",
          name: "Algo Group",
          members: [
            { userId: "peer-1", email: "peer1@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "One" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [{ id: "s1", title: "Week 5 Review", startsAt: "2026-03-20T10:00:00" }],
        });
      }
      if (url.endsWith("/api/groups/g1/sessions/s1/feedback")) {
        return createFetchResponse(
          { error: "You have already submitted feedback for this peer in this session." },
          false,
          409,
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    await openFeedbackForm(user);
    await completeFeedbackForm(user, { anonymousToPeer: false });
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(
      await screen.findByText(/you have already submitted feedback for this peer in this session/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/saved locally for demo purposes/i)).not.toBeInTheDocument();

    const savedDrafts = JSON.parse(localStorage.getItem("peerconnect-feedback-drafts") || "{}");
    expect(savedDrafts["s1::peer-1"]).toBeUndefined();
  });

  it("shows a 404 backend error message instead of treating it as backend unavailable", async () => {
    localStorage.setItem("accessToken", createAccessToken());

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.endsWith("/api/users/me")) {
        return createFetchResponse({ firstName: "Test", lastName: "User" });
      }
      if (url.endsWith("/api/profile")) {
        return createFetchResponse({}, false, 404);
      }
      if (url.endsWith("/api/groups")) {
        return createFetchResponse([{ id: "g1", name: "Algo Group", joined: true }]);
      }
      if (url.endsWith("/api/groups/g1")) {
        return createFetchResponse({
          id: "g1",
          name: "Algo Group",
          members: [
            { userId: "peer-1", email: "peer1@u.nus.edu", membershipStatus: "approved", firstName: "Peer", lastName: "One" },
            { userId: "self", email: "student@u.nus.edu", membershipStatus: "approved", firstName: "Student", lastName: "User" },
          ],
          sessions: [{ id: "s1", title: "Week 5 Review", startsAt: "2026-03-20T10:00:00" }],
        });
      }
      if (url.endsWith("/api/groups/g1/sessions/s1/feedback")) {
        return createFetchResponse(
          { error: "Study group, session, or peer could not be found." },
          false,
          404,
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    await openFeedbackForm(user);
    await completeFeedbackForm(user, { anonymousToPeer: false });
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(
      await screen.findByText(/study group, session, or peer could not be found/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/saved locally for demo purposes/i)).not.toBeInTheDocument();

    const savedDrafts = JSON.parse(localStorage.getItem("peerconnect-feedback-drafts") || "{}");
    expect(savedDrafts["s1::peer-1"]).toBeUndefined();
  });
});
