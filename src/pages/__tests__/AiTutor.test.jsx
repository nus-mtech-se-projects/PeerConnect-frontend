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

function installFetchMock({ profile = {}, classes = [], groups = [], restrictedUsers = [], aiReplies = [] } = {}) {
  const aiCalls = [];

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
      return mockJsonResponse(groups);
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
    expect(systemContext).not.toContain("user has NOT joined");
    expect(systemContext).toContain("do not say the user has not joined any study groups");
    expect(await screen.findByText(/database study circle/i)).toBeInTheDocument();
  });

  it("answers joined study-group questions locally from actual group data", async () => {
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
      aiReplies: [{ reply: "This should not be used." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Tell me about study groups I have joined");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/study groups you have joined/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/algorithms marathon/i)).toBeInTheDocument();
    expect(screen.queryByText(/study groups you manage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/database admin circle/i)).not.toBeInTheDocument();
    expect(aiCalls).toHaveLength(0);
  });

  it("answers managed study-group questions without listing joined or pending groups", async () => {
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
      aiReplies: [{ reply: "This should not be used." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups do I manage?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/study groups you manage/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/operating systems leaders/i)).toBeInTheDocument();
    expect(screen.queryByText(/study groups you have joined/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/networks review/i)).not.toBeInTheDocument();
    expect(aiCalls).toHaveLength(0);
  });

  it("answers not-joined study-group questions with available groups instead of joined ones", async () => {
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
      aiReplies: [{ reply: "This should not be used." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "What study groups i have not joined?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/study groups you haven't joined yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/security fundamentals/i)).toBeInTheDocument();
    expect(screen.queryByText(/python developers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aws cloud exam practise/i)).not.toBeInTheDocument();
    expect(aiCalls).toHaveLength(0);
  });

  it("treats broader negative join phrasing as available-groups intent", async () => {
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
      aiReplies: [{ reply: "This should not be used." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups did I not join yet?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/study groups you haven't joined yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/open group/i)).toBeInTheDocument();
    expect(screen.queryByText(/joined group/i)).not.toBeInTheDocument();
    expect(aiCalls).toHaveLength(0);
  });

  it("recognizes more common pending-study-group phrases", async () => {
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
      aiReplies: [{ reply: "This should not be used." }],
    });

    renderAiTutor();
    await waitForInitialContextLoads();

    await user.type(screen.getByPlaceholderText(/ask me anything about your studies/i), "Which study groups are awaiting approval?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/pending study-group requests/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/aws cloud exam practise/i)).toBeInTheDocument();
    expect(screen.queryByText(/testing group/i)).not.toBeInTheDocument();
    expect(aiCalls).toHaveLength(0);
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
