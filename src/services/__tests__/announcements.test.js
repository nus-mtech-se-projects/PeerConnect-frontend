import {
  getGroupAnnouncements,
  getJoinedAnnouncementsFeed,
  getJoinedGroups,
  getJoinedGroupsWithAnnouncements,
  createGroupAnnouncement,
  updateGroupAnnouncement,
  deleteGroupAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  getArchivedAnnouncements,
} from "../announcements";

const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const ANNOUNCEMENT_ID = "22222222-2222-2222-2222-222222222222";
const API_BASE = "http://localhost:8080";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function errorResponse(message, status = 400) {
  return { ok: false, status, json: async () => ({ error: message }) };
}

describe("announcements service", () => {
  let fetchSpy;

  beforeEach(() => {
    localStorage.setItem("accessToken", "test-token");
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /* ── happy paths ─────────────────────────────────────────────────── */

  it("getGroupAnnouncements GETs the right URL with bearer token", async () => {
    const payload = [{ id: "a1", title: "Hello" }];
    fetchSpy.mockResolvedValueOnce(jsonResponse(payload));

    const result = await getGroupAnnouncements(GROUP_ID);

    expect(result).toEqual(payload);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/groups/${GROUP_ID}/announcements`);
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.credentials).toBe("include");
  });

  it("getJoinedAnnouncementsFeed coerces a non-array response to []", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ unexpected: "shape" }));

    const result = await getJoinedAnnouncementsFeed();

    expect(result).toEqual([]);
  });

  it("getJoinedGroups filters out groups where joined === false", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse([
        { id: "g1", joined: true },
        { id: "g2", joined: false },
        { id: "g3" }, // joined missing → kept
      ]),
    );

    const result = await getJoinedGroups();

    expect(result.map((g) => g.id)).toEqual(["g1", "g3"]);
  });

  it("getJoinedGroupsWithAnnouncements fans out two requests in parallel", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse([{ id: "g1", joined: true }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "a1" }]));

    const result = await getJoinedGroupsWithAnnouncements();

    expect(result.groups).toHaveLength(1);
    expect(result.announcements).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("createGroupAnnouncement POSTs JSON and returns the created announcement", async () => {
    const payload = { title: "T", content: "C" };
    const created = { id: "a1", ...payload };
    fetchSpy.mockResolvedValueOnce(jsonResponse(created));

    const result = await createGroupAnnouncement(GROUP_ID, payload);

    expect(result).toEqual(created);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/groups/${GROUP_ID}/announcements`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(payload);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("updateGroupAnnouncement PUTs JSON to the announcement-specific URL", async () => {
    const payload = { title: "T2", content: "C2" };
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: ANNOUNCEMENT_ID, ...payload }));

    await updateGroupAnnouncement(GROUP_ID, ANNOUNCEMENT_ID, payload);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/groups/${GROUP_ID}/announcements/${ANNOUNCEMENT_ID}`,
    );
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it("deleteGroupAnnouncement DELETEs without a body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 204 }));

    await deleteGroupAnnouncement(GROUP_ID, ANNOUNCEMENT_ID);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/groups/${GROUP_ID}/announcements/${ANNOUNCEMENT_ID}`,
    );
    expect(options.method).toBe("DELETE");
    expect(options.body).toBeUndefined();
  });

  it("archiveAnnouncement POSTs to the /archive sub-resource", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 204 }));

    await archiveAnnouncement(GROUP_ID, ANNOUNCEMENT_ID);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/groups/${GROUP_ID}/announcements/${ANNOUNCEMENT_ID}/archive`,
    );
    expect(options.method).toBe("POST");
  });

  it("unarchiveAnnouncement DELETEs the /archive sub-resource", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 204 }));

    await unarchiveAnnouncement(GROUP_ID, ANNOUNCEMENT_ID);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/groups/${GROUP_ID}/announcements/${ANNOUNCEMENT_ID}/archive`,
    );
    expect(options.method).toBe("DELETE");
  });

  it("getArchivedAnnouncements coerces non-array responses to []", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(null));

    const result = await getArchivedAnnouncements();

    expect(result).toEqual([]);
  });

  /* ── error parsing ───────────────────────────────────────────────── */

  it("surfaces the server's `error` field for non-2xx responses", async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse("Title is required", 400));

    await expect(
      createGroupAnnouncement(GROUP_ID, { title: "", content: "x" }),
    ).rejects.toThrow("Title is required");
  });

  it("falls back to `message` when the server doesn't use `error`", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Not authorized" }),
    });

    await expect(getGroupAnnouncements(GROUP_ID)).rejects.toThrow("Not authorized");
  });

  it("falls back to `<fallback> (<status>)` when the body isn't JSON", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(getGroupAnnouncements(GROUP_ID)).rejects.toThrow(
      /Failed to load announcements \(500\)/,
    );
  });

  it("translates AbortError into 'Request timed out'", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    fetchSpy.mockRejectedValueOnce(abortErr);

    await expect(getGroupAnnouncements(GROUP_ID)).rejects.toThrow(
      "Request timed out",
    );
  });

  /* ── auth header behaviour ───────────────────────────────────────── */

  it("omits the Authorization header when there is no token", async () => {
    localStorage.removeItem("accessToken");
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await getGroupAnnouncements(GROUP_ID);

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });
});
