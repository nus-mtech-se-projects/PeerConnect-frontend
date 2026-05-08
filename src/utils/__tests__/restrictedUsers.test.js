import {
  createAllowConfirmDialog,
  executeRestrictionAction,
  formatRestrictedUserName,
  getRuMemberInitials,
  loadRestrictedUsers,
  ruAuthRequestOptions,
  ruParseJsonOrEmpty,
} from "../restrictedUsers";

describe("restrictedUsers utilities", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "restrict-token");
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats initials and display names with fallbacks", () => {
    expect(getRuMemberInitials({ firstName: "Alice", lastName: "Tan" })).toBe("A");
    expect(getRuMemberInitials({ lastName: "Tan" })).toBe("T");
    expect(getRuMemberInitials(null)).toBe("?");
    expect(formatRestrictedUserName({ firstName: "Alice", lastName: "Tan" })).toBe("Alice Tan");
    expect(formatRestrictedUserName({})).toBe("—");
  });

  it("builds authenticated request options and allows overrides", () => {
    expect(ruAuthRequestOptions({ method: "POST" })).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ Authorization: "Bearer restrict-token" }),
      })
    );
  });

  it("parses JSON or returns an empty object", async () => {
    await expect(ruParseJsonOrEmpty({ json: async () => ({ ok: true }) })).resolves.toEqual({ ok: true });
    await expect(ruParseJsonOrEmpty({ json: async () => { throw new Error("bad json"); } })).resolves.toEqual({});
  });

  it("creates allow confirmation dialog callbacks", () => {
    const setConfirmDialog = vi.fn();
    const executeAllow = vi.fn();
    const showToast = vi.fn();
    const dialog = createAllowConfirmDialog("u1", setConfirmDialog, executeAllow, showToast);

    expect(dialog.message).toMatch(/allow this user/i);
    dialog.onConfirm();
    expect(setConfirmDialog).toHaveBeenCalledWith(null);
    expect(executeAllow).toHaveBeenCalledWith("u1", showToast);

    dialog.onCancel();
    expect(setConfirmDialog).toHaveBeenCalledWith(null);
  });

  it("executes restriction action success flow and updates search results", async () => {
    const showToast = vi.fn();
    const loadRestricted = vi.fn();
    const setSearchResults = vi.fn((updater) => {
      expect(updater([{ userId: "u1", restricted: false }])).toEqual([{ userId: "u1", restricted: true }]);
    });
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await executeRestrictionAction({
      userId: "u1",
      method: "POST",
      url: "/restrict",
      fallbackError: "Restrict failed",
      successMessage: "Restricted",
      restrictedValue: true,
      showToast,
      loadRestricted,
      setSearchResults,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/restrict",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "u1" }),
      })
    );
    expect(showToast).toHaveBeenCalledWith("Restricted");
    expect(loadRestricted).toHaveBeenCalled();
    expect(setSearchResults).toHaveBeenCalled();
  });

  it("executes restriction action error flow", async () => {
    const showToast = vi.fn();
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Already restricted" }),
    });

    await executeRestrictionAction({
      userId: "u1",
      method: "DELETE",
      url: "/restrict/u1",
      fallbackError: "Allow failed",
      successMessage: "Allowed",
      restrictedValue: false,
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith("Already restricted", "error");
  });

  it("loads restricted users or returns [] on failure", async () => {
    const showToast = vi.fn();
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ userId: "u1" }],
    });

    await expect(loadRestrictedUsers(showToast)).resolves.toEqual([{ userId: "u1" }]);

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(loadRestrictedUsers(showToast)).resolves.toEqual([]);
    expect(showToast).toHaveBeenCalledWith("Failed (500)", "error");
  });
});
