/**
 * Small event bus + React hook for the unread-announcements badge.
 *
 * The badge is shown in two different sidebars (DashboardLayout.jsx and the
 * inline nav in Home.jsx) and is also invalidated from at least three places:
 *   - Opening the Announcements module (mark all read)
 *   - Opening a single group's announcements tab in GroupDetail
 *   - Creating / archiving an announcement (which can change the count)
 *
 * Rather than thread callbacks through half the app, we use a browser
 * custom-event named `announcements:invalidate`. Anyone who wants the badge
 * to refetch calls `notifyUnreadChanged()`; every mounted `useUnreadAnnouncements`
 * hook refetches in response. Failures are swallowed so the badge never
 * blocks the UI.
 */

import { useCallback, useEffect, useState } from "react";
import { getUnreadAnnouncementCount, markAnnouncementsRead } from "../services/announcements";

const INVALIDATE_EVENT = "announcements:invalidate";

/**
 * Tell every mounted unread-announcements subscriber to refetch. Called after
 * any action that could change the count (mark-read, create, archive, etc.).
 */
export function notifyUnreadChanged() {
  try {
    window.dispatchEvent(new Event(INVALIDATE_EVENT));
  } catch {
    /* SSR / Node test env — nothing to do */
  }
}

/**
 * Mark announcements read (optionally scoped to one groupId) and bump the
 * badge. This is the canonical "the user has seen the announcement(s)" call.
 */
export async function markAnnouncementsReadAndNotify(groupId = null) {
  await markAnnouncementsRead(groupId);
  notifyUnreadChanged();
}

/**
 * Subscribe to the unread count. Returns `{ total, byGroup, refresh }`.
 * The hook fetches on mount, on window-focus (so returning from another tab
 * picks up announcements posted elsewhere), and whenever `notifyUnreadChanged`
 * fires.
 */
export function useUnreadAnnouncements() {
  const [total, setTotal] = useState(0);
  const [byGroup, setByGroup] = useState({});

  const refresh = useCallback(async () => {
    const counts = await getUnreadAnnouncementCount();
    setTotal(counts.total);
    setByGroup(counts.byGroup || {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const counts = await getUnreadAnnouncementCount();
      if (cancelled) return;
      setTotal(counts.total);
      setByGroup(counts.byGroup || {});
    }

    run();

    const onInvalidate = () => { run(); };
    const onFocus = () => { run(); };
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { total, byGroup, refresh };
}
