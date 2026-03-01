import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import peerconnectIcon from "../assets/images/peerconnect_icon.png";
import "../styles/pages/Dashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

/* ──────────────────── helpers ──────────────────── */
function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Wait until a valid (non-expired) JWT is in localStorage, then resolve. */
function waitForToken(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 > Date.now()) { resolve(token); return; }
        } catch { /* malformed — keep waiting */ }
      }
      if (Date.now() - start > timeoutMs) { reject(new Error("Token timeout")); return; }
      setTimeout(check, 300);
    })();
  });
}

/* ──────── SVG icons (inline to avoid deps) ──────── */
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const GroupsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const TutoringIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);
const AiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
);
const SupportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

/* ──────────────────── component ──────────────────── */
export default function Dashboard() {
  const nav = useNavigate();
  const { instance, accounts } = useMsal();

  /* ---------- state ---------- */
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");

  // Create-group modal
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    courseCode: "",
    topic: "",
    studyMode: "online",
    location: "",
    maxMembers: 10,
    description: "",
  });
  const [creating, setCreating] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  /* ---------- fetch user name from backend ---------- */
  useEffect(() => {
    let cancelled = false;
    waitForToken().then(async () => {
      if (cancelled) return;
      const h = authHeaders();

      // Try /api/users/me first, fall back to /api/profile
      for (const url of [
        `${API_BASE}/api/users/me`,
        `${API_BASE}/api/profile`,
      ]) {
        try {
          const res = await fetch(url, { headers: h, credentials: "include" });
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled) return;
          const full = [data.firstName, data.lastName].filter(Boolean).join(" ");
          if (full) { setProfileName(full); return; }
          if (data.name) { setProfileName(data.name); return; }
        } catch { /* try next */ }
      }
    }).catch(() => { /* token never arrived */ });
    return () => { cancelled = true; };
  }, []);

  /* ---------- fetch groups ---------- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    waitForToken().then(() => {
      if (cancelled) return;
      fetch(`${API_BASE}/api/groups`, { headers: authHeaders(), credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load groups (${r.status})`);
          return r.json();
        })
        .then((data) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []); })
        .catch((err) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }).catch(() => { if (!cancelled) { setError("Authentication timeout"); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  /* ---------- filtered list ---------- */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name?.toLowerCase().includes(q) ||
        g.courseCode?.toLowerCase().includes(q) ||
        g.topic?.toLowerCase().includes(q)
    );
  }, [groups, search]);

  /* ---------- create group ---------- */
  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(newGroup),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const created = await res.json();
      setGroups((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewGroup({ name: "", courseCode: "", topic: "", studyMode: "online", location: "", maxMembers: 10, description: "" });
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  /* ---------- logout ---------- */
  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* proceed anyway */ }

    localStorage.removeItem("accessToken");

    if (accounts.length > 0) {
      instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: "/" });
    } else {
      nav("/");
    }
  }

  const account = accounts[0];
  const userName =
    profileName ||
    account?.name ||
    account?.idTokenClaims?.name ||
    [account?.idTokenClaims?.given_name, account?.idTokenClaims?.family_name]
      .filter(Boolean)
      .join(" ") ||
    "Student";
  const userEmail = account?.username || "";
  const userInitial = userName.charAt(0).toUpperCase();

  /* ---------- render ---------- */
  return (
    <div className="dashPage">
      {/* ── mobile top bar ── */}
      <div className="dashTopBar">
        <button className="dashMenuBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h1 className="dashTopTitle">Dashboard</h1>
        <div className="dashTopRight">
          <button className="dashTopAvatar" onClick={() => nav("/profile")}>{userInitial}</button>
        </div>
      </div>

      {/* ── sidebar overlay (mobile) ── */}
      {sidebarOpen && <div className="dashOverlay" onClick={closeSidebar} />}

      {/* ── sidebar ── */}
      <aside className={`dashSidebar ${sidebarOpen ? "open" : ""}`}>
        {/* user card */}
        <div className="dashUserCard" onClick={() => { nav("/profile"); closeSidebar(); }}>
          <div className="dashAvatar">{userInitial}</div>
          <div className="dashUserInfo">
            <h3 className="dashUserName">{userName}</h3>
            <p className="dashUserEmail">{userEmail}</p>
          </div>
          <button className="dashCloseBtn" onClick={(e) => { e.stopPropagation(); closeSidebar(); }} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        {/* navigation */}
        <nav className="dashNav">
          <span className="dashNavLabel">MODULES</span>
          <button className="dashNavItem active" onClick={closeSidebar}>
            <GroupsIcon /> Study Groups
          </button>
          <button className="dashNavItem" disabled>
            <TutoringIcon /> Peer Tutoring
          </button>
          <button className="dashNavItem" disabled>
            <AiIcon /> AI Tutor
          </button>
          <button className="dashNavItem" disabled>
            <SupportIcon /> Support
          </button>
        </nav>

        <div className="dashSidebarFooter">
          <button className="dashLogoutBtn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* ── main content ── */}
      <section className="dashMain">
        <div className="dashHeader">
          <div className="dashHeaderTop">
            <div>
              <h1 className="dashTitle">Study Groups</h1>
              <p className="dashSubtitle">Discover, create, and join study groups</p>
            </div>
            <button className="dashCreateBtn" onClick={() => setShowCreate(true)}>
              <PlusIcon /> Create Group
            </button>
          </div>
          <div className="dashSearchWrap">
            <SearchIcon />
            <input
              className="dashSearch"
              type="text"
              placeholder="Search by name, course code, or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* loading / error / empty */}
        {loading && <p className="dashMsg">Loading groups…</p>}
        {error && <p className="dashMsg dashError">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="dashEmpty">
            <GroupsIcon />
            <p>No groups found. Create one to get started!</p>
          </div>
        )}

        {/* group cards grid */}
        <div className="dashGrid">
          {filtered.map((g) => (
            <div className="groupCard" key={g.id || g.name}>
              <div className="groupCardHeader">
                <span className="groupCourse">{g.courseCode || "General"}</span>
                <span className={`groupMode ${g.studyMode}`}>
                  {g.studyMode === "online" ? "Online" : "In-Person"}
                </span>
              </div>
              <h3 className="groupName">{g.name}</h3>
              <p className="groupTopic">{g.topic || "No topic specified"}</p>
              {g.description && <p className="groupDesc">{g.description}</p>}
              <div className="groupFooter">
                <span className="groupMembers">
                  {g.memberCount ?? "?"}/{g.maxMembers ?? "∞"} members
                </span>
                <button className="groupJoinBtn">Join</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── create group modal ── */}
      {showCreate && (
        <div className="modalOverlay" onClick={() => setShowCreate(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h2 className="modalTitle">Create Study Group</h2>
            <form className="modalForm" onSubmit={handleCreate}>
              <label className="modalLabel">
                Group Name *
                <input
                  className="modalInput"
                  required
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </label>

              <div className="modalRow">
                <label className="modalLabel">
                  Course Code
                  <input
                    className="modalInput"
                    placeholder="e.g. CS2030"
                    value={newGroup.courseCode}
                    onChange={(e) => setNewGroup({ ...newGroup, courseCode: e.target.value })}
                  />
                </label>

                <label className="modalLabel">
                  Topic
                  <input
                    className="modalInput"
                    placeholder="e.g. Data Structures"
                    value={newGroup.topic}
                    onChange={(e) => setNewGroup({ ...newGroup, topic: e.target.value })}
                  />
                </label>
              </div>

              <div className="modalRow">
                <label className="modalLabel">
                  Study Mode
                  <select
                    className="modalInput"
                    value={newGroup.studyMode}
                    onChange={(e) => setNewGroup({ ...newGroup, studyMode: e.target.value })}
                  >
                    <option value="online">Online</option>
                    <option value="in-person">In-Person</option>
                  </select>
                </label>

                <label className="modalLabel">
                  Max Members
                  <input
                    className="modalInput"
                    type="number"
                    min={2}
                    max={50}
                    value={newGroup.maxMembers}
                    onChange={(e) => setNewGroup({ ...newGroup, maxMembers: Number(e.target.value) })}
                  />
                </label>
              </div>

              {newGroup.studyMode === "in-person" && (
                <label className="modalLabel">
                  Location
                  <input
                    className="modalInput"
                    placeholder="e.g. COM1 Level 2"
                    value={newGroup.location}
                    onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                  />
                </label>
              )}

              <label className="modalLabel">
                Description
                <textarea
                  className="modalInput modalTextarea"
                  rows={3}
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                />
              </label>

              <div className="modalActions">
                <button type="button" className="modalCancel" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="modalSubmit" disabled={creating}>
                  {creating ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
