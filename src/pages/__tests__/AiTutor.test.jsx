import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AiTutor from "../AiTutor";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

function installFetchMock({
  profile = {},
  classes = [],
  groups = [],
  groupsSequence,
  restrictedUsers = [],
  aiReplies = [],
} = {}) {
  const aiCalls = [];
  const queuedGroupResponses = Array.isArray(groupsSequence) ? [...groupsSequence] : null;

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.endsWith("/api/profile")) {
      return mockJsonResponse(profile);
    }

    if (method === "GET" && url.endsWith("/api/tutoring/classes")) {
      return mockJsonResponse(classes);
    }

    if (method === "GET" && url.endsWith("/api/groups")) {
      const nextGroups = queuedGroupResponses ? queuedGroupResponses.shift() ?? groups : groups;
      return mockJsonResponse(nextGroups);
    }

    if (method === "GET" && /\/api\/groups\/[^/]+$/.test(url)) {
      const groupId = url.split("/").pop();
      const group = groups.find((item) => String(item.id) === String(groupId));
      return mockJsonResponse(group ?? {}, Boolean(group), group ? 200 : 404);
    }

    if (method === "GET" && url.endsWith("/api/restricted-users")) {
      return mockJsonResponse(restrictedUsers);
    }

    if (method === "POST" && url.endsWith("/api/ai-tutor/chat")) {
      const payload = JSON.parse(init.body);
      aiCalls.push(payload);
      const nextReply = aiReplies.shift() ?? { reply: "Default reply" };
      return mockJsonResponse(nextReply);
    }

    return mockJsonResponse({});
  });

  return { aiCalls };
}

function renderAiTutor() {
  return render(
    <MemoryRouter>
      <AiTutor embedded />
    </MemoryRouter>
  );
}

async function waitForInitialContextLoads() {
  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/profile"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tutoring/classes"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/groups"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/restricted-users"),
      expect.objectContaining({ credentials: "include" })
    );
  });
}

async function clickSkipContext(user) {
  await user.click(await screen.findByRole("button", { name: /skip/i }));
}

describe("AiTutor", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
    Element.prototype.scrollTo = vi.fn();
  });

  it("includes restricted members in the AI chat system context", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: { faculty: "Computing", major: "Computer Science" },
      restrictedUsers: [
        {
          restrictedUserId: "blocked-1",
          firstName: "Blocked",
          lastName: "User",
          email: "blocked@u.nus.edu",
          createdAt: "2026-03-20T10:00:00",
        },
      ],
      aiReplies: [{ reply: "You have 1 restricted member." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Who have I restricted?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));

    const systemContext = aiCalls[0].history[0].content;
    expect(systemContext).toContain("## User's Restricted Members");
    expect(systemContext).toContain("Blocked User");
    expect(systemContext).toContain("blocked@u.nus.edu");
    expect(systemContext).toContain("restricted users cannot join the user's groups until allowed again");
    expect(await screen.findByText(/you have 1 restricted member/i)).toBeInTheDocument();
  });

  it("treats approved study-group memberships as joined even when the joined flag is missing", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 101,
          name: "Database Study Circle",
          moduleCode: "CS2102",
          description: "Weekly SQL practice",
          membershipStatus: "approved",
          memberCount: 5,
          maxMembers: 8,
        },
      ],
      aiReplies: [{ reply: "You are in Database Study Circle." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What should I study next?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));

    const systemContext = aiCalls[0].history[0].content;
    expect(systemContext).toContain("## Study Groups the User Has Joined (as member)");
    expect(systemContext).toContain("Database Study Circle");
    expect(systemContext).toContain("## Other Available Study Groups (user has NOT joined)");
    expect(systemContext).toContain("No other available study groups found in the current context.");
    expect(systemContext).toContain("do not say the user has not joined any study groups");
    expect(await screen.findByText(/database study circle/i)).toBeInTheDocument();
  });

  it("sends joined study-group questions to the AI with study-group context", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 201,
          name: "Algorithms Marathon",
          moduleCode: "CS2040",
          topic: "Graphs",
          membershipStatus: "approved",
          preferredSchedule: "Every Tuesday 7pm",
          description: "Weekly problem solving",
        },
        {
          id: 202,
          name: "Database Admin Circle",
          moduleCode: "CS2102",
          isAdmin: true,
          preferredSchedule: "Friday 5pm",
        },
      ],
      aiReplies: [{ reply: "You have joined Algorithms Marathon." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Tell me about study groups I have joined");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("Tell me about study groups I have joined");
    expect(aiCalls[0].history[0].content).toContain("Algorithms Marathon");
    expect(aiCalls[0].history[0].content).toContain("Database Admin Circle");
    expect(aiCalls[0].history[0].content).toContain("## Other Available Study Groups (user has NOT joined)");
    expect(aiCalls[0].history[0].content).toContain("No other available study groups found in the current context.");
    expect(await screen.findByText(/you have joined algorithms marathon/i)).toBeInTheDocument();
  });

  it("detects generic 'my groups' phrasing as study-group context when it is not peer tutoring", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 2201,
          name: "Algorithms Marathon",
          moduleCode: "CS2040",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "Algorithms Marathon is one of your groups." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What groups do I have?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[0].content).toContain("## Study Groups the User Has Joined (as member)");
    expect(aiCalls[0].history[1].content).toContain("The user's question is about study groups.");
    expect(await screen.findByText(/algorithms marathon is one of your groups/i)).toBeInTheDocument();
  });

  it("detects generic joinable-groups phrasing as available study-group context", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 2202,
          name: "Security Fundamentals",
          moduleCode: "CS2107",
        },
      ],
      aiReplies: [{ reply: "You can join Security Fundamentals." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What groups can I join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[1].content).toContain("Answer ONLY from the 'Other Available Study Groups (user has NOT joined)' section");
    expect(aiCalls[0].history[2].content).toContain("the available study groups the user can still join are listed below");
    expect(aiCalls[0].history[2].content).toContain("Security Fundamentals");
    expect(await screen.findByText(/you can join security fundamentals/i)).toBeInTheDocument();
  });

  it("refetches study groups for the first study-group chat request when initial state is still empty", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groupsSequence: [
        [],
        [
          {
            id: 2203,
            name: "Security Fundamentals",
            moduleCode: "CS2107",
          },
        ],
      ],
      aiReplies: [{ reply: "You can join Security Fundamentals." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What study groups can I join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/groups"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(aiCalls[0].history[0].content).toContain("## Other Available Study Groups (user has NOT joined)");
    expect(aiCalls[0].history[0].content).toContain("Security Fundamentals");
    expect(aiCalls[0].history[2].content).toContain("Security Fundamentals");
    expect(await screen.findByText(/you can join security fundamentals/i)).toBeInTheDocument();
  });

  it("sends managed study-group questions to the AI", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 301,
          name: "Operating Systems Leaders",
          moduleCode: "CS2106",
          isAdmin: true,
          preferredSchedule: "Monday 6pm",
        },
        {
          id: 302,
          name: "Networks Review",
          moduleCode: "CS2105",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "You manage Operating Systems Leaders." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups do I manage?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("Which study groups do I manage?");
    expect(aiCalls[0].history[0].content).toContain("Operating Systems Leaders");
    expect(await screen.findByText(/you manage operating systems leaders/i)).toBeInTheDocument();
  });

  it("sends not-joined study-group questions to the AI", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 401,
          name: "Python Developers",
          moduleCode: "CS0034",
          membershipStatus: "approved",
        },
        {
          id: 402,
          name: "AWS Cloud Exam Practise",
          moduleCode: "AWS001",
          membershipStatus: "pending",
        },
        {
          id: 403,
          name: "Security Fundamentals",
          moduleCode: "CS2107",
          topic: "Security",
        },
      ],
      aiReplies: [{ reply: "You have not joined Security Fundamentals yet." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What study groups i have not joined?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("What study groups i have not joined?");
    expect(aiCalls[0].history[0].content).toContain("Security Fundamentals");
    expect(await screen.findByText(/you have not joined security fundamentals yet/i)).toBeInTheDocument();
  });

  it("sends broader negative join phrasing to the AI", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 601,
          name: "Joined Group",
          moduleCode: "CS1010",
          membershipStatus: "approved",
        },
        {
          id: 602,
          name: "Open Group",
          moduleCode: "CS2030",
        },
      ],
      aiReplies: [{ reply: "Open Group is still available for you." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups did I not join yet?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("Which study groups did I not join yet?");
    expect(await screen.findByText(/open group is still available for you/i)).toBeInTheDocument();
  });

  it("adds an available-groups instruction for 'can I join' study-group questions", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 1001,
          name: "AWS Cloud Exam Practise",
          moduleCode: "AWS001",
          membershipStatus: "pending",
        },
        {
          id: 1002,
          name: "Security Fundamentals",
          moduleCode: "CS2107",
        },
      ],
      aiReplies: [{ reply: "You can join Security Fundamentals." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What study groups can i join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[1].content).toContain("Answer ONLY from the 'Other Available Study Groups (user has NOT joined)' section");
    expect(aiCalls[0].history[1].content).toContain("Do NOT list joined groups, managed groups, or pending requests as groups the user can join");
    expect(await screen.findByText(/you can join security fundamentals/i)).toBeInTheDocument();
  });

  it("tells the AI to list actual available groups instead of generic navigation steps", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 1101,
          name: "Security Fundamentals",
          moduleCode: "CS2107",
        },
      ],
      aiReplies: [{ reply: "You can join Security Fundamentals." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Suggest study groups i can join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[1].content).toContain("If available groups are listed, name those actual groups directly");
    expect(aiCalls[0].history[1].content).toContain("Only give navigation or browsing advice if that available-groups section explicitly says no groups were found in the current context");
    expect(await screen.findByText(/you can join security fundamentals/i)).toBeInTheDocument();
  });

  it("sends pending study-group questions to the AI", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 501,
          name: "AWS Cloud Exam Practise",
          moduleCode: "AWS001",
          membershipStatus: "pending",
        },
        {
          id: 502,
          name: "Testing Group",
          moduleCode: "CS1010",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "AWS Cloud Exam Practise is awaiting approval." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups are awaiting approval?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("Which study groups are awaiting approval?");
    expect(aiCalls[0].history[0].content).toContain("AWS Cloud Exam Practise");
    expect(await screen.findByText(/aws cloud exam practise is awaiting approval/i)).toBeInTheDocument();
  });

  it("adds a study-group focus instruction so study-group questions do not drift to profile details", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: { major: "History" },
      groups: [
        {
          id: 801,
          name: "Algorithms Marathon",
          moduleCode: "CS2040",
          topic: "Graphs",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "Try graph traversal, shortest paths, and MSTs for Algorithms Marathon." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Suggest topics for my study groups");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[1].content).toContain("The user's question is about study groups.");
    expect(aiCalls[0].history[1].content).toContain("profile details should only be mentioned if directly needed");
    expect(await screen.findByText(/graph traversal, shortest paths, and msts/i)).toBeInTheDocument();
  });

  it("adds a profile focus instruction that tells the AI to use profile details already in context", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: {
        faculty: "Arts and Social Sciences",
        major: "History",
        yearOfStudy: 2,
        bio: "Interested in Southeast Asian history",
      },
      aiReplies: [{ reply: "Based on your History profile, try historiography, archival research, and Southeast Asian history." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Suggest topics based on my profile?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[0].content).toContain("## User Profile");
    expect(aiCalls[0].history[0].content).toContain("Major: History");
    expect(aiCalls[0].history[1].content).toContain("The user's question is about their profile.");
    expect(aiCalls[0].history[1].content).toContain("do not ask the user to provide them again");
    expect(await screen.findByText(/based on your history profile/i)).toBeInTheDocument();
  });

  it("scopes buildSystemContext to the detected profile topic", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: {
        faculty: "Arts and Social Sciences",
        major: "History",
      },
      groups: [
        {
          id: 901,
          name: "Algorithms Marathon",
          moduleCode: "CS2040",
          membershipStatus: "approved",
        },
      ],
      restrictedUsers: [
        { firstName: "Blocked", lastName: "User", email: "blocked@u.nus.edu" },
      ],
      classes: [
        {
          id: 1,
          title: "CS2100 Help",
          moduleCode: "CS2100",
          isTutor: true,
        },
      ],
      aiReplies: [{ reply: "Your profile shows History." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What is in my profile?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[0].content).toContain("## User Profile");
    expect(aiCalls[0].history[0].content).not.toContain("## Study Groups the User Has Joined");
    expect(aiCalls[0].history[0].content).not.toContain("## User's Peer Tutoring Classes");
    expect(aiCalls[0].history[0].content).not.toContain("## User's Restricted Members");
  });

  it("refetches profile on demand for profile questions when profile state is not ready yet", async () => {
    const user = userEvent.setup({ delay: null });
    const aiCalls = [];
    let profileCallCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.endsWith("/api/profile")) {
        profileCallCount += 1;
        if (profileCallCount === 1) {
          return new Promise(() => {});
        }
        return mockJsonResponse({ faculty: "Arts and Social Sciences", major: "History" });
      }

      if (method === "GET" && url.endsWith("/api/tutoring/classes")) return mockJsonResponse([]);
      if (method === "GET" && url.endsWith("/api/groups")) return mockJsonResponse([]);
      if (method === "GET" && url.endsWith("/api/restricted-users")) return mockJsonResponse([]);

      if (method === "POST" && url.endsWith("/api/ai-tutor/chat")) {
        const payload = JSON.parse(init.body);
        aiCalls.push(payload);
        return mockJsonResponse({ reply: "Your profile shows History." });
      }

      return mockJsonResponse({});
    });

    renderAiTutor();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What is in my profile?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(profileCallCount).toBeGreaterThanOrEqual(2);
    expect(aiCalls[0].history[0].content).toContain("## User Profile");
    expect(aiCalls[0].history[0].content).toContain("Major: History");
  });

  it("detects profile and restricted-member topics for chat context routing", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: { major: "History" },
      restrictedUsers: [
        { firstName: "Blocked", lastName: "User", email: "blocked@u.nus.edu" },
      ],
      aiReplies: [
        { reply: "Your profile shows History." },
        { reply: "You have Blocked User restricted." },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What is in my profile?");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[1].content).toContain("The user's question is about their profile.");

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Who have I restricted?");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    expect(aiCalls[1].history[1].content).toContain("The user's question is about restricted members.");
  });

  it("does not hijack peer-tutoring prompts that mention groups", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 701,
          name: "Study Group That Should Not Be Returned",
          moduleCode: "CS2040",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "Here are topic suggestions for your peer tutoring classes." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Suggest topics for my peer tutor groups");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("Suggest topics for my peer tutoring classes");
    expect(await screen.findByText(/topic suggestions for your peer tutoring classes/i)).toBeInTheDocument();
    expect(screen.queryByText(/study groups you have joined/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/study group that should not be returned/i)).not.toBeInTheDocument();
  });

  it("always includes a peer-tutoring context section for peer-tutoring questions", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      classes: [],
      aiReplies: [{ reply: "No peer tutoring classes were found in your current context." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What peer tutoring groups do i have?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("What peer tutoring classes do i have?");
    expect(aiCalls[0].history[0].content).toContain("## User's Peer Tutoring Classes");
    expect(aiCalls[0].history[0].content).toContain("No peer tutoring classes found in the current context.");
    expect(aiCalls[0].history[0].content).toContain("Never say you do not have access to the user's peer tutoring classes");
    expect(await screen.findByText(/no peer tutoring classes were found in your current context/i)).toBeInTheDocument();
  });

  it("includes available peer-tutoring classes for joinable peer-tutoring questions", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      classes: [
        {
          id: "pt-1",
          moduleCode: "AM1011",
          title: "Audit Monitoring",
          tutorName: "Mark Teo",
          description: "Audit monitoring",
          enrolled: true,
          enrolledCount: 0,
          maxStudents: 5,
        },
        {
          id: "pt-2",
          moduleCode: "AUDIT5000",
          title: "Audit Smoke Tutoring",
          tutorName: "Mark Teo",
          description: "Smoke Test",
          enrolled: false,
          enrolledCount: 1,
          maxStudents: 5,
        },
        {
          id: "pt-3",
          moduleCode: "MC1",
          title: "PT Tet1",
          tutorName: "Ruby Ferdianto",
          description: "OOP",
          enrolled: false,
          enrolledCount: 1,
          maxStudents: 5,
        },
      ],
      aiReplies: [{ reply: "You can still join Audit Smoke Tutoring and PT Tet1." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What peer tutoring groups can i join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("What peer tutoring classes can i join?");
    expect(aiCalls[0].history[0].content).toContain("## Other Available Peer Tutoring Classes (user can still join)");
    expect(aiCalls[0].history[0].content).toContain("Audit Smoke Tutoring");
    expect(aiCalls[0].history[0].content).toContain("PT Tet1");
    expect(aiCalls[0].history[1].content).toContain("peer tutoring classes they can still join");
    expect(aiCalls[0].history[2].content).toContain("Audit Smoke Tutoring");
    expect(aiCalls[0].history[2].content).toContain("PT Tet1");
    expect(await screen.findByText(/audit smoke tutoring and pt tet1/i)).toBeInTheDocument();
  });

  it("excludes tutor-owned peer-tutoring classes from joinable peer-tutoring answers", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      profile: { id: "user-1", email: "me@example.com" },
      classes: [
        {
          id: "pt-own-1",
          moduleCode: "CS4050",
          title: "Azure cloud",
          isTutor: true,
          createdBy: "user-1",
          tutorName: "fcyong519",
          enrolled: false,
          enrolledCount: 0,
          maxStudents: 5,
        },
        {
          id: "pt-open-1",
          moduleCode: "AM1011",
          title: "Audit Monitoring",
          tutorName: "Mark Teo",
          enrolled: false,
          enrolledCount: 0,
          maxStudents: 5,
        },
      ],
      aiReplies: [{ reply: "You can still join Audit Monitoring." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What peer tutoring classes can i join?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[0].content).toContain("Audit Monitoring");
    expect(aiCalls[0].history[0].content).not.toContain("Azure cloud");
    expect(aiCalls[0].history[2].content).toContain("Audit Monitoring");
    expect(aiCalls[0].history[2].content).not.toContain("Azure cloud");
  });

  it("always includes study-group sections and richer study-group details in study-group context", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      groups: [
        {
          id: 1201,
          name: "Algorithms Marathon",
          moduleCode: "CS2040",
          topic: "Graphs",
          preferredSchedule: "Every Tuesday 7pm",
          membershipStatus: "approved",
        },
      ],
      aiReplies: [{ reply: "Algorithms Marathon is one of your joined study groups." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What study groups do I have?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].history[0].content).toContain("## Study Groups Created/Managed by the User");
    expect(aiCalls[0].history[0].content).toContain("## Study Groups the User Has Joined (as member)");
    expect(aiCalls[0].history[0].content).toContain("## Study Groups the User Has Requested to Join (pending approval)");
    expect(aiCalls[0].history[0].content).toContain("## Other Available Study Groups (user has NOT joined)");
    expect(aiCalls[0].history[0].content).toContain("[CS2040]");
    expect(aiCalls[0].history[0].content).toContain("Topic: Graphs");
    expect(aiCalls[0].history[0].content).toContain("Schedule: Every Tuesday 7pm");
  });

  it("sends the built-in navigation question from the suggestion chip", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [{ reply: "Use the sidebar to switch between dashboard sections." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /how to navigate/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toBe("How do I navigate and use this website?");
    expect(await screen.findByText(/use the sidebar to switch between dashboard sections/i)).toBeInTheDocument();
  });

  it("shows a well-being tip and follow-up actions", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [{ reply: "Try a 5-minute breathing break before your next study block." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /well-being tips/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Give me one random well-being tip");
    expect(await screen.findByText(/5-minute breathing break/i)).toBeInTheDocument();
    expect(screen.getByText(/would you like another tip/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^yes$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^no$/i })).toBeInTheDocument();
  });

  it("generates and completes a quiz flow", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [
        {
          reply: JSON.stringify({
            title: "Quiz on Limits",
            questions: [
              {
                question: "What is lim x->0 of x^2?",
                options: ["A) 0", "B) 1", "C) 2", "D) undefined"],
                answer: "A",
                explanation: "Squaring values near zero approaches zero.",
              },
            ],
          }),
        },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /generate a quiz/i }));
    await clickSkipContext(user);

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Generate exactly 5");
    expect(await screen.findByText(/question 1 of 1/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /a\s*0/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));
    expect(await screen.findByText(/1\/1/i)).toBeInTheDocument();
    expect(screen.getByText(/squaring values near zero approaches zero/i)).toBeInTheDocument();
  });

  it("generates exam-style questions from the sidebar", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [
        {
          reply: JSON.stringify({
            title: "Exam Practice",
            questions: [
              {
                question: "Which algorithm is stable?",
                options: ["A) Quick sort", "B) Merge sort", "C) Heap sort", "D) Selection sort"],
                answer: "B",
                explanation: "Merge sort is stable in its standard form.",
              },
            ],
          }),
        },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /exam-style questions/i }));
    await clickSkipContext(user);

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Generate exactly 20");
    expect(await screen.findByText(/exam practice/i)).toBeInTheDocument();
    expect(screen.getByText(/which algorithm is stable/i)).toBeInTheDocument();
  });

  it("generates flashcards and reveals answers", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [
        {
          reply: JSON.stringify({
            title: "Flashcards on Graphs",
            cards: [
              { question: "What does BFS stand for?", answer: "Breadth-First Search" },
            ],
          }),
        },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /make flashcards/i }));
    await clickSkipContext(user);

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Generate 10 flashcards");
    expect(await screen.findByText(/what does bfs stand for/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/type your answer/i), "Binary first search");
    await user.click(screen.getByRole("button", { name: /reveal answer/i }));
    expect(await screen.findByText(/breadth-first search/i)).toBeInTheDocument();
  });

  it("generates a study plan after the user chooses study time", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [
        {
          reply: JSON.stringify({
            title: "Weekly Study Plan",
            dailyHours: 1,
            schedule: [
              { day: "Monday", sessions: [{ topic: "Limits", activity: "Review notes", duration: "45 min" }] },
              { day: "Tuesday", sessions: [{ topic: "Derivatives", activity: "Practice problems", duration: "45 min" }] },
              { day: "Wednesday", sessions: [{ topic: "Applications", activity: "Past questions", duration: "45 min" }] },
              { day: "Thursday", sessions: [{ topic: "Integration", activity: "Concept mapping", duration: "45 min" }] },
              { day: "Friday", sessions: [{ topic: "Series", activity: "Flashcards", duration: "45 min" }] },
              { day: "Saturday", sessions: [{ topic: "Revision", activity: "Mock quiz", duration: "45 min" }] },
              { day: "Sunday", sessions: [{ topic: "Reflection", activity: "Error review", duration: "45 min" }] },
            ],
          }),
        },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /build a study plan/i }));
    await clickSkipContext(user);
    await user.click(await screen.findByRole("button", { name: /1 hour/i }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Create a 7-day study plan");
    expect(aiCalls[0].message).toContain("\"dailyHours\":1");
    expect(await screen.findByText(/weekly study plan/i)).toBeInTheDocument();
    expect(screen.getByText(/^monday$/i)).toBeInTheDocument();
    expect(screen.getByText(/review notes/i)).toBeInTheDocument();
  });

  it("generates topic suggestions grouped by priority", async () => {
    const user = userEvent.setup({ delay: null });
    const { aiCalls } = installFetchMock({
      aiReplies: [
        {
          reply: JSON.stringify({
            title: "Suggested Topics",
            topics: [
              {
                name: "Recursion",
                description: "Core pattern for many algorithm problems.",
                priority: "high",
                subtopics: ["base case", "call stack"],
              },
              {
                name: "Sorting review",
                description: "Useful refresh before timed practice.",
                priority: "medium",
                subtopics: ["merge sort"],
              },
            ],
          }),
        },
      ],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.click(screen.getByRole("button", { name: /suggest topics/i }));
    await clickSkipContext(user);

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0].message).toContain("Suggest 10 specific topics to study");
    expect(await screen.findByText(/recursion/i)).toBeInTheDocument();
    expect(screen.getByText(/core pattern for many algorithm problems/i)).toBeInTheDocument();
    expect(screen.getByText(/base case/i)).toBeInTheDocument();
  });
});
