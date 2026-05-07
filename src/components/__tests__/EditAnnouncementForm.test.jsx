import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditAnnouncementForm from "../EditAnnouncementForm";
import { updateGroupAnnouncement } from "../../services/announcements.js";

vi.mock("../../services/announcements.js", () => ({
  updateGroupAnnouncement: vi.fn(),
}));

const GROUP_ID = "group-xyz";
const ORIGINAL = {
  id: "ann-1",
  title: "Old title",
  content: "Old content",
};

describe("EditAnnouncementForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── pre-fill ────────────────────────────────────────────────────── */

  it("pre-fills title and content from the announcement prop", () => {
    render(<EditAnnouncementForm groupId={GROUP_ID} announcement={ORIGINAL} />);

    expect(screen.getByLabelText(/title/i)).toHaveValue("Old title");
    expect(screen.getByLabelText(/content/i)).toHaveValue("Old content");
  });

  /* ── hasChanges gate ─────────────────────────────────────────────── */

  it("disables Update until the user changes either field", async () => {
    const user = userEvent.setup({ delay: null });
    render(<EditAnnouncementForm groupId={GROUP_ID} announcement={ORIGINAL} />);

    const submit = screen.getByRole("button", { name: /update announcement/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/title/i), "!");
    expect(submit).toBeEnabled();
  });

  it("re-disables Update when the user types and then reverts back to the original", async () => {
    const user = userEvent.setup({ delay: null });
    render(<EditAnnouncementForm groupId={GROUP_ID} announcement={ORIGINAL} />);

    const titleInput = screen.getByLabelText(/title/i);
    const submit = screen.getByRole("button", { name: /update announcement/i });

    await user.type(titleInput, "!");
    expect(submit).toBeEnabled();

    await user.clear(titleInput);
    await user.type(titleInput, "Old title");
    expect(submit).toBeDisabled();
  });

  /* ── prop sync ───────────────────────────────────────────────────── */

  it("re-syncs inputs when the announcement prop changes", () => {
    const { rerender } = render(
      <EditAnnouncementForm groupId={GROUP_ID} announcement={ORIGINAL} />,
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue("Old title");

    const replacement = { id: "ann-2", title: "New one", content: "Different body" };
    rerender(<EditAnnouncementForm groupId={GROUP_ID} announcement={replacement} />);

    expect(screen.getByLabelText(/title/i)).toHaveValue("New one");
    expect(screen.getByLabelText(/content/i)).toHaveValue("Different body");
  });

  /* ── submit happy path ───────────────────────────────────────────── */

  it("submits trimmed payload using the announcement id and forwards the result via onSuccess", async () => {
    const user = userEvent.setup({ delay: null });
    const onSuccess = vi.fn();
    const updated = { ...ORIGINAL, title: "Updated", content: "Edited body" };
    updateGroupAnnouncement.mockResolvedValue(updated);

    render(
      <EditAnnouncementForm
        groupId={GROUP_ID}
        announcement={ORIGINAL}
        onSuccess={onSuccess}
      />,
    );

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "  Updated  ");
    const contentInput = screen.getByLabelText(/content/i);
    await user.clear(contentInput);
    await user.type(contentInput, "  Edited body  ");

    await user.click(screen.getByRole("button", { name: /update announcement/i }));

    expect(updateGroupAnnouncement).toHaveBeenCalledWith(GROUP_ID, ORIGINAL.id, {
      title: "Updated",
      content: "Edited body",
    });
    expect(onSuccess).toHaveBeenCalledWith(updated);
  });

  /* ── cancel ──────────────────────────────────────────────────────── */

  it("Cancel button calls onCancel without invoking the service", async () => {
    const user = userEvent.setup({ delay: null });
    const onCancel = vi.fn();

    render(
      <EditAnnouncementForm
        groupId={GROUP_ID}
        announcement={ORIGINAL}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(updateGroupAnnouncement).not.toHaveBeenCalled();
  });

  /* ── failure path ────────────────────────────────────────────────── */

  it("displays the error message when the service rejects", async () => {
    const user = userEvent.setup({ delay: null });
    updateGroupAnnouncement.mockRejectedValue(new Error("Stale, refresh and retry"));

    render(<EditAnnouncementForm groupId={GROUP_ID} announcement={ORIGINAL} />);

    await user.type(screen.getByLabelText(/title/i), " v2");
    await user.click(screen.getByRole("button", { name: /update announcement/i }));

    expect(
      await screen.findByText(/stale, refresh and retry/i),
    ).toBeInTheDocument();
  });
});
