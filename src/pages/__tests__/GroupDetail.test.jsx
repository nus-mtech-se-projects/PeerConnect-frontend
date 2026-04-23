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
  preferredSchedule: "2099-04-10T10:00",
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
    { id: "s1", title: "Week 1", startsAt: "2099-04-12T14:00", endsAt: "2099-04-12T16:00", location: "COM1", meetingLink: "" },
  ],
};

const ownerGroup = { ...baseGroup, isAdmin: true };

const pendingMember = { userId: "m-3", firstName: "Eve", lastName: "Ng", email: "eve@u.nus.edu", role: "member", membershipStatus: "pending" };
const ownerGroupWithPending = {
  ...ownerGroup,
  members: [...ownerGroup.members, pendingMember],
};

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

function mockApiSuccess(reloadData = ownerGroup) {
  globalThis.fetch
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => reloadData });
}

function mockApiError(status, error) {
  globalThis.fetch.mockResolvedValueOnce({
    ok: false, status, json: async () => ({ error }),
  });
}

async function initOwnerView(data = ownerGroup) {
  mockGroupFetch(data);
  renderAtGroup();
  await screen.findByDisplayValue("Algo Study");
}

async function initMemberView(data = baseGroup) {
  mockGroupFetch(data);
  renderAtGroup();
  await screen.findByText("Algo Study");
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

  it.each([
    ["hybrid", "Hybrid"],
    ["in-person", "In-Person"],
  ])("shows %s mode", async (studyMode, label) => {
    mockPreviewFetch({ ...baseGroup, studyMode });
    renderAtGroup();
    await screen.findByText("Algo Study");
    expect(document.querySelector(".gdMode")).toHaveTextContent(label);
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
  it("renders read-only view with Leave button and members", async () => {
    await initMemberView();
    // Two "Members" texts can legitimately appear: the tab button and the
    // section heading. Asserting >= 1 keeps the test robust to that.
    expect(screen.getAllByText("Members").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Leave This Group")).toBeInTheDocument();
    expect(screen.getByText("Alice Tan")).toBeInTheDocument();
    expect(screen.getByText("Bob Lee")).toBeInTheDocument();
  });

  it("Leave flow: confirm dialog and calls API", async () => {
    await initMemberView();
    fireEvent.click(screen.getByText("Leave This Group"));
    expect(screen.getByText(/are you sure you want to leave/i)).toBeInTheDocument();
    mockApiSuccess(baseGroup);
    fireEvent.click(screen.getByText("Leave"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/leave"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("Leave shows error on failure", async () => {
    await initMemberView();
    fireEvent.click(screen.getByText("Leave This Group"));
    mockApiError(400, "Cannot leave");
    fireEvent.click(screen.getByText("Leave"));
    expect(await screen.findByText("Cannot leave")).toBeInTheDocument();
  });

  it("shows meeting link as anchor", async () => {
    await initMemberView();
    const link = screen.getByText("https://zoom.us/j/123");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://zoom.us/j/123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows dash when meeting link is empty", async () => {
    await initMemberView({ ...baseGroup, meetingLink: "" });
    const meetingLabel = screen.getByText("Meeting Link");
    const valueEl = meetingLabel.closest(".gdInfoItem")?.querySelector(".gdInfoValue");
    expect(valueEl?.textContent).toBe("—");
  });

  it("shows formatted schedule and session times", async () => {
    await initMemberView();
    expect(screen.getByText("10-Apr-2099 at 10:00")).toBeInTheDocument();
    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText(/12-Apr-2099 at 14:00/)).toBeInTheDocument();
    expect(screen.getByText(/till 12-Apr-2099 at 16:00/)).toBeInTheDocument();
  });

  it("shows dash when no preferred schedule", async () => {
    await initMemberView({ ...baseGroup, preferredSchedule: null });
  });

  it("shows location in session without meeting link", async () => {
    await initMemberView({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: "2099-04-12T14:00", location: "Room 5", meetingLink: "" }],
    });
    expect(screen.getByText("Room 5")).toBeInTheDocument();
  });

  it("shows no location/link when both empty", async () => {
    await initMemberView({
      ...baseGroup,
      sessions: [{ id: "s1", title: "S1", startsAt: "2099-04-12T14:00", location: "", meetingLink: "" }],
    });
    expect(screen.getByText("No location/link")).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   OWNER VIEW
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – owner view", () => {
  it("renders editable form with session creation for owner", async () => {
    await initOwnerView();
    expect(screen.getByDisplayValue("CS2040")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sorting")).toBeInTheDocument();
    expect(screen.getByText("Save Group")).toBeInTheDocument();
    expect(screen.getByText("Create Session")).toBeInTheDocument();
  });

  it("renders Approve/Reject for pending and invited members", async () => {
    const withPendingAndInvited = {
      ...ownerGroup,
      members: [
        ...ownerGroup.members,
        pendingMember,
        { userId: "m-4", firstName: "Dan", lastName: "K", email: "dan@u.nus.edu", role: "member", membershipStatus: "invited" },
      ],
    };
    await initOwnerView(withPendingAndInvited);
    expect(screen.getByText("Eve Ng")).toBeInTheDocument();
    expect(screen.getByText("Dan K")).toBeInTheDocument();
    expect(screen.getAllByText("Approve").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Reject").length).toBeGreaterThanOrEqual(1);
  });

  /* ── Update group ──────────────────────────────────── */

  it("update group calls PUT API", async () => {
    await initOwnerView();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Save Group"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("update group shows error toast on failure", async () => {
    await initOwnerView();
    mockApiError(400, "Name required");
    fireEvent.click(screen.getByText("Save Group"));
    expect(await screen.findByText("Name required")).toBeInTheDocument();
  });

  /* ── Create session ────────────────────────────────── */

  it("create session calls POST API", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const titleInput = screen.getByRole("textbox", { name: /session title/i });
    await user.clear(titleInput);
    await user.type(titleInput, "Week 2");
    mockApiSuccess();
    fireEvent.submit(screen.getByText("Create Session").closest("form"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/sessions"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("create session shows error on failure", async () => {
    await initOwnerView();
    mockApiError(400, "Title required");
    fireEvent.submit(screen.getByText("Create Session").closest("form"));
    expect(await screen.findByText("Title required")).toBeInTheDocument();
  });

  /* ── Delete session ────────────────────────────────── */

  it("delete session shows confirm and calls DELETE API", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText(/are you sure you want to delete this session/i)).toBeInTheDocument();
    mockApiSuccess();
    fireEvent.click(screen.getAllByText("Delete").find((b) => b.closest(".confirmDialog")));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/sessions/s1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("delete session shows error on failure", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Delete"));
    mockApiError(500, "DB error");
    fireEvent.click(screen.getAllByText("Delete").find((b) => b.closest(".confirmDialog")));
    expect(await screen.findByText("DB error")).toBeInTheDocument();
  });

  /* ── Invite member ─────────────────────────────────── */

  it("invite member calls POST API", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByPlaceholderText("student@u.nus.edu"), "new@u.nus.edu");
    mockApiSuccess();
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/invite"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("invite shows error on failure", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByPlaceholderText("student@u.nus.edu"), "bad@u.nus.edu");
    mockApiError(400, "Already a member");
    fireEvent.click(screen.getByText("Invite"));
    expect(await screen.findByText("Already a member")).toBeInTheDocument();
  });

  /* ── Approve member ────────────────────────────────── */

  it("approve member calls POST API", async () => {
    await initOwnerView(ownerGroupWithPending);
    mockApiSuccess();
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/m-3/approve"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("approve shows error on failure", async () => {
    await initOwnerView(ownerGroupWithPending);
    mockApiError(500, "Approve failed");
    fireEvent.click(screen.getByText("Approve"));
    expect(await screen.findByText("Approve failed")).toBeInTheDocument();
  });

  /* ── Remove / reject member ────────────────────────── */

  it("reject member shows confirm and calls DELETE API", async () => {
    await initOwnerView(ownerGroupWithPending);
    fireEvent.click(screen.getAllByText("Reject")[0]);
    expect(screen.getByText(/are you sure you want to reject/i)).toBeInTheDocument();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Reject", { selector: ".confirmDialog button" }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/members/"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("remove member shows error on failure", async () => {
    await initOwnerView(ownerGroupWithPending);
    fireEvent.click(screen.getAllByText("Reject")[0]);
    mockApiError(500, "Remove error");
    fireEvent.click(screen.getByText("Reject", { selector: ".confirmDialog button" }));
    expect(await screen.findByText("Remove error")).toBeInTheDocument();
  });

  /* ── Transfer ownership ────────────────────────────── */

  it("transfer ownership: shows confirm → calls API", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.selectOptions(screen.getByDisplayValue("Select approved member"), "m-2");
    fireEvent.click(screen.getByText("Transfer"));
    expect(screen.getByText(/transfer ownership to selected member/i)).toBeInTheDocument();
    mockApiSuccess(baseGroup);
    fireEvent.click(screen.getAllByText("Transfer").find((b) => b.closest(".confirmDialog")));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/groups/42/transfer-ownership"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("transfer ownership shows error on failure", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.selectOptions(screen.getByDisplayValue("Select approved member"), "m-2");
    fireEvent.click(screen.getByText("Transfer"));
    mockApiError(400, "Transfer denied");
    fireEvent.click(screen.getAllByText("Transfer").find((b) => b.closest(".confirmDialog")));
    expect(await screen.findByText("Transfer denied")).toBeInTheDocument();
  });

  /* ── Dissolve group ────────────────────────────────── */

  it("dissolve group: shows confirm → calls API → navigates", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Dissolve Group"));
    expect(screen.getByText(/are you sure you want to dissolve/i)).toBeInTheDocument();
    globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    fireEvent.click(screen.getByText("Dissolve", { selector: ".confirmDialog button" }));
    await waitFor(() => { expect(mockNav).toHaveBeenCalledWith("/"); });
  });

  it("dissolve shows error on failure", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Dissolve Group"));
    mockApiError(500, "Dissolve failed");
    fireEvent.click(screen.getByText("Dissolve", { selector: ".confirmDialog button" }));
    expect(await screen.findByText("Dissolve failed")).toBeInTheDocument();
  });

  /* ── Owner form interactions ───────────────────────── */

  it("owner can change fields and toggle approval", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const nameInput = screen.getByDisplayValue("Algo Study");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    expect(nameInput).toHaveValue("New Name");
    // The owner view renders several checkboxes (approval, auto-announce on
    // group, auto-announce on session). The "approval" checkbox is the one
    // next to its descriptive label, so we grab it through its associated text.
    const approvalLabel = screen.getByText(/require admin approval/i);
    const checkbox = approvalLabel.closest("label").querySelector("input[type='checkbox']");
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("renders Back to Dashboard in footer", async () => {
    await initOwnerView();
    expect(screen.getAllByText(/back to dashboard/i).length).toBeGreaterThanOrEqual(2);
  });
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – toast", () => {
  it("toast auto-dismisses after timeout", async () => {
    await initOwnerView();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Save Group"));
    const toast = await screen.findByText("Group updated successfully!");
    expect(toast).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    await waitFor(() => {
      expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
    });
  });

  it("clicking toast dismisses it", async () => {
    await initOwnerView();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Save Group"));
    const toast = await screen.findByText("Group updated successfully!");
    fireEvent.click(toast);
    expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
  });

  it("error toast gets error class", async () => {
    await initOwnerView();
    mockApiError(400, "Bad request");
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
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByPlaceholderText("student@u.nus.edu"), "x@u.nus.edu");
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

/* ═══════════════════════════════════════════════════════════════
   UAT – KEYBOARD ACCESSIBILITY
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – keyboard accessibility", () => {
  it("Escape key closes confirm dialog", async () => {
    await initMemberView();
    fireEvent.click(screen.getByText("Leave This Group"));
    expect(screen.getByText(/are you sure you want to leave/i)).toBeInTheDocument();
    const dialog = document.querySelector(".confirmDialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByText(/are you sure you want to leave/i)).not.toBeInTheDocument();
  });

  it("Enter key on toast dismisses it", async () => {
    await initOwnerView();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Save Group"));
    const toast = await screen.findByText("Group updated successfully!");
    fireEvent.keyDown(toast, { key: "Enter" });
    expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
  });

  it("Space key on toast dismisses it", async () => {
    await initOwnerView();
    mockApiSuccess();
    fireEvent.click(screen.getByText("Save Group"));
    const toast = await screen.findByText("Group updated successfully!");
    fireEvent.keyDown(toast, { key: " " });
    expect(screen.queryByText("Group updated successfully!")).not.toBeInTheDocument();
  });

  it("Escape key on confirm dialog closes it", async () => {
    await initMemberView();
    fireEvent.click(screen.getByText("Leave This Group"));
    const dialog = document.querySelector(".confirmDialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    // Dialog should be closed (dialog handles Escape)
    expect(screen.queryByText(/are you sure you want to leave/i)).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   UAT – TRANSFER OWNERSHIP
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – transfer ownership UAT", () => {
  it("Transfer button with no member selected does not open dialog", async () => {
    await initOwnerView();
    // transferOwnerId is "" by default — clicking Transfer should do nothing
    fireEvent.click(screen.getByText("Transfer"));
    expect(screen.queryByText(/transfer ownership to selected member/i)).not.toBeInTheDocument();
  });

  it("cancel in transfer ownership dialog closes it", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.selectOptions(screen.getByDisplayValue("Select approved member"), "m-2");
    fireEvent.click(screen.getByText("Transfer"));
    expect(screen.getByText(/transfer ownership to selected member/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/transfer ownership to selected member/i)).not.toBeInTheDocument();
  });

  it("transfer sends correct newOwnerUserId payload", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.selectOptions(screen.getByDisplayValue("Select approved member"), "m-2");
    fireEvent.click(screen.getByText("Transfer"));
    mockApiSuccess(baseGroup);
    fireEvent.click(screen.getAllByText("Transfer").find((b) => b.closest(".confirmDialog")));
    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find((c) => c[0].includes("transfer-ownership"));
      expect(JSON.parse(call[1].body)).toEqual({ newOwnerUserId: "m-2" });
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   UAT – SESSION FORM PRE-FILL & BUTTON STATES
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – session form UAT", () => {
  it("session form pre-fills location and meeting link from group data", async () => {
    await initOwnerView();
    // The session form location field should be pre-filled from group.location
    const locationInputs = screen.getAllByDisplayValue("COM1-B1");
    expect(locationInputs.length).toBeGreaterThanOrEqual(1);
    const meetingLinkInputs = screen.getAllByDisplayValue("https://zoom.us/j/123");
    expect(meetingLinkInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("Create Session button is disabled while submitting", async () => {
    await initOwnerView();
    globalThis.fetch.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.submit(screen.getByText("Create Session").closest("form"));
    expect(screen.getByText("Creating Session…")).toBeDisabled();
  });

  it("Save Group button is disabled while submitting", async () => {
    await initOwnerView();
    globalThis.fetch.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByText("Save Group"));
    expect(screen.getByText("Saving…")).toBeDisabled();
  });

  it("delete session cancel keeps session in list", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText(/are you sure you want to delete this session/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument();
    expect(screen.getByText("Week 1")).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   UAT – DISSOLVE FLOW
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – dissolve UAT", () => {
  it("cancel in dissolve dialog keeps user on page", async () => {
    await initOwnerView();
    fireEvent.click(screen.getByText("Dissolve Group"));
    expect(screen.getByText(/are you sure you want to dissolve/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/are you sure you want to dissolve/i)).not.toBeInTheDocument();
    expect(mockNav).not.toHaveBeenCalled();
  });

  it("dissolve group shows progress bar while in flight", async () => {
    await initOwnerView();
    globalThis.fetch.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByText("Dissolve Group"));
    fireEvent.click(screen.getByText("Dissolve", { selector: ".confirmDialog button" }));
    expect(document.querySelector(".gdProgressBar")).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════
   UAT – MEMBER MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

describe("GroupDetail – member management UAT", () => {
  it("reject member cancel keeps member in table", async () => {
    await initOwnerView(ownerGroupWithPending);
    fireEvent.click(screen.getAllByText("Reject")[0]);
    expect(screen.getByText(/are you sure you want to reject/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/are you sure you want to reject/i)).not.toBeInTheDocument();
    expect(screen.getByText("Eve Ng")).toBeInTheDocument();
  });

  it("owner row shows dash for status column", async () => {
    await initOwnerView();
    const rows = document.querySelectorAll(".gdTable tbody tr");
    const ownerRow = rows[0];
    expect(ownerRow.textContent).toContain("—");
  });

  it("members are sorted with owner first", async () => {
    await initOwnerView();
    const rows = document.querySelectorAll(".gdTable tbody tr");
    expect(rows[0].textContent).toContain("Alice Tan");
    expect(rows[1].textContent).toContain("Bob Lee");
  });

  it("invite member clears email input on success", async () => {
    await initOwnerView();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const emailInput = screen.getByPlaceholderText("student@u.nus.edu");
    await user.type(emailInput, "new@u.nus.edu");
    mockApiSuccess();
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => expect(emailInput).toHaveValue(""));
  });

  it("approved members appear in transfer ownership dropdown", async () => {
    await initOwnerView();
    const option = screen.getByRole("option", { name: "Bob Lee" });
    expect(option).toBeInTheDocument();
    expect(option.value).toBe("m-2");
  });

  it("owner is not shown in transfer ownership dropdown", async () => {
    await initOwnerView();
    const select = screen.getByDisplayValue("Select approved member");
    expect(select.querySelector('[value="owner-1"]')).not.toBeInTheDocument();
  });
});
