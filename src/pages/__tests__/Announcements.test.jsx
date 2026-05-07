import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Announcements from "../Announcements";
import {
  getJoinedGroupsWithAnnouncements,
  archiveAnnouncement,
  getArchivedAnnouncements,
} from "../../services/announcements";

vi.mock("../../services/announcements", () => ({
  getJoinedGroupsWithAnnouncements: vi.fn(),
  deleteGroupAnnouncement: vi.fn(),
  archiveAnnouncement: vi.fn(),
  getArchivedAnnouncements: vi.fn(),
  unarchiveAnnouncement: vi.fn(),
}));

vi.mock("../../components/CreateAnnouncementForm", () => ({
  default: ({ groupId }) => (
    <div data-testid="create-announcement-form">create-form-{groupId}</div>
  ),
}));

vi.mock("../../components/EditAnnouncementForm", () => ({
  default: () => <div data-testid="edit-announcement-form" />,
}));

const GROUP_A = { id: "g-a", name: "Algorithms Crew", moduleCode: "CS3230", isAdmin: true, joined: true };
const GROUP_B = { id: "g-b", name: "Capstone Squad", moduleCode: "SWE5006", isAdmin: false, joined: true };

const ANN_1 = {
  id: "ann-1",
  groupId: GROUP_A.id,
  groupName: GROUP_A.name,
  moduleCode: GROUP_A.moduleCode,
  title: "Room change",
  content: "Moved to LT19",
  authorName: "Alice Tan",
  authorEmail: "alice@u.nus.edu",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
};
const ANN_2 = {
  id: "ann-2",
  groupId: GROUP_B.id,
  groupName: GROUP_B.name,
  moduleCode: GROUP_B.moduleCode,
  title: "Sprint review",
  content: "Wednesday 2pm",
  authorName: "Bob Lim",
  authorEmail: "bob@u.nus.edu",
  createdAt: new Date(Date.now() - 7_200_000).toISOString(),
};

function renderPage(props = {}) {
  const showToast = vi.fn();
  const setConfirmDialog = vi.fn();
  render(
    <Announcements
      showToast={showToast}
      setConfirmDialog={setConfirmDialog}
      {...props}
    />,
  );
  return { showToast, setConfirmDialog };
}

describe("Announcements page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJoinedGroupsWithAnnouncements.mockResolvedValue({
      groups: [GROUP_A, GROUP_B],
      announcements: [ANN_1, ANN_2],
    });
    getArchivedAnnouncements.mockResolvedValue([]);
  });

  /* ── load + render ──────────────────────────────────────────────── */

  it("renders the feed once the initial fetch resolves", async () => {
    renderPage();

    expect(await screen.findByText("Room change")).toBeInTheDocument();
    expect(screen.getByText("Sprint review")).toBeInTheDocument();
    expect(getJoinedGroupsWithAnnouncements).toHaveBeenCalledTimes(1);
  });

  it("renders both group filter pills", async () => {
    renderPage();
    await screen.findByText("Room change");

    expect(screen.getByRole("tab", { name: /all groups/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /CS3230 · Algorithms Crew/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /SWE5006 · Capstone Squad/i }),
    ).toBeInTheDocument();
  });

  /* ── filter pill behaviour ──────────────────────────────────────── */

  it("filters the feed when a group pill is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText("Room change");

    await user.click(screen.getByRole("tab", { name: /SWE5006 · Capstone Squad/i }));

    expect(screen.queryByText("Room change")).not.toBeInTheDocument();
    expect(screen.getByText("Sprint review")).toBeInTheDocument();
  });

  it("only shows the create form for groups where the user is an admin", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText("Room change");

    // Admin group: form appears
    await user.click(screen.getByRole("tab", { name: /CS3230 · Algorithms Crew/i }));
    expect(screen.getByTestId("create-announcement-form")).toHaveTextContent(
      `create-form-${GROUP_A.id}`,
    );

    // Non-admin group: prompt appears instead
    await user.click(screen.getByRole("tab", { name: /SWE5006 · Capstone Squad/i }));
    expect(screen.queryByTestId("create-announcement-form")).not.toBeInTheDocument();
    expect(
      screen.getByText(/only the group owner or admins can post/i),
    ).toBeInTheDocument();
  });

  /* ── view toggle: active ↔ archived ─────────────────────────────── */

  it("fetches the archived list lazily when the user switches to the Archived tab", async () => {
    const archivedItem = { ...ANN_1, id: "arch-1", title: "Old archive note" };
    getArchivedAnnouncements.mockResolvedValueOnce([archivedItem]);

    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText("Room change");

    expect(getArchivedAnnouncements).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: /^archived/i }));

    expect(await screen.findByText("Old archive note")).toBeInTheDocument();
    expect(getArchivedAnnouncements).toHaveBeenCalledTimes(1);
  });

  /* ── archive action ─────────────────────────────────────────────── */

  it("archive button calls the service and removes the card from the active feed", async () => {
    const user = userEvent.setup({ delay: null });
    archiveAnnouncement.mockResolvedValue(undefined);

    const { showToast } = renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    const archiveBtn = within(card).getByRole("button", { name: /archive/i });
    await user.click(archiveBtn);

    await waitFor(() => {
      expect(archiveAnnouncement).toHaveBeenCalledWith(ANN_1.groupId, ANN_1.id);
      expect(screen.queryByText("Room change")).not.toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/archived for you/i),
      "success",
    );
  });

  /* ── empty/error states ─────────────────────────────────────────── */

  it("renders the no-groups empty state when the user hasn't joined any groups", async () => {
    getJoinedGroupsWithAnnouncements.mockResolvedValue({
      groups: [],
      announcements: [],
    });

    renderPage();

    expect(
      await screen.findByText(/have not joined any study groups/i),
    ).toBeInTheDocument();
  });

  it("renders the error state when the load fails", async () => {
    getJoinedGroupsWithAnnouncements.mockRejectedValue(new Error("Network down"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
  });
});
