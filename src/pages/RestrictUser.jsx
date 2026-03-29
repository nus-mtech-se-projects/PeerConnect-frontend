import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import DashboardLayout from "../components/DashboardLayout";
import { RestrictIcon, SearchIcon } from "../components/Icons";
import { API_BASE, authHeaders, waitForToken } from "../utils/auth";
import "../styles/pages/RestrictUser.css";

function formatUserName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
}

function RestrictionActionButton({ userId, restricted, actionId, onRestrict, onAllow }) {
  const busy = actionId === userId;
  if (restricted) {
    return (
      <button className="ruAllowBtn" disabled={busy} onClick={() => onAllow(userId)}>
        {busy ? "…" : "Allow"}
      </button>
    );
  }

  return (
    <button className="ruRestrictBtn" disabled={busy} onClick={() => onRestrict(userId)}>
      {busy ? "…" : "Restrict"}
    </button>
  );
}

RestrictionActionButton.propTypes = {
  userId: PropTypes.string.isRequired,
  restricted: PropTypes.bool.isRequired,
  actionId: PropTypes.string,
  onRestrict: PropTypes.func.isRequired,
  onAllow: PropTypes.func.isRequired,
};

function RestrictUsersTable({ rows, actionId, onRestrict, onAllow, showRestrictedOn = false }) {
  return (
    <div className="ruTableWrap">
      <table className="ruTable">
        <thead>
          <tr>
            <th>Name</th>
            {showRestrictedOn && <th>Restricted On</th>}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => {
            const userId = user.userId || user.restrictedUserId;
            return (
              <tr key={userId}>
                <td>{formatUserName(user)}</td>
                {showRestrictedOn && (
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                )}
                <td>
                  <RestrictionActionButton
                    userId={userId}
                    restricted={showRestrictedOn || !!user.restricted}
                    actionId={actionId}
                    onRestrict={onRestrict}
                    onAllow={onAllow}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

RestrictUsersTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    userId: PropTypes.string,
    restrictedUserId: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    createdAt: PropTypes.string,
    restricted: PropTypes.bool,
  })).isRequired,
  actionId: PropTypes.string,
  onRestrict: PropTypes.func.isRequired,
  onAllow: PropTypes.func.isRequired,
  showRestrictedOn: PropTypes.bool,
};

export default function RestrictUser() {
  const [restrictedList, setRestrictedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);
  const searchTimer = useRef(null);

  /* Fetch restricted list */
  async function loadRestricted(showToast) {
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users`, { headers: authHeaders(), credentials: "include" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setRestrictedList(Array.isArray(data) ? data : []);
    } catch (err) { if (showToast) showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    waitForToken().then(() => loadRestricted()).catch(() => setLoading(false));
  }, []);

  function updateSearchRestricted(userId, restricted) {
    setSearchResults((prev) => prev.map((u) => u.userId === userId ? { ...u, restricted } : u));
  }

  /* Search users (debounced) */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/restricted-users/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: authHeaders(), credentials: "include",
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  async function executeRestrict(userId, showToast) {
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users`, {
        method: "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Restrict failed (${res.status})`);
      showToast("User restricted successfully!");
      await loadRestricted(showToast);
      updateSearchRestricted(userId, true);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionId(null); }
  }

  async function executeAllow(userId, showToast) {
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users/${userId}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Allow failed (${res.status})`);
      showToast("User allowed successfully!");
      await loadRestricted(showToast);
      updateSearchRestricted(userId, false);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionId(null); }
  }

  return (
    <DashboardLayout activeNav="restrict">
      {({ showToast, setConfirmDialog }) => {

        function handleRestrict(userId) {
          setActionId(userId);
          executeRestrict(userId, showToast);
        }

        function handleAllow(userId) {
          setConfirmDialog({
            message: "Are you sure you want to allow this user? They will be able to join your groups again.",
            confirmBtnClass: "confirmBtnGreen", cancelBtnClass: "confirmBtnOutline",
            confirmLabel: "Allow", cancelLabel: "Cancel",
            onConfirm: () => { setConfirmDialog(null); executeAllow(userId, showToast); },
            onCancel: () => setConfirmDialog(null),
          });
        }

        return (
          <section className="dashMain">
            <div className="dashHeader">
              <div className="dashHeaderTop">
                <div>
                  <h1 className="dashTitle">Restricted Members</h1>
                  <p className="dashSubtitle">Manage members who are restricted from joining your groups</p>
                </div>
              </div>
              <div className="dashSearchWrap">
                <SearchIcon />
                <input
                  className="dashSearch"
                  type="text"
                  placeholder="Search users by email, first name, or last name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="ruSearchResults">
                <h3 className="ruSectionTitle">Search Results</h3>
                {searching && <p className="dashMsg">Searching…</p>}
                {!searching && searchResults.length === 0 && <p className="dashMsg">No users found.</p>}
                {!searching && searchResults.length > 0 && (
                  <RestrictUsersTable
                    rows={searchResults}
                    actionId={actionId}
                    onRestrict={handleRestrict}
                    onAllow={handleAllow}
                  />
                )}
              </div>
            )}

            <div className="ruSection">
              <h3 className="ruSectionTitle">Restricted Members ({restrictedList.length})</h3>
              {loading && <p className="dashMsg">Loading…</p>}
              {!loading && restrictedList.length === 0 && (
                <div className="dashEmpty">
                  <RestrictIcon />
                  <p>No restricted members. Users you restrict will appear here.</p>
                </div>
              )}
              {!loading && restrictedList.length > 0 && (
                <RestrictUsersTable
                  rows={restrictedList}
                  actionId={actionId}
                  onRestrict={handleRestrict}
                  onAllow={handleAllow}
                  showRestrictedOn
                />
              )}
            </div>
          </section>
        );
      }}
    </DashboardLayout>
  );
}
