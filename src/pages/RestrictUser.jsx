import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { API_BASE, authHeaders, waitForToken } from "../utils/auth";
import { MenuIcon, CloseIcon, GroupsIcon, TutoringIcon, AiIcon, SupportIcon, RestrictIcon, SearchIcon } from "../components/Icons";
import "../styles/pages/Dashboard.css";
import "../styles/pages/RestrictUser.css";

export default function RestrictUser() {
  const nav = useNavigate();
  const { instance, accounts } = useMsal();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  /* Data states */
  const [restrictedList, setRestrictedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const searchTimer = useRef(null);

  function showToast(message, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  /* Fetch user profile */
  useEffect(() => {
    let cancelled = false;
    waitForToken().then(async () => {
      if (cancelled) return;
      const h = authHeaders();
      let nameFound = false;

      for (const url of [`${API_BASE}/api/users/me`, `${API_BASE}/api/profile`]) {
        try {
          const res = await fetch(url, { headers: h, credentials: "include" });
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled) return;
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
          if (!nameFound) {
            const full = [data.firstName, data.lastName].filter(Boolean).join(" ");
            if (full) { setProfileName(full); nameFound = true; }
            else if (data.name) { setProfileName(data.name); nameFound = true; }
          }
          if (nameFound && avatarUrl) break;
        } catch { /* try next */ }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* Fetch restricted list */
  async function loadRestricted() {
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users`, { headers: authHeaders(), credentials: "include" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setRestrictedList(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    waitForToken().then(() => loadRestricted()).catch(() => setLoading(false));
  }, []);

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

  /* Restrict a user */
  async function handleRestrict(userId) {
    setActionId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users`, {
        method: "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Restrict failed (${res.status})`);
      showToast("User restricted successfully!");
      await loadRestricted();
      /* Update search results to reflect new restrict status */
      setSearchResults((prev) => prev.map((u) => u.userId === userId ? { ...u, restricted: true } : u));
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionId(null); }
  }

  /* Allow (un-restrict) a user */
  function handleAllow(userId) {
    setConfirmDialog({
      message: "Are you sure you want to allow this user? They will be able to join your groups again.",
      confirmBtnClass: "confirmBtnGreen", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Allow", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeAllow(userId); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function executeAllow(userId) {
    setActionId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users/${userId}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Allow failed (${res.status})`);
      showToast("User allowed successfully!");
      await loadRestricted();
      setSearchResults((prev) => prev.map((u) => u.userId === userId ? { ...u, restricted: false } : u));
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionId(null); }
  }

  async function handleLogout() {
    setConfirmDialog({
      message: "Are you sure you want to logout?",
      confirmBtnClass: "confirmBtnGreen", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "OK", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeLogout(); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function executeLogout() {
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("accessToken");
    if (accounts.length > 0) {
      instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: "/" });
    } else { nav("/"); }
  }

  const account = accounts[0];
  const userName = profileName || account?.name || account?.idTokenClaims?.name ||
    [account?.idTokenClaims?.given_name, account?.idTokenClaims?.family_name].filter(Boolean).join(" ") || "Student";
  const userEmail = account?.username || "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="dashPage">
      {/* mobile top bar */}
      <div className="dashTopBar">
        <button className="dashMenuBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><MenuIcon /></button>
        <h1 className="dashTopTitle">Dashboard</h1>
        <div className="dashTopRight">
          <button className="dashTopAvatar" onClick={() => nav("/profile")}>
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="dashAvatarImg" /> : userInitial}
          </button>
        </div>
      </div>

      {sidebarOpen && <div className="dashOverlay" onClick={closeSidebar} />}

      <aside className={`dashSidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dashUserCard" onClick={() => { nav("/profile"); closeSidebar(); }}>
          <div className="dashAvatar">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="dashAvatarImg" /> : userInitial}
          </div>
          <div className="dashUserInfo">
            <h3 className="dashUserName">{userName}</h3>
            <p className="dashUserEmail">{userEmail}</p>
          </div>
          <button className="dashCloseBtn" onClick={(e) => { e.stopPropagation(); closeSidebar(); }} aria-label="Close menu"><CloseIcon /></button>
        </div>

        <nav className="dashNav">
          <span className="dashNavLabel">MODULES</span>
          <button className="dashNavItem" onClick={() => { nav("/"); closeSidebar(); }}><GroupsIcon /> Study Groups</button>
          <button className="dashNavItem" disabled><TutoringIcon /> Peer Tutoring</button>
          <button className="dashNavItem active" onClick={closeSidebar}><RestrictIcon /> Restricted Member</button>
          <button className="dashNavItem" disabled><AiIcon /> AI Tutor</button>
          <button className="dashNavItem" disabled><SupportIcon /> Support</button>
        </nav>

        <div className="dashSidebarFooter">
          <button className="dashLogoutBtn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

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

        {/* ── Search results ── */}
        {searchQuery.trim().length >= 2 && (
          <div className="ruSearchResults">
            <h3 className="ruSectionTitle">Search Results</h3>
            {searching && <p className="dashMsg">Searching…</p>}
            {!searching && searchResults.length === 0 && <p className="dashMsg">No users found.</p>}
            {!searching && searchResults.length > 0 && (
              <div className="ruTableWrap">
                <table className="ruTable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((u) => (
                      <tr key={u.userId}>
                        <td>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td>{u.email || "—"}</td>
                        <td>
                          {u.restricted ? (
                            <button
                              className="ruAllowBtn"
                              disabled={actionId === u.userId}
                              onClick={() => handleAllow(u.userId)}
                            >
                              {actionId === u.userId ? "…" : "Allow"}
                            </button>
                          ) : (
                            <button
                              className="ruRestrictBtn"
                              disabled={actionId === u.userId}
                              onClick={() => handleRestrict(u.userId)}
                            >
                              {actionId === u.userId ? "…" : "Restrict"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Restricted members table ── */}
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
            <div className="ruTableWrap">
              <table className="ruTable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Restricted On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {restrictedList.map((r) => (
                    <tr key={r.restrictedUserId}>
                      <td>{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td>{r.email || "—"}</td>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <button
                          className="ruAllowBtn"
                          disabled={actionId === r.restrictedUserId}
                          onClick={() => handleAllow(r.restrictedUserId)}
                        >
                          {actionId === r.restrictedUserId ? "…" : "Allow"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {confirmDialog && (
        <div className="modalOverlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirmDialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirmMsg">{confirmDialog.message}</p>
            <div className="confirmActions">
              <button className={confirmDialog.cancelBtnClass || "confirmBtnOutline"} onClick={confirmDialog.onCancel}>{confirmDialog.cancelLabel || "Cancel"}</button>
              <button className={confirmDialog.confirmBtnClass || "confirmBtnGreen"} onClick={confirmDialog.onConfirm}>{confirmDialog.confirmLabel || "Yes"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`dashToast ${toast.type === "error" ? "dashToastError" : "dashToastSuccess"}`} onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
