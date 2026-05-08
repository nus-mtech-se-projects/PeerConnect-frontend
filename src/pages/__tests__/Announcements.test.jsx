import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Announcements from "../Announcements";
import {
  getJoinedGroupsWithAnnouncements,
  deleteGroupAnnouncement,
  archiveAnnouncement,
  getArchivedAnnouncements,
  unarchiveAnnouncement,
} from "../../services/announcements";

vi.mock("../../services/announcements", () => ({
  getJoinedGroupsWithAnnouncements: vi.fn(),
  deleteGroupAnnouncement: vi.fn(),
  archiveAnnouncement: vi.fn(),
  getArchivedAnnouncements: vi.fn(),
  unarchiveAnnouncement: vi.fn(),
}));

vi.mock("../../components/CreateAnnouncementForm", () => ({
  default: ({ groupId, onSuccess, onError }) => (
    <div data-testid="create-announcement-form">
      create-form-{groupId}
      <button
        type="button"
        onClick={() => onSuccess({
          id: "ann-new",
          groupId,
          groupName: "Algorithms Crew",
          moduleCode: "CS3230",
          title: "New post",
          content: "Created from form",
          createdAt: new Date().toISOString(),
        })}
      >
        mock create success
      </button>
      <button type="button" onClick={() => onError(new Error("Create boom"))}>
        mock create error
      </button>
    </div>
  ),
}));

vi.mock("../../components/EditAnnouncementForm", () => ({
  default: ({ announcement, onSuccess, onCancel }) => (
    <div data-testid="edit-announcement-form">
      <button
        type="button"
        onClick={() => onSuccess({ ...announcement, title: "Updated room" })}
      >
        mock edit success
      </button>
      <button type="button" onClick={onCancel}>
        mock edit cancel
      </button>
    </div>
  ),
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

  it("honors an initial selected group filter", async () => {
    renderPage({ initialSelectedGroupId: GROUP_B.id });

    expect(await screen.findByText("Sprint review")).toBeInTheDocument();
    expect(screen.queryByText("Room change")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /SWE5006 · Capstone Squad/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("adds a newly created announcement and reports create errors", async () => {
    const user = userEvent.setup({ delay: null });
    const { showToast } = renderPage();
    await screen.findByText("Room change");

    await user.click(screen.getByRole("tab", { name: /CS3230 · Algorithms Crew/i }));
    await user.click(screen.getByRole("button", { name: /mock create success/i }));

    expect(screen.getByText("New post")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Announcement posted successfully!", "success");

    await user.click(screen.getByRole("button", { name: /mock create error/i }));
    expect(showToast).toHaveBeenCalledWith("Create boom", "error");
  });

  it("opens, updates, and closes the edit announcement modal", async () => {
    const user = userEvent.setup({ delay: null });
    const { showToast } = renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    await user.click(within(card).getByRole("button", { name: /edit announcement/i }));

    expect(screen.getByTestId("edit-announcement-form")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /mock edit success/i }));

    expect(screen.getByText("Updated room")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-announcement-form")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Announcement updated.", "success");
  });

  it("closes the edit announcement modal from its backdrop", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    await user.click(within(card).getByRole("button", { name: /edit announcement/i }));
    await user.click(screen.getByRole("button", { name: /close edit announcement dialog/i }));

    expect(screen.queryByTestId("edit-announcement-form")).not.toBeInTheDocument();
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

  it("shows an error toast when archiving fails", async () => {
    const user = userEvent.setup({ delay: null });
    archiveAnnouncement.mockRejectedValue(new Error("Archive failed"));

    const { showToast } = renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    await user.click(within(card).getByRole("button", { name: /archive/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Archive failed", "error");
    });
    expect(screen.getByText("Room change")).toBeInTheDocument();
  });

  it("restores an archived announcement", async () => {
    const archivedItem = { ...ANN_1, id: "arch-1", title: "Restore me" };
    getArchivedAnnouncements.mockResolvedValueOnce([archivedItem]);
    unarchiveAnnouncement.mockResolvedValue(undefined);

    const user = userEvent.setup({ delay: null });
    const { showToast } = renderPage();
    await screen.findByText("Room change");

    await user.click(screen.getByRole("tab", { name: /^archived/i }));
    const archivedCard = await screen.findByText("Restore me");
    await user.click(within(archivedCard.closest("article")).getByRole("button", { name: /restore/i }));

    await waitFor(() => {
      expect(unarchiveAnnouncement).toHaveBeenCalledWith(archivedItem.groupId, archivedItem.id);
      expect(screen.queryByText("Restore me")).not.toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith("Announcement restored.", "success");
  });

  it("shows an error toast when restoring an announcement fails", async () => {
    const archivedItem = { ...ANN_1, id: "arch-2", title: "Restore fails" };
    getArchivedAnnouncements.mockResolvedValueOnce([archivedItem]);
    unarchiveAnnouncement.mockRejectedValue(new Error("Restore failed"));

    const user = userEvent.setup({ delay: null });
    const { showToast } = renderPage();
    await screen.findByText("Room change");

    await user.click(screen.getByRole("tab", { name: /^archived/i }));
    const archivedCard = await screen.findByText("Restore fails");
    await user.click(within(archivedCard.closest("article")).getByRole("button", { name: /restore/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Restore failed", "error");
    });
    expect(screen.getByText("Restore fails")).toBeInTheDocument();
  });

  it("uses the confirmation dialog for deleting announcements", async () => {
    const user = userEvent.setup({ delay: null });
    deleteGroupAnnouncement.mockResolvedValue(undefined);

    const { showToast, setConfirmDialog } = renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    await user.click(within(card).getByRole("button", { name: /delete announcement/i }));

    const dialogConfig = setConfirmDialog.mock.calls.at(-1)[0];
    expect(dialogConfig.message).toMatch(/delete this announcement/i);

    await dialogConfig.onConfirm();

    await waitFor(() => {
      expect(deleteGroupAnnouncement).toHaveBeenCalledWith(ANN_1.groupId, ANN_1.id);
      expect(screen.queryByText("Room change")).not.toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith("Announcement deleted.", "success");
  });

  it("reports delete failures from the confirmation callback", async () => {
    const user = userEvent.setup({ delay: null });
    deleteGroupAnnouncement.mockRejectedValue(new Error("Delete failed"));

    const { showToast, setConfirmDialog } = renderPage();
    await screen.findByText("Room change");

    const card = screen.getByText("Room change").closest("article");
    await user.click(within(card).getByRole("button", { name: /delete announcement/i }));
    await setConfirmDialog.mock.calls.at(-1)[0].onConfirm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Delete failed", "error");
    });
    expect(screen.getByText("Room change")).toBeInTheDocument();
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

  it("renders filtered and archived empty states", async () => {
    getJoinedGroupsWithAnnouncements.mockResolvedValue({
      groups: [GROUP_A],
      announcements: [],
    });
    getArchivedAnnouncements.mockResolvedValueOnce([]);

    const user = userEvent.setup({ delay: null });
    renderPage();

    expect(await screen.findByText(/no announcements yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /CS3230 · Algorithms Crew/i }));
    expect(screen.getByText(/no announcements from algorithms crew/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^archived/i }));
    expect(await screen.findByText(/haven't archived any announcements/i)).toBeInTheDocument();
  });

  it("renders archived loading and archived load errors", async () => {
    let rejectArchived;
    getArchivedAnnouncements.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectArchived = reject;
      }),
    );

    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText("Room change");

    await user.click(screen.getByRole("tab", { name: /^archived/i }));
    expect(screen.getByText(/loading archived announcements/i)).toBeInTheDocument();

    rejectArchived(new Error("Archive load failed"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Archive load failed");
  });

  it("renders the error state when the load fails", async () => {
    getJoinedGroupsWithAnnouncements.mockRejectedValue(new Error("Network down"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
  });
});
