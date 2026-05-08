import { getSwaUser, SWA_LOGIN_URL, SWA_LOGOUT_URL } from "../AuthConfig";

describe("AuthConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports SWA auth paths", () => {
    expect(SWA_LOGIN_URL).toBe("/.auth/login/aad");
    expect(SWA_LOGOUT_URL).toBe("/.auth/logout");
  });

  it("returns the SWA client principal when present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({ clientPrincipal: { userId: "user-1" } }),
    });

    await expect(getSwaUser()).resolves.toEqual({ userId: "user-1" });
  });

  it("returns null when SWA has no client principal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({}),
    });

    await expect(getSwaUser()).resolves.toBeNull();
  });

  it("returns null when the SWA auth request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    await expect(getSwaUser()).resolves.toBeNull();
  });
});
