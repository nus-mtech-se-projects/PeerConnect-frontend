import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Profile from "../Profile";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

const emptyProfile = {
  faculty: "",
  major: "",
  yearOfStudy: "",
  fullTime: true,
  bio: "",
  avatarUrl: "",
};

function mockFetchProfile(overrides = {}) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ...emptyProfile, ...overrides }),
  });
}

describe("Profile page", () => {
  beforeEach(() => {
    mockNav.mockClear();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:avatar-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it("shows loading message while fetching profile", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise(() => {}));
    render(<MemoryRouter><Profile /></MemoryRouter>);
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders form after profile loads", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    expect(await screen.findByRole("combobox", { name: /faculty/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /major/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /year of study/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tell others about yourself/i)).toBeInTheDocument();
  });

  it("populates form fields from API response", async () => {
    mockFetchProfile({
      faculty: "School of Computing",
      major: "Computer Science",
      yearOfStudy: 2,
      bio: "I love coding",
    });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    expect(await screen.findByDisplayValue("School of Computing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Computer Science")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Year 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("I love coding")).toBeInTheDocument();
  });

  it("falls back to user name and avatar values from the profile response", async () => {
    mockFetchProfile({
      name: "Fallback Name",
      email: "fallback@u.nus.edu",
      fullTime: false,
      avatarUrl: "https://cdn.example/avatar.png",
    });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    expect(await screen.findByText("Fallback Name")).toBeInTheDocument();
    expect(screen.getByText("fallback@u.nus.edu")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar")).toHaveAttribute("src", "https://cdn.example/avatar.png");
    expect(screen.getByLabelText(/no/i)).toBeChecked();
  });

  it("keeps the default form when profile loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    render(<MemoryRouter><Profile /></MemoryRouter>);

    expect(await screen.findByText("Student")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("redirects to login when loading profile is unauthorized", async () => {
    localStorage.setItem("accessToken", "token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 401 });

    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith("/login");
    });
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("renders Save Profile and Change Password buttons", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument();
  });

  // ── Faculty / Major cascade ────────────────────────────────────────────────

  it("major select is disabled when no faculty is selected", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    const majorSelect = await screen.findByRole("combobox", { name: /major/i });
    expect(majorSelect).toBeDisabled();
  });

  it("major select is enabled after selecting a faculty", async () => {
    mockFetchProfile();
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    const facultySelect = await screen.findByRole("combobox", { name: /faculty/i });
    await user.selectOptions(facultySelect, "School of Computing");

    expect(screen.getByRole("combobox", { name: /major/i })).not.toBeDisabled();
  });

  it("changing faculty resets the major selection", async () => {
    mockFetchProfile({ faculty: "School of Computing", major: "Computer Science" });
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByDisplayValue("Computer Science");

    const facultySelect = screen.getByRole("combobox", { name: /faculty/i });
    await user.selectOptions(facultySelect, "Faculty of Science");

    expect(screen.getByRole("combobox", { name: /major/i })).toHaveValue("");
  });

  // ── Save ───────────────────────────────────────────────────────────────────

  it("shows success message on successful save", async () => {
    mockFetchProfile();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText(/profile saved successfully/i)).toBeInTheDocument();
  });

  it("sends normalized profile values when saving", async () => {
    mockFetchProfile();
    const saveSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await user.selectOptions(await screen.findByRole("combobox", { name: /faculty/i }), "School of Computing");
    await user.selectOptions(screen.getByRole("combobox", { name: /major/i }), "Computer Science");
    await user.selectOptions(screen.getByRole("combobox", { name: /year of study/i }), "3");
    await user.click(screen.getByLabelText(/no/i));
    await user.type(screen.getByPlaceholderText(/tell others about yourself/i), "  Hello NUS  ");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("/api/profile"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            faculty: "School of Computing",
            major: "Computer Science",
            yearOfStudy: 3,
            fullTime: false,
            bio: "Hello NUS",
            avatarUrl: null,
          }),
        }),
      );
    });
  });

  it("redirects to login when saving is unauthorized", async () => {
    mockFetchProfile();
    localStorage.setItem("accessToken", "token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 403 });

    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith("/login");
    });
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("shows error message on failed save", async () => {
    mockFetchProfile();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });

  it("shows loading state while saving", async () => {
    mockFetchProfile();

    let resolve;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((r) => { resolve = r; })
    );

    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByRole("button", { name: /saving/i })).toBeDisabled();

    resolve({ ok: true });
  });

  // ── Avatar validation ──────────────────────────────────────────────────────

  it("shows error when an unsupported file type is dropped", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });

    const file = new File(["content"], "image.gif", { type: "image/gif" });
    const input = document.querySelector("input[type='file']");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/only png or jpg files are allowed/i)).toBeInTheDocument();
  });

  it("shows error when file exceeds 2 MB", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });

    const file = new File(["x".repeat(10)], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    const input = document.querySelector("input[type='file']");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/file must be smaller than 2 mb/i)).toBeInTheDocument();
  });

  it("uploads a valid avatar and then removes it", async () => {
    mockFetchProfile();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ avatarUrl: "https://cdn.example/new-avatar.png" }),
      })
      .mockResolvedValueOnce({ ok: true });
    localStorage.setItem("accessToken", "avatar-token");

    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    const file = new File(["content"], "avatar.png", { type: "image/png" });
    fireEvent.change(document.querySelector("input[type='file']"), { target: { files: [file] } });

    expect(await screen.findByAltText("Avatar")).toHaveAttribute("src", "https://cdn.example/new-avatar.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-preview");

    fireEvent.click(screen.getByTitle("Remove avatar"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("/api/profile/avatar"),
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: "Bearer avatar-token" },
        }),
      );
    });
    expect(screen.queryByAltText("Avatar")).not.toBeInTheDocument();
  });

  it("shows an error when avatar upload fails", async () => {
    mockFetchProfile();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 413 });

    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(document.querySelector("input[type='file']"), { target: { files: [file] } });

    expect(await screen.findByText(/upload failed \(413\)/i)).toBeInTheDocument();
    expect(screen.queryByAltText("Avatar")).not.toBeInTheDocument();
  });

  it("handles drag states and empty file selections", async () => {
    mockFetchProfile();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    const dropZone = screen.getByText(/click or drag image here/i).closest("button");

    fireEvent.dragOver(dropZone);
    expect(dropZone).toHaveClass("profileDropZoneActive");

    fireEvent.dragLeave(dropZone);
    expect(dropZone).not.toHaveClass("profileDropZoneActive");

    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });
    expect(screen.queryByText(/upload failed/i)).not.toBeInTheDocument();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("navigates to /change-password when Change Password is clicked", async () => {
    mockFetchProfile();
    const user = userEvent.setup({ delay: null });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /change password/i });
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(mockNav).toHaveBeenCalledWith("/change-password");
  });
});
