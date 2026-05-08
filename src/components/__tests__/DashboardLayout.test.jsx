import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardLayout from "../DashboardLayout";
import { fetchAccessibleGroupChats } from "../../services/groupChatService";
import { emitProfileUpdated } from "../../utils/profileSync";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNav,
  };
});

vi.mock("../../services/groupChatService", async () => {
  const actual = await vi.importActual("../../services/groupChatService");
  return {
    ...actual,
    fetchAccessibleGroupChats: vi.fn(),
  };
});

function renderLayout(children = <main>Dashboard content</main>, initialState = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/", state: initialState }]}>
      <DashboardLayout activeNav="groups">{children}</DashboardLayout>
    </MemoryRouter>
  );
}

describe("DashboardLayout", () => {
  beforeEach(() => {
    mockNav.mockClear();
    fetchAccessibleGroupChats.mockResolvedValue([
      { chatId: "chat-1", groupName: "Algorithms", messageCount: 2 },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/users/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            firstName: "Alice",
            lastName: "Tan",
            email: "alice@u.nus.edu",
            avatarUrl: "avatar.png",
          }),
        });
      }
      if (String(url).includes("/api/profile")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ name: "Profile Name", avatar: "profile.png" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads profile data, chats, and renders children", async () => {
    renderLayout();

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(await screen.findByText("Alice Tan")).toBeInTheDocument();
    expect(screen.getByText("alice@u.nus.edu")).toBeInTheDocument();
    expect(await screen.findByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens and closes the sidebar from mobile controls", async () => {
    renderLayout();

    fireEvent.click(screen.getByLabelText(/open menu/i));
    expect(document.querySelector(".dashSidebar")).toHaveClass("open");

    fireEvent.click(screen.getByLabelText(/close sidebar/i));
    expect(document.querySelector(".dashSidebar")).not.toHaveClass("open");
  });

  it("navigates to profile and modules with avatar state", async () => {
    renderLayout(null, { avatarUrl: "state-avatar.png" });
    await screen.findByText("Alice Tan");

    fireEvent.click(screen.getByLabelText(/go to profile/i));
    expect(mockNav).toHaveBeenCalledWith("/profile");

    fireEvent.click(screen.getByText("Peer Tutoring"));
    expect(mockNav).toHaveBeenCalledWith("/", {
      state: { activeModule: "peerTutoring", avatarUrl: "avatar.png" },
    });
  });

  it("closes sidebar when active nav item is selected", () => {
    renderLayout();

    fireEvent.click(screen.getByLabelText(/open menu/i));
    fireEvent.click(screen.getByText("Study Groups"));

    expect(document.querySelector(".dashSidebar")).not.toHaveClass("open");
  });

  it("navigates to selected group chat", async () => {
    renderLayout();

    fireEvent.click(await screen.findByText("Algorithms"));

    expect(mockNav).toHaveBeenCalledWith("/", {
      state: { activeModule: "groupChats", selectedGroupChatId: "chat-1", avatarUrl: "avatar.png" },
    });
  });

  it("supports render-prop children, toast, confirm dialog, and logout", async () => {
    localStorage.setItem("accessToken", "token");
    renderLayout(({ showToast, setConfirmDialog }) => (
      <main>
        <button type="button" onClick={() => showToast("Saved", "success")}>Show toast</button>
        <button
          type="button"
          onClick={() => setConfirmDialog({
            message: "Confirm action?",
            confirmLabel: "Yes",
            cancelLabel: "No",
            onConfirm: vi.fn(),
            onCancel: () => setConfirmDialog(null),
          })}
        >
          Show confirm
        </button>
      </main>
    ));

    fireEvent.click(screen.getByText("Show toast"));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Saved"));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show confirm"));
    expect(screen.getByText("Confirm action?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("No"));
    expect(screen.queryByText("Confirm action?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Logout"));
    expect(screen.getByText(/are you sure you want to logout/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() => expect(localStorage.getItem("accessToken")).toBeNull());
  });

  it("updates avatar and name from profile update events", async () => {
    renderLayout();
    await screen.findByText("Alice Tan");

    emitProfileUpdated({ avatarUrl: "new-avatar.png", profileName: "New Name" });

    expect(await screen.findByText("New Name")).toBeInTheDocument();
    expect(screen.getAllByAltText("Avatar")[0]).toHaveAttribute("src", "new-avatar.png");
  });

  it("handles profile and chat loading failures gracefully", async () => {
    globalThis.fetch.mockRejectedValue(new Error("offline"));
    fetchAccessibleGroupChats.mockRejectedValue(new Error("chat failed"));

    renderLayout();

    expect(await screen.findByText("Student")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no joined group chats/i)).toBeInTheDocument());
  });
});
