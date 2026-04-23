import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import CreateAnnouncementForm from "../components/CreateAnnouncementForm";
import EditAnnouncementForm from "../components/EditAnnouncementForm";
import {
  getJoinedGroupsWithAnnouncements,
  deleteGroupAnnouncement,
  archiveAnnouncement,
  getArchivedAnnouncements,
  unarchiveAnnouncement,
} from "../services/announcements";
import "../styles/pages/Announcements.css";

/**
 * Announcements module — shows the combined announcement feed across every group
 * the current user has joined. Group filter pills above the feed let the user
 * narrow down to a single study group. Group owners/admins can additionally
 * post, edit, delete and archive announcements from this page.
 *
 * Mounted inline inside Home.jsx (as one of the dashboard modules) — NOT a
 * standalone route — so switching to it behaves like switching to any other
 * module: the URL stays on "/" and the sidebar does not re-render.
 */

const FILTER_ALL = "all";

function formatAnnouncementDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function sortByCreatedDesc(list) {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Sort groups alphabetically by module code first (case-insensitive, with
 * numeric segments collated naturally — so CS1010 < CS1020 < CS2030), then
 * by name as a tiebreak. Groups missing a module code sink to the end.
 */
function sortGroupsByModule(list) {
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  return [...list].sort((a, b) => {
    const codeA = (a.moduleCode || "").trim();
    const codeB = (b.moduleCode || "").trim();
    if (codeA && !codeB) return -1;
    if (!codeA && codeB) return 1;
    const byCode = collator.compare(codeA, codeB);
    if (byCode !== 0) return byCode;
    return collator.compare(a.name || "", b.name || "");
  });
}

function isGroupAdmin(groups, announcement) {
  const group = groups.find((g) => g.id === announcement.groupId);
  return !!group?.isAdmin;
}

export default function Announcements({ showToast, setConfirmDialog, initialSelectedGroupId }) {
  const initialFilter = initialSelectedGroupId || FILTER_ALL;
  const [announcements, setAnnouncements] = useState([]);
  const [archivedAnnouncements, setArchivedAnnouncements] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(initialFilter);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  // "active" = the default feed; "archived" = the user's archived-only list.
  // We fetch archived lazily on first switch so the initial page load stays fast.
  const [viewMode, setViewMode] = useState("active");
  const [archivedLoaded, setArchivedLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { groups: joinedGroups, announcements: feed } = await getJoinedGroupsWithAnnouncements();
        if (cancelled) return;
        setGroups(joinedGroups);
        setAnnouncements(sortByCreatedDesc(feed));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setGroups([]);
        setAnnouncements([]);
        setError(err?.message || "Failed to load announcements.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Fetch archived list on-demand the first time the user switches to the
  // Archived view; re-fetch on every subsequent switch so it stays fresh.
  useEffect(() => {
    if (viewMode !== "archived") return undefined;
    let cancelled = false;
    setArchivedLoading(true);
    getArchivedAnnouncements()
      .then((list) => {
        if (cancelled) return;
        setArchivedAnnouncements(sortByCreatedDesc(list));
        setArchivedLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load archived announcements.");
      })
      .finally(() => {
        if (!cancelled) setArchivedLoading(false);
      });
    return () => { cancelled = true; };
  }, [viewMode]);

  // In "active" view we show the normal feed; in "archived" view we show only
  // the items the user previously hid. The group-pill filter applies to both.
  const sourceAnnouncements = viewMode === "archived" ? archivedAnnouncements : announcements;
  const filteredAnnouncements = useMemo(() => {
    if (selectedFilter === FILTER_ALL) return sourceAnnouncements;
    return sourceAnnouncements.filter((ann) => ann.groupId === selectedFilter);
  }, [sourceAnnouncements, selectedFilter]);

  const sortedGroups = useMemo(() => sortGroupsByModule(groups), [groups]);

  const selectedGroup = selectedFilter === FILTER_ALL
    ? null
    : groups.find((g) => g.id === selectedFilter) || null;
  const canCreateAnnouncement = !!selectedGroup?.isAdmin;

  const renderFilterPills = () => (
    <div className="announcementsFilters" role="tablist" aria-label="Filter announcements by group">
      <button
        type="button"
        role="tab"
        aria-selected={selectedFilter === FILTER_ALL}
        className={`announcementsFilterPill ${selectedFilter === FILTER_ALL ? "active" : ""}`}
        onClick={() => setSelectedFilter(FILTER_ALL)}
      >
        All Groups
        <span className="announcementsFilterCount">{sourceAnnouncements.length}</span>
      </button>
      {sortedGroups.map((group) => {
        const count = sourceAnnouncements.filter((ann) => ann.groupId === group.id).length;
        // Label format: "Module · Group Name" (module first for easier scanning).
        const moduleLabel = group.moduleCode ? group.moduleCode : "General";
        const nameLabel = group.name || "Untitled Group";
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={selectedFilter === group.id}
            className={`announcementsFilterPill ${selectedFilter === group.id ? "active" : ""}`}
            onClick={() => setSelectedFilter(group.id)}
          >
            {`${moduleLabel} · ${nameLabel}`}
            <span className="announcementsFilterCount">{count}</span>
          </button>
        );
      })}
    </div>
  );

  const renderViewToggle = () => (
    <div className="announcementsViewToggle" role="tablist" aria-label="View active or archived announcements">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "active"}
        className={`announcementsFilterPill ${viewMode === "active" ? "active" : ""}`}
        onClick={() => setViewMode("active")}
      >
        Active
        <span className="announcementsFilterCount">{announcements.length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "archived"}
        className={`announcementsFilterPill ${viewMode === "archived" ? "active" : ""}`}
        onClick={() => setViewMode("archived")}
      >
        Archived
        <span className="announcementsFilterCount">
          {archivedLoaded ? archivedAnnouncements.length : "…"}
        </span>
      </button>
    </div>
  );

  // Inlined — showToast & setConfirmDialog come in as props from the parent
  // (Home.jsx) so we share the same toast/confirm plumbing as every other
  // module. No DashboardLayout render-prop wrapper is needed.
  const renderContent = () => {
    const handleCreated = (newAnnouncement) => {
      setAnnouncements((prev) => sortByCreatedDesc([newAnnouncement, ...prev]));
      showToast("Announcement posted successfully!", "success");
    };
    const handleUpdated = (updated) => {
      setAnnouncements((prev) =>
        sortByCreatedDesc(prev.map((ann) => (ann.id === updated.id ? updated : ann))),
      );
      setEditingAnnouncement(null);
      showToast("Announcement updated.", "success");
    };
    const handleDelete = (announcement) => {
      setConfirmDialog({
        message: "Delete this announcement? This action cannot be undone.",
        confirmBtnClass: "confirmBtnRed",
        cancelBtnClass: "confirmBtnOutline",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onCancel: () => setConfirmDialog(null),
        onConfirm: async () => {
          setConfirmDialog(null);
          try {
            await deleteGroupAnnouncement(announcement.groupId, announcement.id);
            setAnnouncements((prev) => prev.filter((ann) => ann.id !== announcement.id));
            showToast("Announcement deleted.", "success");
          } catch (err) {
            showToast(err.message || "Failed to delete announcement", "error");
          }
        },
      });
    };
    const handleArchive = async (announcement) => {
      try {
        await archiveAnnouncement(announcement.groupId, announcement.id);
        // Remove from the active feed and (optimistically) push into the
        // archived feed so the user sees it instantly if they switch views.
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== announcement.id));
        setArchivedAnnouncements((prev) => sortByCreatedDesc([announcement, ...prev.filter((a) => a.id !== announcement.id)]));
        showToast("Announcement archived for you.", "success");
      } catch (err) {
        showToast(err.message || "Failed to archive announcement", "error");
      }
    };
    const handleUnarchive = async (announcement) => {
      try {
        await unarchiveAnnouncement(announcement.groupId, announcement.id);
        // Mirror handleArchive: remove from archived, splice back into active.
        setArchivedAnnouncements((prev) => prev.filter((ann) => ann.id !== announcement.id));
        setAnnouncements((prev) => sortByCreatedDesc([announcement, ...prev.filter((a) => a.id !== announcement.id)]));
        showToast("Announcement restored.", "success");
      } catch (err) {
        showToast(err.message || "Failed to restore announcement", "error");
      }
    };

    if (loading) {
      return (
        <main className="announcementsMain">
          <div className="announcementsLoading" role="status" aria-live="polite">
            <div className="announcementsSpinner" aria-hidden="true" />
            <span>Loading announcements…</span>
          </div>
        </main>
      );
    }

    if (error) {
      return (
        <main className="announcementsMain">
          <div className="announcementsError" role="alert">
            <p>{error}</p>
          </div>
        </main>
      );
    }

    return (
      <main className="announcementsMain">
        <div className="announcementsHeader">
          <h1 className="announcementsTitle">Announcements</h1>
          <p className="announcementsSubtitle">
            Stay updated with announcements from your study groups
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="announcementsEmpty">
            <p>You have not joined any study groups yet.</p>
            <p className="announcementsEmptySub">
              Join a group from the dashboard to see its announcements here.
            </p>
          </div>
        ) : (
          <>
            {renderViewToggle()}
            {renderFilterPills()}

            {/* Posting is an "active view" operation — no point offering to
                create an announcement while the user is looking at archives. */}
            {viewMode === "active" && selectedGroup && canCreateAnnouncement && (
              <CreateAnnouncementForm
                groupId={selectedGroup.id}
                onSuccess={handleCreated}
                onError={(err) => showToast(err.message || "Create failed", "error")}
              />
            )}

            {viewMode === "active" && selectedGroup && !canCreateAnnouncement && (
              <div className="announcementsCreatePrompt">
                Only the group owner or admins can post announcements for this group.
              </div>
            )}

            {viewMode === "archived" && archivedLoading && !archivedLoaded ? (
              <div className="announcementsLoading" role="status" aria-live="polite">
                <div className="announcementsSpinner" aria-hidden="true" />
                <span>Loading archived announcements…</span>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="announcementsEmpty">
                <p>
                  {viewMode === "archived"
                    ? "You haven't archived any announcements yet."
                    : selectedFilter === FILTER_ALL
                    ? "No announcements yet. Stay tuned!"
                    : `No announcements from ${selectedGroup?.name || "this group"}.`}
                </p>
                <p className="announcementsEmptySub">
                  {viewMode === "archived"
                    ? "Archived items you hide will appear here and can be restored."
                    : "When group owners post announcements, they'll appear here."}
                </p>
              </div>
            ) : (
              <div className="announcementsFeed">
                {filteredAnnouncements.map((ann) => {
                  const canManage = isGroupAdmin(groups, ann);
                  return (
                    <article key={ann.id} className="announcementCard">
                      <header className="announcementCardHeader">
                        <div className="announcementGroupInfo">
                          {/* Module first, then the group name — matches the filter pills */}
                          {ann.moduleCode && (
                            <span className="announcementModule">{ann.moduleCode}</span>
                          )}
                          <h3 className="announcementGroup">{ann.groupName || "Group"}</h3>
                        </div>
                        <div className="announcementCardActions">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                className="announcementActionBtn edit"
                                onClick={() => setEditingAnnouncement(ann)}
                                aria-label="Edit announcement"
                                title="Edit"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="announcementActionBtn delete"
                                onClick={() => handleDelete(ann)}
                                aria-label="Delete announcement"
                                title="Delete"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {viewMode === "archived" ? (
                            <button
                              type="button"
                              className="announcementActionBtn archive"
                              onClick={() => handleUnarchive(ann)}
                              aria-label="Restore this announcement to your active feed"
                              title="Restore"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="announcementActionBtn archive"
                              onClick={() => handleArchive(ann)}
                              aria-label="Archive (hide) this announcement"
                              title="Archive (hide)"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </header>

                      <h2 className="announcementTitle">{ann.title}</h2>
                      <p className="announcementContent">{ann.content}</p>

                      <footer className="announcementCardFooter">
                        <span className="announcementAuthor">
                          Posted by {ann.authorName || ann.authorEmail || "Unknown"}
                          {ann.createdAt && (
                            <>
                              {" on "}
                              <span className="announcementTime">{formatAnnouncementDate(ann.createdAt)}</span>
                            </>
                          )}
                        </span>
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {editingAnnouncement && (
          <div
            className="announcementsModalOverlay"
            onClick={() => setEditingAnnouncement(null)}
            role="presentation"
          >
            <div
              className="announcementsModal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="announcementsEditTitle"
            >
              <EditAnnouncementForm
                groupId={editingAnnouncement.groupId}
                announcement={editingAnnouncement}
                onSuccess={handleUpdated}
                onCancel={() => setEditingAnnouncement(null)}
              />
            </div>
          </div>
        )}
      </main>
    );
  };

  return renderContent();
}

Announcements.propTypes = {
  showToast: PropTypes.func.isRequired,
  setConfirmDialog: PropTypes.func.isRequired,
  initialSelectedGroupId: PropTypes.string,
};
