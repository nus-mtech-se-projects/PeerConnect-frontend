/**
 * Announcements API service
 * Handles all API calls related to group announcements and announcement feeds.
 *
 * All requests reuse the shared JWT helpers from `../utils/auth` so the bearer
 * token, content-type and API base URL behave identically to the rest of the app.
 */

import { API_BASE, authHeaders } from "../utils/auth";

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Small fetch wrapper with a timeout so a wedged network call cannot hang
 * the page forever. Mirrors the ergonomics of `fetch` for simple call sites.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorMessage(res, fallback) {
  try {
    const data = await res.json();
    if (data && (data.error || data.message)) {
      return data.error || data.message;
    }
  } catch {
    /* response body was not JSON */
  }
  return `${fallback} (${res.status})`;
}

/**
 * List announcements for a single group.
 * GET /api/groups/{groupId}/announcements
 */
export async function getGroupAnnouncements(groupId) {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/announcements`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load announcements"));
  }
  return res.json();
}

/**
 * Fetch the feed of announcements from every group the user has joined.
 * Uses the dedicated backend endpoint which returns one flat list, already
 * sorted, with `groupName` + `moduleCode` populated server-side.
 * GET /api/groups/joined/announcements
 */
export async function getJoinedAnnouncementsFeed() {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/joined/announcements`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load announcements"));
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch the list of groups the user has joined. We reuse the existing
 * `/api/groups` endpoint and filter client-side so this module has no new
 * backend dependency. Used by the Announcements page sidebar.
 */
export async function getJoinedGroups() {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load groups"));
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((g) => (typeof g.joined === "boolean" ? g.joined : true));
}

/**
 * Load everything the Announcements page needs in a single call site:
 * the joined-groups list for the sidebar, plus the combined announcement feed.
 * Returns `{ groups, announcements }`.
 */
export async function getJoinedGroupsWithAnnouncements() {
  const [groups, announcements] = await Promise.all([
    getJoinedGroups(),
    getJoinedAnnouncementsFeed(),
  ]);
  return { groups, announcements };
}

/**
 * Create an announcement for a group (owner/admin only, enforced server-side).
 * POST /api/groups/{groupId}/announcements
 */
export async function createGroupAnnouncement(groupId, payload) {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/announcements`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to create announcement"));
  }
  return res.json();
}

/**
 * Update an announcement. Only the creator or an owner/admin can update.
 * PUT /api/groups/{groupId}/announcements/{announcementId}
 */
export async function updateGroupAnnouncement(groupId, announcementId, payload) {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/groups/${groupId}/announcements/${announcementId}`,
    {
      method: "PUT",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to update announcement"));
  }
  return res.json();
}

/**
 * Delete an announcement. Only the creator or an owner/admin can delete.
 * DELETE /api/groups/{groupId}/announcements/{announcementId}
 */
export async function deleteGroupAnnouncement(groupId, announcementId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/groups/${groupId}/announcements/${announcementId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to delete announcement"));
  }
}

/**
 * Archive (hide) an announcement for the current user only. Non-destructive —
 * other members still see it. Any approved member can archive.
 * POST /api/groups/{groupId}/announcements/{announcementId}/archive
 */
export async function archiveAnnouncement(groupId, announcementId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/groups/${groupId}/announcements/${announcementId}/archive`,
    {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to archive announcement"));
  }
}

/**
 * Restore a previously-archived announcement so it appears in the active feed
 * again. DELETE semantics because we're removing the per-user archive record.
 */
export async function unarchiveAnnouncement(groupId, announcementId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/groups/${groupId}/announcements/${announcementId}/archive`,
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to restore announcement"));
  }
}

/**
 * Fetch the current user's archived announcements across every joined group.
 * GET /api/groups/joined/announcements/archived
 */
export async function getArchivedAnnouncements() {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/joined/announcements/archived`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Failed to load archived announcements"));
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
