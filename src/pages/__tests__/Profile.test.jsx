import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Profile from "../Profile";
import { useMsal } from "@azure/msal-react";

const mockNav = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNav };
});

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(() => ({ accounts: [] })),
}));

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
    useMsal.mockReturnValue({ accounts: [] });
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
    const user = userEvent.setup();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    const facultySelect = await screen.findByRole("combobox", { name: /faculty/i });
    await user.selectOptions(facultySelect, "School of Computing");

    expect(screen.getByRole("combobox", { name: /major/i })).not.toBeDisabled();
  });

  it("changing faculty resets the major selection", async () => {
    mockFetchProfile({ faculty: "School of Computing", major: "Computer Science" });
    const user = userEvent.setup();
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

    const user = userEvent.setup();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /save profile/i });
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText(/profile saved successfully/i)).toBeInTheDocument();
  });

  it("shows error message on failed save", async () => {
    mockFetchProfile();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const user = userEvent.setup();
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

    const user = userEvent.setup();
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

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("navigates to /change-password when Change Password is clicked", async () => {
    mockFetchProfile();
    const user = userEvent.setup();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await screen.findByRole("button", { name: /change password/i });
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(mockNav).toHaveBeenCalledWith("/change-password");
  });
});
