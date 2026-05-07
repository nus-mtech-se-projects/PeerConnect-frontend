// Note: the hook imports getUnreadAnnouncementCount and markAnnouncementsRead
// from services/announcements, but those exports don't currently exist. We
// mock the module so these tests cover the hook's wiring (listeners, refetch,
// cancel flag) without depending on the missing exports.

import { act, renderHook, waitFor } from "@testing-library/react";
import {
  notifyUnreadChanged,
  useUnreadAnnouncements,
} from "../unreadAnnouncements";
import {
  getUnreadAnnouncementCount,
} from "../../services/announcements";

vi.mock("../../services/announcements", () => ({
  getUnreadAnnouncementCount: vi.fn(),
  markAnnouncementsRead: vi.fn(),
}));

describe("useUnreadAnnouncements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUnreadAnnouncementCount.mockResolvedValue({ total: 0, byGroup: {} });
  });

  /* ── initial fetch ───────────────────────────────────────────────── */

  it("fetches the count on mount and exposes total + byGroup", async () => {
    getUnreadAnnouncementCount.mockResolvedValueOnce({
      total: 7,
      byGroup: { "g-1": 3, "g-2": 4 },
    });

    const { result } = renderHook(() => useUnreadAnnouncements());

    await waitFor(() => {
      expect(result.current.total).toBe(7);
      expect(result.current.byGroup).toEqual({ "g-1": 3, "g-2": 4 });
    });
    expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1);
  });

  it("falls back to {} for byGroup when the API omits it", async () => {
    getUnreadAnnouncementCount.mockResolvedValueOnce({ total: 2 });

    const { result } = renderHook(() => useUnreadAnnouncements());

    await waitFor(() => {
      expect(result.current.total).toBe(2);
      expect(result.current.byGroup).toEqual({});
    });
  });

  /* ── invalidation event refetch ─────────────────────────────────── */

  it("refetches when the announcements:invalidate event fires", async () => {
    const { result } = renderHook(() => useUnreadAnnouncements());
    await waitFor(() => expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1));

    getUnreadAnnouncementCount.mockResolvedValueOnce({ total: 5, byGroup: {} });

    act(() => {
      window.dispatchEvent(new Event("announcements:invalidate"));
    });

    await waitFor(() => expect(result.current.total).toBe(5));
    expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(2);
  });

  /* ── focus refetch ──────────────────────────────────────────────── */

  it("refetches when the window regains focus", async () => {
    renderHook(() => useUnreadAnnouncements());
    await waitFor(() => expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(2));
  });

  /* ── listener cleanup ───────────────────────────────────────────── */

  it("removes both event listeners on unmount", async () => {
    const { unmount } = renderHook(() => useUnreadAnnouncements());
    await waitFor(() => expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1));

    unmount();

    window.dispatchEvent(new Event("announcements:invalidate"));
    window.dispatchEvent(new Event("focus"));

    await new Promise((r) => setTimeout(r, 0));
    expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1);
  });

  /* ── refresh callback ───────────────────────────────────────────── */

  it("exposes a refresh() callback that triggers a manual refetch", async () => {
    const { result } = renderHook(() => useUnreadAnnouncements());
    await waitFor(() => expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(1));

    getUnreadAnnouncementCount.mockResolvedValueOnce({ total: 9, byGroup: {} });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.total).toBe(9);
    expect(getUnreadAnnouncementCount).toHaveBeenCalledTimes(2);
  });
});

describe("notifyUnreadChanged", () => {
  it("dispatches the announcements:invalidate event", () => {
    const handler = vi.fn();
    window.addEventListener("announcements:invalidate", handler);

    notifyUnreadChanged();

    expect(handler).toHaveBeenCalled();
    window.removeEventListener("announcements:invalidate", handler);
  });

  it("swallows errors from window.dispatchEvent (SSR / Node env safety)", () => {
    const original = window.dispatchEvent;
    window.dispatchEvent = () => { throw new Error("not in a browser"); };

    // Should NOT throw
    expect(() => notifyUnreadChanged()).not.toThrow();

    window.dispatchEvent = original;
  });
});
