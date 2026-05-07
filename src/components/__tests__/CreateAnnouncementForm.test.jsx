import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateAnnouncementForm from "../CreateAnnouncementForm";

vi.mock("../../services/announcements.js", () => ({
  createGroupAnnouncement: vi.fn(),
}));

// eslint-disable-next-line import/first
import { createGroupAnnouncement } from "../../services/announcements.js";

const GROUP_ID = "group-123";

describe("CreateAnnouncementForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── rendering ───────────────────────────────────────────────────── */

  it("renders the title and content inputs and a submit button", () => {
    render(<CreateAnnouncementForm groupId={GROUP_ID} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /post announcement/i }),
    ).toBeInTheDocument();
  });

  it("disables the submit button until both fields are non-empty", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateAnnouncementForm groupId={GROUP_ID} />);

    const submit = screen.getByRole("button", { name: /post announcement/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/title/i), "Hello");
    expect(submit).toBeDisabled(); // content still empty

    await user.type(screen.getByLabelText(/content/i), "World");
    expect(submit).toBeEnabled();
  });

  /* ── char counters ───────────────────────────────────────────────── */

  it("shows a live character counter for title", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateAnnouncementForm groupId={GROUP_ID} />);

    expect(screen.getByText("0/200")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/title/i), "abcd");
    expect(screen.getByText("4/200")).toBeInTheDocument();
  });

  it("shows a live character counter for content", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateAnnouncementForm groupId={GROUP_ID} />);

    expect(screen.getByText("0/4000")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/content/i), "hello");
    expect(screen.getByText("5/4000")).toBeInTheDocument();
  });

  /* ── submit happy path ───────────────────────────────────────────── */

  it("submits trimmed title and content, calls onSuccess, and clears the form", async () => {
    const user = userEvent.setup({ delay: null });
    const onSuccess = vi.fn();
    const created = { id: "ann-1", title: "Title", content: "Body" };
    createGroupAnnouncement.mockResolvedValue(created);

    render(<CreateAnnouncementForm groupId={GROUP_ID} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/title/i), "  Title  ");
    await user.type(screen.getByLabelText(/content/i), "  Body  ");
    await user.click(screen.getByRole("button", { name: /post announcement/i }));

    expect(createGroupAnnouncement).toHaveBeenCalledWith(GROUP_ID, {
      title: "Title",
      content: "Body",
    });
    expect(onSuccess).toHaveBeenCalledWith(created);
    expect(screen.getByText("0/200")).toBeInTheDocument();
    expect(screen.getByText("0/4000")).toBeInTheDocument();
  });

  /* ── submit failure path ─────────────────────────────────────────── */

  it("surfaces the service's error message in the form and calls onError", async () => {
    const user = userEvent.setup({ delay: null });
    const onError = vi.fn();
    const onSuccess = vi.fn();
    const failure = new Error("Server said no");
    createGroupAnnouncement.mockRejectedValue(failure);

    render(
      <CreateAnnouncementForm
        groupId={GROUP_ID}
        onSuccess={onSuccess}
        onError={onError}
      />,
    );

    await user.type(screen.getByLabelText(/title/i), "Title");
    await user.type(screen.getByLabelText(/content/i), "Body");
    await user.click(screen.getByRole("button", { name: /post announcement/i }));

    expect(await screen.findByText(/server said no/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  /* ── validation paths ────────────────────────────────────────────── */

  it("keeps submit disabled for whitespace-only title", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateAnnouncementForm groupId={GROUP_ID} />);

    await user.type(screen.getByLabelText(/title/i), "   ");
    await user.type(screen.getByLabelText(/content/i), "Body");

    expect(
      screen.getByRole("button", { name: /post announcement/i }),
    ).toBeDisabled();
    expect(createGroupAnnouncement).not.toHaveBeenCalled();
  });
});
