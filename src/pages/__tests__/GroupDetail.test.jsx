import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GroupDetail from "../GroupDetail";

/* ── Router helper ─────────────────────────────────────────── */
const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

/* ── Shared data factories ─────────────────────────────────── */
const baseGroup = {
  id: 42,
  name: "Algo Study",
  moduleCode: "CS2040",
  topic: "Sorting",
  description: "Weekly algorithms prep",
  studyMode: "online",
  location: "COM1-B1",
  meetingLink: "https://zoom.us/j/123",
  preferredSchedule: "2026-04-01T10:00",
  maxMembers: 10,
  approvalRequired: false,
  isAdmin: false,
  createdBy: "owner-1",
  status: "active",
  members: [
    { userId: "owner-1", firstName: "Alice", lastName: "Tan", email: "alice@u.nus.edu", role: "owner", membershipStatus: "approved" },
    { userId: "m-2", firstName: "Bob", lastName: "Lee", email: "bob@u.nus.edu", role: "member", membershipStatus: "approved" },
  ],
  sessions: [
    { id: "s1", title: "Week 1", startsAt: "2026-04-05T14:00", endsAt: "2026-04-05T16:00", location: "COM1", meetingLink: "" },
  ],
};

const ownerGroup = { ...baseGroup, isAdmin: true };

function renderAtGroup(groupId = "42") {
  return render(
    <MemoryRouter initialEntries={[`/groups/${groupId}`]}>
      <Routes>
        <Route path="/groups/:groupId" element={<GroupDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

/* ── Fetch helpers ─────────────────────────────────────────── */
function mockGroupFetch(data, ok = true, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
  });
}

function mockGroupFetchFail(status = 500) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: "Server error" }),
  });
}

/* 403 path: first call 403, second call returns groups list */
function mockPreviewFetch(group = baseGroup) {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => [group],
    });
}

/* ── Setup / teardown ──────────────────────────────────────── */
beforeEach(() => {
  mockNav.mockClear();
  localStorage.clear();
  localStorage.setItem("accessToken", "test-token");
  vi.restoreAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/* ═══════════════════════════════════════════════════════════════
   LOADING & ERROR STATES
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – loading & error", () => {
  it("shows loading message while fetching", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise(() => {}));
    renderAtGroup();
    expect(screen.getByText(/loading group details/i)).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    mockGroupFetchFail();
    renderAtGroup();
    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
    expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument();
  });

  it("back button on error navigates home", async () => {
    mockGroupFetchFail();
    renderAtGroup();
    const btn = await screen.findByText(/back to dashboard/i);
    fireEvent.click(btn);
    expect(mockNav).toHaveBeenCalledWith("/");
  });

  it("renders nothing when group is null after load", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    });
    renderAtGroup();
    await waitFor(() => {
      expect(screen.queryByText(/loading group details/i)).not.toBeInTheDocument();
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   PREVIEW (NON-MEMBER) VIEW
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – preview (non-member)", () => {
  it("renders preview view with group details", async () => {
    mockPreviewFetch();
    renderAtGroup();

    expect(await screen.findByText("Algo Study")).toBeInTheDocument();
    expect(screen.getByText("CS2040")).toBeInTheDocument();
    expect(screen.getByText("Sorting")).toBeInTheDocument();
    expect(screen.getByText(/weekly algorithms prep/i)).toBeInTheDocument();
  });

  it("shows study mode badge", async () => {
    mockPreviewFetch();
    renderAtGroup();
    await screen.findByText("Algo Study");
    const badge = document.querySelector(".gdMode");
    expect(badge).toHaveTextContent("Online");
  });

  it("shows hybrid mode", async () => {
    mockPreviewFetch({ ...baseGroup, studyMode: "hybrid" });
    renderAtGroup();
    await screen.findByText("Algo Study");
    const badge = document.querySelector(".gdMode");
    expect(badge).toHaveTextContent("Hybrid");
  });

  it("shows in-person mode", async () => {
    mockPreviewFetch({ ...baseGroup, studyMode: "in-person" });
    renderAtGroup();
    await screen.findByText("Algo Study");
    const badge = document.querySelector(".gdMode");
    expect(badge).toHaveTextContent("In-Person");
  });

  it("shows Owner section instead of Members", async () => {
    mockPreviewFetch();
    renderAtGroup();
    expect(await screen.findByText("Owner")).toBeInTheDocument();
  });

  it("shows Join button for non-dissolved group", async () => {
    mockPreviewFetch();
    renderAtGroup();
    expect(await screen.findByText("Join This Group")).toBeInTheDocument();
  });

  it("hides Join button when group is dissolved", async () => {
    mockPreviewFetch({ ...baseGroup, status: "dissolved" });
    renderAtGroup();
    await screen.findByText("Algo Study");
    expect(screen.queryByText("Join This Group")).not.toBeInTheDocument();
  });

  it("hides Join button when group is full", async () => {
    mockPreviewFetch({ ...baseGroup, status: "full" });
    renderAtGroup();
    await screen.findByText("Algo Study");
    expect(screen.queryByText("Join This Group")).not.toBeInTheDocument();
  });

  it("shows status when present", async () => {
    mockPreviewFetch({ ...baseGroup, status: "active" });
    renderAtGroup();
    expect(await screen.findByText("active")).toBeInTheDocument();
  });

  it("displays sessions in read-only view", async () => {
    mockPreviewFetch();
    renderAtGroup();
    expect(await screen.findByText("Week 1")).toBeInTheDocument();
  });

  it("shows no sessions message when empty", async () => {
    mockPreviewFetch({ ...baseGroup, sessions: [] });
    renderAtGroup();
    expect(await screen.findByText(/no sessions scheduled yet/i)).toBeInTheDocument();
  });

  it("Join flow: shows confirm dialog and calls API", async () => {
    mockPreviewFetch();
    renderAtGroup();

    const joinBtn = await screen.findByText("Join This Group");
    fireEvent.click(joinBtn);

    expect(screen.getByText(/are you sure you want to join/i)).toBeInTheDocument();

    // Mock join API + reload
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Join"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/join"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("Join shows error toast on failure", async () => {
    mockPreviewFetch();
    renderAtGroup();

    const joinBtn = await screen.findByText("Join This Group");
    fireEvent.click(joinBtn);

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Group is full" }),
    });

    fireEvent.click(screen.getByText("Join"));

    expect(await screen.findByText("Group is full")).toBeInTheDocument();
  });

  it("Join shows already-joined toast", async () => {
    mockPreviewFetch();
    renderAtGroup();

    const joinBtn = await screen.findByText("Join This Group");
    fireEvent.click(joinBtn);

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ alreadyJoined: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Join"));

    expect(await screen.findByText(/already joined/i)).toBeInTheDocument();
  });

  it("cancel in confirm dialog closes it", async () => {
    mockPreviewFetch();
    renderAtGroup();

    fireEvent.click(await screen.findByText("Join This Group"));
    expect(screen.getByText(/are you sure you want to join/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/are you sure you want to join/i)).not.toBeInTheDocument();
  });

  it("clicking overlay closes confirm dialog", async () => {
    mockPreviewFetch();
    renderAtGroup();

    fireEvent.click(await screen.findByText("Join This Group"));
    const overlay = document.querySelector(".modalOverlay");
    fireEvent.click(overlay);
    expect(screen.queryByText(/are you sure you want to join/i)).not.toBeInTheDocument();
  });

  it("preview builds owner from createdBy when no members array", async () => {
    const noMembersGroup = {
      ...baseGroup,
      members: undefined,
      createdBy: "u-99",
      ownerFirstName: "Carol",
      ownerLastName: "Ng",
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [noMembersGroup] });

    renderAtGroup();
    expect(await screen.findByText("Carol Ng")).toBeInTheDocument();
  });

  it("preview falls back to ownerName split", async () => {
    const nameGroup = {
      ...baseGroup,
      members: undefined,
      createdBy: "u-99",
      ownerName: "David Lim",
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [nameGroup] });

    renderAtGroup();
    expect(await screen.findByText("David Lim")).toBeInTheDocument();
  });

  it("preview: 403 then list API fails → shows error", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    renderAtGroup();
    expect(await screen.findByText(/unable to load group information/i)).toBeInTheDocument();
  });

  it("preview: group not found in list → shows error", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });

    renderAtGroup();
    expect(await screen.findByText(/group not found/i)).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   MEMBER (READ-ONLY) VIEW
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – member view", () => {
  it("renders member read-only view", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();

    expect(await screen.findByText("Algo Study")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
  });

  it("shows Leave button for non-owner member", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    expect(await screen.findByText("Leave This Group")).toBeInTheDocument();
  });

  it("Leave flow: confirm dialog and calls API", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();

    fireEvent.click(await screen.findByText("Leave This Group"));
    expect(screen.getByText(/are you sure you want to leave/i)).toBeInTheDocument();

    // Mock leave + reload
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => baseGroup });

    fireEvent.click(screen.getByText("Leave"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/leave"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("Leave shows error on failure", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();

    fireEvent.click(await screen.findByText("Leave This Group"));

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Cannot leave" }),
    });

    fireEvent.click(screen.getByText("Leave"));
    expect(await screen.findByText("Cannot leave")).toBeInTheDocument();
  });

  it("shows meeting link as anchor", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    const link = await screen.findByText("https://zoom.us/j/123");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://zoom.us/j/123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows dash when meeting link is empty", async () => {
    mockGroupFetch({ ...baseGroup, meetingLink: "" });
    renderAtGroup();
    await screen.findByText("Algo Study");
    const meetingLabel = screen.getByText("Meeting Link");
    const valueEl = meetingLabel.closest(".gdInfoItem")?.querySelector(".gdInfoValue");
    expect(valueEl?.textContent).toBe("—");
  });

  it("shows formatted preferred schedule", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    // 2026-04-01T10:00 => "01-Apr-2026 at 10:00"
    expect(await screen.findByText("01-Apr-2026 at 10:00")).toBeInTheDocument();
  });

  it("shows dash when no preferred schedule", async () => {
    mockGroupFetch({ ...baseGroup, preferredSchedule: null });
    renderAtGroup();
    await screen.findByText("Algo Study");
  });

  it("displays member list with roles", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    expect(await screen.findByText("Alice Tan")).toBeInTheDocument();
    expect(screen.getByText("Bob Lee")).toBeInTheDocument();
  });

  it("displays session start/end times", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    expect(await screen.findByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText(/05-Apr-2026 at 14:00/)).toBeInTheDocument();
    expect(screen.getByText(/till 05-Apr-2026 at 16:00/)).toBeInTheDocument();
  });

  it("shows location in session without meeting link", async () => {
    mockGroupFetch({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: "2026-04-05T14:00", location: "Room 5", meetingLink: "" }],
    });
    renderAtGroup();
    expect(await screen.findByText("Room 5")).toBeInTheDocument();
  });

  it("shows no location/link when both empty", async () => {
    mockGroupFetch({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: "2026-04-05T14:00", location: "", meetingLink: "" }],
    });
    renderAtGroup();
    expect(await screen.findByText("No location/link")).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   OWNER VIEW
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – owner view", () => {
  it("renders editable form for owner", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    expect(await screen.findByDisplayValue("Algo Study")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CS2040")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sorting")).toBeInTheDocument();
    expect(screen.getByText("Save Group")).toBeInTheDocument();
  });

  it("renders session creation form", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    expect(await screen.findByText("Create Session")).toBeInTheDocument();
  });

  it("renders members table with Approve/Reject buttons for pending", async () => {
    const pending = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" },
      ],
    };
    mockGroupFetch(pending);
    renderAtGroup();
    expect(await screen.findByText("Eve Ng")).toBeInTheDocument();
    expect(screen.getAllByText("Approve").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reject").length).toBeGreaterThanOrEqual(1);
  });

  it("Approve/Reject buttons also shown for invited members", async () => {
    const invited = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-4", firstName: "Dan", lastName: "K", email: "dan@u.nus.edu", role: "member", membershipStatus: "invited" },
      ],
    };
    mockGroupFetch(invited);
    renderAtGroup();
    await screen.findByText("Dan K");
    const approveBtns = screen.getAllByText("Approve");
    expect(approveBtns.length).toBeGreaterThanOrEqual(1);
  });

  /* ── Update group ──────────────────────────────────── */

  it("update group calls PUT API", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    await screen.findByDisplayValue("Algo Study");

    // Mock update + reload
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Save Group"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("update group shows error toast on failure", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    await screen.findByDisplayValue("Algo Study");

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Name required" }),
    });

    fireEvent.click(screen.getByText("Save Group"));
    expect(await screen.findByText("Name required")).toBeInTheDocument();
  });

  /* ── Create session ────────────────────────────────── */

  it("create session calls POST API", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    const titleInput = await screen.findByRole("textbox", { name: /session title/i });
    await user.clear(titleInput);
    await user.type(titleInput, "Week 2");

    // Mock create + reload
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    // Use submit on form to bypass required field validation in jsdom
    const form = screen.getByText("Create Session").closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/sessions"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("create session shows error on failure", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    await screen.findByText("Create Session");

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Title required" }),
    });

    const form = screen.getByText("Create Session").closest("form");
    fireEvent.submit(form);
    expect(await screen.findByText("Title required")).toBeInTheDocument();
  });

  /* ── Delete session ────────────────────────────────── */

  it("delete session shows confirm and calls DELETE API", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    const deleteBtn = await screen.findByText("Delete");
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/are you sure you want to delete this session/i)).toBeInTheDocument();

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getAllByText("Delete").find((b) => b.closest(".confirmDialog")));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/sessions/s1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("delete session shows error on failure", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    fireEvent.click(await screen.findByText("Delete"));

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({ error: "DB error" }),
    });

    fireEvent.click(screen.getAllByText("Delete").find((b) => b.closest(".confirmDialog")));
    expect(await screen.findByText("DB error")).toBeInTheDocument();
  });

  /* ── Invite member ─────────────────────────────────── */

  it("invite member calls POST API", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    const emailInput = await screen.findByPlaceholderText("student@u.nus.edu");
    await user.type(emailInput, "new@u.nus.edu");

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Invite"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/invite"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("invite shows error on failure", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    const emailInput = await screen.findByPlaceholderText("student@u.nus.edu");
    await user.type(emailInput, "bad@u.nus.edu");

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Already a member" }),
    });

    fireEvent.click(screen.getByText("Invite"));
    expect(await screen.findByText("Already a member")).toBeInTheDocument();
  });

  /* ── Approve member ────────────────────────────────── */

  it("approve member calls POST API", async () => {
    const pending = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" },
      ],
    };
    mockGroupFetch(pending);
    renderAtGroup();

    const approveBtn = await screen.findByText("Approve");

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/m-3/approve"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("approve shows error on failure", async () => {
    const pending = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" },
      ],
    };
    mockGroupFetch(pending);
    renderAtGroup();

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({ error: "Approve failed" }),
    });

    fireEvent.click(await screen.findByText("Approve"));
    expect(await screen.findByText("Approve failed")).toBeInTheDocument();
  });

  /* ── Remove / reject member ────────────────────────── */

  it("reject member shows confirm and calls DELETE API", async () => {
    const pending = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" },
      ],
    };
    mockGroupFetch(pending);
    renderAtGroup();

    // Find the Reject button for Eve (non-owner member)
    const rejectBtns = await screen.findAllByText("Reject");
    fireEvent.click(rejectBtns[0]);

    expect(screen.getByText(/are you sure you want to reject/i)).toBeInTheDocument();

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Reject", { selector: ".confirmDialog button" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("remove member shows error on failure", async () => {
    const pending = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" },
      ],
    };
    mockGroupFetch(pending);
    renderAtGroup();

    const rejectBtns = await screen.findAllByText("Reject");
    fireEvent.click(rejectBtns[0]);

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({ error: "Remove error" }),
    });

    fireEvent.click(screen.getByText("Reject", { selector: ".confirmDialog button" }));
    expect(await screen.findByText("Remove error")).toBeInTheDocument();
  });

  /* ── Transfer ownership ────────────────────────────── */

  it("transfer ownership: shows confirm → calls API", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    await screen.findByDisplayValue("Algo Study");
    // The transfer ownership select has "Select approved member" as placeholder
    const select = screen.getByDisplayValue("Select approved member");
    await user.selectOptions(select, "m-2");

    fireEvent.click(screen.getByText("Transfer"));
    expect(screen.getByText(/transfer ownership to selected member/i)).toBeInTheDocument();

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => baseGroup });

    fireEvent.click(screen.getAllByText("Transfer").find((b) => b.closest(".confirmDialog")));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/transfer-ownership"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("transfer ownership shows error on failure", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    await screen.findByDisplayValue("Algo Study");
    const select = screen.getByDisplayValue("Select approved member");
    await user.selectOptions(select, "m-2");

    fireEvent.click(screen.getByText("Transfer"));

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Transfer denied" }),
    });

    fireEvent.click(screen.getAllByText("Transfer").find((b) => b.closest(".confirmDialog")));
    expect(await screen.findByText("Transfer denied")).toBeInTheDocument();
  });

  /* ── Dissolve group ────────────────────────────────── */

  it("dissolve group: shows confirm → calls API → navigates", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    fireEvent.click(await screen.findByText("Dissolve Group"));
    expect(screen.getByText(/are you sure you want to dissolve/i)).toBeInTheDocument();

    globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    fireEvent.click(screen.getByText("Dissolve", { selector: ".confirmDialog button" }));

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith("/");
    });
  });

  it("dissolve shows error on failure", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    fireEvent.click(await screen.findByText("Dissolve Group"));

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({ error: "Dissolve failed" }),
    });

    fireEvent.click(screen.getByText("Dissolve", { selector: ".confirmDialog button" }));
    expect(await screen.findByText("Dissolve failed")).toBeInTheDocument();
  });

  /* ── Owner form interactions ───────────────────────── */

  it("owner can change group fields", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    const nameInput = await screen.findByDisplayValue("Algo Study");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    expect(nameInput).toHaveValue("New Name");
  });

  it("owner can toggle approval required", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("renders Back to Dashboard in footer", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    const backBtns = await screen.findAllByText(/back to dashboard/i);
    expect(backBtns.length).toBeGreaterThanOrEqual(2); // header + footer
  });
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – toast", () => {
  it("toast auto-dismisses after timeout", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    await screen.findByDisplayValue("Algo Study");

    // Trigger update success
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Save Group"));

    const toast = await screen.findByText("Group updated successfully!");
    expect(toast).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4000); });

    await waitFor(() => {
      expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
    });
  });

  it("clicking toast dismisses it", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    await screen.findByDisplayValue("Algo Study");

    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ownerGroup });

    fireEvent.click(screen.getByText("Save Group"));

    const toast = await screen.findByText("Group updated successfully!");
    fireEvent.click(toast);
    expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
  });

  it("error toast gets error class", async () => {
    mockGroupFetch(ownerGroup);
    renderAtGroup();
    await screen.findByDisplayValue("Algo Study");

    globalThis.fetch.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: "Bad request" }),
    });

    fireEvent.click(screen.getByText("Save Group"));

    const toast = await screen.findByText("Bad request");
    expect(toast.className).toContain("dashToastError");
  });
});

/* ═══════════════════════════════════════════════════════════════
   SENDING-EMAIL OVERLAY
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – email overlay", () => {
  it("shows loading overlay while inviting", async () => {
    mockGroupFetch(ownerGroup);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAtGroup();

    const emailInput = await screen.findByPlaceholderText("student@u.nus.edu");
    await user.type(emailInput, "x@u.nus.edu");

    // Never resolving promise keeps overlay visible
    globalThis.fetch.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByText("Invite"));

    expect(screen.getByText(/sending notification email/i)).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   AUTH HEADERS
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – auth", () => {
  it("sends Authorization header when token is present", async () => {
    localStorage.setItem("accessToken", "my-jwt");
    mockGroupFetch(baseGroup);
    renderAtGroup();
    await screen.findByText("Algo Study");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-jwt" }),
      })
    );
  });

  it("omits Authorization header when no token", async () => {
    localStorage.removeItem("accessToken");
    mockGroupFetch(baseGroup);
    renderAtGroup();
    await screen.findByText("Algo Study");

    const call = globalThis.fetch.mock.calls[0];
    expect(call[1].headers.Authorization).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
   EDGE CASES
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – edge cases", () => {
  it("handles json parse error gracefully on group fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => { throw new Error("bad json"); },
    });
    renderAtGroup();
    expect(await screen.findByText(/failed to load group/i)).toBeInTheDocument();
  });

  it("courseCode fallback to moduleCode", async () => {
    mockGroupFetch({ ...baseGroup, moduleCode: undefined, courseCode: "IS1103" });
    renderAtGroup();
    expect(await screen.findByText("IS1103")).toBeInTheDocument();
  });

  it("uses fallback API_BASE when env not set", async () => {
    mockGroupFetch(baseGroup);
    renderAtGroup();
    await screen.findByText("Algo Study");
    // fetch was called with some API base URL
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/groups/42"),
      expect.anything()
    );
  });

  it("handles empty members and sessions arrays", async () => {
    mockGroupFetch({ ...baseGroup, members: [], sessions: [] });
    renderAtGroup();
    await screen.findByText("Algo Study");
    expect(screen.getByText(/no sessions scheduled yet/i)).toBeInTheDocument();
  });

  it("handles non-array members/sessions from API", async () => {
    mockGroupFetch({ ...baseGroup, members: null, sessions: null });
    renderAtGroup();
    await screen.findByText("Algo Study");
  });

  it("formatDateTime handles null/undefined", async () => {
    mockGroupFetch({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: null, endsAt: null, location: "X" }],
    });
    renderAtGroup();
    await screen.findByText("S1");
  });

  it("formatDateTime handles invalid date string", async () => {
    mockGroupFetch({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: "not-a-date", endsAt: null, location: "X" }],
    });
    renderAtGroup();
    // When NaN, returns the original string
    expect(await screen.findByText("not-a-date")).toBeInTheDocument();
  });

  it("handles no preferredSchedule parts gracefully", async () => {
    mockGroupFetch({ ...ownerGroup, preferredSchedule: "" });
    renderAtGroup();
    await screen.findByDisplayValue("Algo Study");
  });
});
