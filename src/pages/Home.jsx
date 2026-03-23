import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import Carousel from "../components/Carousel";
import FeatureCard from "../components/FeatureCard";
import tutoringImg from "../assets/images/tutoring.jpg";
import studyGroupImg from "../assets/images/study-group.jpg";
import chatBotImg from "../assets/images/chatbot.jpg";
import supportSystemImg from "../assets/images/support-system.jpg";
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

function waitForToken(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 > Date.now()) { resolve(token); return; }
        } catch { /* malformed */ }
      }
      if (Date.now() - start > timeoutMs) { reject(new Error("Token timeout")); return; }
      setTimeout(check, 300);
    })();
  });
}

/* ──────── SVG icons ──────── */
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
const RestrictIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="11" r="4"/><line x1="17" y1="9" x2="21" y2="13"/></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

/* ═══════════════════════════════════════════════════
   Landing page (shown to guests)
   ═══════════════════════════════════════════════════ */
function LandingHome() {
  const slides = [
    { title: "Find the right tutor", description: "Match with peers who have aced the same module.", imageSrc: tutoringImg, imageAlt: "Peer tutoring session" },
    { title: "Join study rooms", description: "Create or join groups that keep you consistent.", imageSrc: studyGroupImg, imageAlt: "Students in a study group" },
    { title: "Ask AI anytime", description: "Instant explanations with examples and practice.", imageSrc: chatBotImg, imageAlt: "AI chatbot assistance" },
    { title: "Support Groups", description: "Get accountability, encouragement, and guidance from peers.", imageSrc: supportSystemImg, imageAlt: "Students in a supportive group discussion" },
  ];

  const features = [
    { title: "Peer tutoring system", desc: "Book 1:1 sessions with peer tutors who know your module." },
    { title: "Study Groups", desc: "Collaborative learning rooms with shared goals and schedules." },
    { title: "AI Chatbot", desc: "Instant explanations, examples, and revision questions." },
    { title: "Support System", desc: "Help center, FAQs, and assistance when you get stuck." },
  ];

  return (
    <div className="page">
      <Carousel slides={slides} autoPlayMs={0} />
      <section className="featureRow">
        {features.map((f) => (
          <FeatureCard key={f.title} title={f.title} description={f.desc} />
        ))}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Dashboard (shown to logged-in users)
   ═══════════════════════════════════════════════════ */
function DashboardHome() {
  const nav = useNavigate();
  const { instance, accounts } = useMsal();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [membershipActionId, setMembershipActionId] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: "", moduleCode: "", topic: "", studyMode: "online",
    location: "", meetingLink: "", scheduleDate: "", scheduleTime: "", maxMembers: 10,
    description: "", approvalRequired: false,
  });
  const [creating, setCreating] = useState(false);
  const [myGroupsOnly, setMyGroupsOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  function showToast(message, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  /* fetch user name + avatar */
  useEffect(() => {
    let cancelled = false;
    waitForToken().then(async () => {
      if (cancelled) return;
      const h = authHeaders();
      let nameFound = false;

      for (const url of [
        `${API_BASE}/api/users/me`,
        `${API_BASE}/api/profile`,
      ]) {
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

  /* fetch groups */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    waitForToken().then(() => {
      if (cancelled) return;
      fetch(`${API_BASE}/api/groups`, { headers: authHeaders(), credentials: "include" })
        .then((r) => {
          if (!r.ok) {
            if (r.status === 401 || r.status === 403) {
              localStorage.removeItem("accessToken");
              nav("/login");
              throw new Error("Session expired. Please login again.");
            }
            throw new Error(`Failed to load groups (${r.status})`);
          }
          return r.json();
        })
        .then((data) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []); })
        .catch((err) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }).catch(() => { if (!cancelled) { setError("Authentication timeout"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [nav]);

  const filtered = useMemo(() => {
    let result = groups;
    if (myGroupsOnly) {
      result = result.filter((g) => g.isAdmin);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((g) =>
        g.name?.toLowerCase().includes(q) ||
        g.moduleCode?.toLowerCase().includes(q) ||
        g.courseCode?.toLowerCase().includes(q) ||
        g.topic?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [groups, search, myGroupsOnly]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify({
          ...newGroup,
          preferredSchedule: [newGroup.scheduleDate, newGroup.scheduleTime].filter(Boolean).join("T"),
          scheduleDate: undefined,
          scheduleTime: undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create failed (${res.status})`);
      const created = data;
      setGroups((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewGroup({
        name: "", moduleCode: "", topic: "", studyMode: "online", location: "", meetingLink: "",
        scheduleDate: "", scheduleTime: "", maxMembers: 10, description: "", approvalRequired: false,
      });
    } catch (err) { showToast(err.message, "error"); }
    finally { setCreating(false); }
  }

  async function handleLogout() {
    setConfirmDialog({
      message: "Are you sure you want to logout?",
      confirmBtnClass: "confirmBtnGreen",
      cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeLogout(); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function executeLogout() {
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* best-effort */ }
    localStorage.removeItem("accessToken");
    if (accounts.length > 0) {
      instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: "/" });
    } else { nav("/"); }
  }

  async function handleJoin(groupId) {
    if (!groupId) return;
    setConfirmDialog({
      message: "Are you sure you want to join this group?",
      confirmBtnClass: "groupJoinBtn",
      onConfirm: () => { setConfirmDialog(null); executeJoin(groupId); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function executeJoin(groupId) {
    setMembershipActionId(groupId);
    try {
      const res = await fetch(`${API_BASE}/api/groups/${groupId}/join`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Join failed (${res.status})`);

      setGroups((prev) => prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          joined: true,
          memberCount: typeof data.memberCount === "number"
            ? data.memberCount
            : ((g.memberCount ?? 0) + 1),
        };
      }));

      if (data.alreadyJoined) {
        showToast("You have already joined this group.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setMembershipActionId(null);
    }
  }

  async function handleLeave(groupId) {
    if (!groupId) return;
    setConfirmDialog({
      message: "Are you sure you want to leave this group?",
      confirmBtnClass: "groupLeaveBtn",
      onConfirm: () => { setConfirmDialog(null); executeLeave(groupId); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function executeLeave(groupId) {
    setMembershipActionId(groupId);
    try {
      const res = await fetch(`${API_BASE}/api/groups/${groupId}/leave`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Leave failed (${res.status})`);

      setGroups((prev) => prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          joined: false,
          memberCount: typeof data.memberCount === "number"
            ? data.memberCount
            : Math.max(0, (g.memberCount ?? 1) - 1),
        };
      }));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setMembershipActionId(null);
    }
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
          <button className="dashNavItem active" onClick={closeSidebar}><GroupsIcon /> Study Groups</button>
          <button className="dashNavItem" disabled><TutoringIcon /> Peer Tutoring</button>
          <button className="dashNavItem" onClick={() => { nav("/restrict-user"); closeSidebar(); }}><RestrictIcon /> Restricted Member</button>
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
              <h1 className="dashTitle">Study Groups</h1>
              <p className="dashSubtitle">Discover, create, and join study groups</p>
            </div>
            <div className="dashHeaderBtns">
              <button className={`dashMyGroupsBtn${myGroupsOnly ? " active" : ""}`} onClick={() => setMyGroupsOnly((v) => !v)}><GroupsIcon /> {myGroupsOnly ? "All Groups" : "My Groups"}</button>
              <button className="dashCreateBtn" onClick={() => setShowCreate(true)}><PlusIcon /> Create Group</button>
            </div>
          </div>
          <div className="dashSearchWrap">
            <SearchIcon />
            <input className="dashSearch" type="text" placeholder="Search by name, course code, or topic…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading && <p className="dashMsg">Loading groups…</p>}
        {error && <p className="dashMsg dashError">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="dashEmpty"><GroupsIcon /><p>No groups found. Create one to get started!</p></div>
        )}

        <div className="dashGrid">
          {filtered.map((g) => (
            <div className="groupCard" key={g.id || g.name}>
              <div className="groupCardHeader">
                <span className="groupCourse">{g.moduleCode || g.courseCode || "General"}</span>
                <span className={`groupMode ${g.studyMode}`}>{g.studyMode === "online" ? "Online" : g.studyMode === "hybrid" ? "Hybrid" : "In-Person"}</span>
              </div>
              <h3 className="groupName">{g.name || "Study Group"}</h3>
              <p className="groupTopic">{g.topic || "No topic specified"}</p>
              {g.description && <p className="groupDesc">{g.description}</p>}
              {g.preferredSchedule && <p className="groupTopic">Schedule: {g.preferredSchedule}</p>}
              {g.status && <p className="groupTopic">Status: {g.status}</p>}
              <div className="groupFooter">
                <span className="groupMembers">{g.memberCount ?? "?"}/{g.maxMembers ?? "∞"} members</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {!g.isAdmin && (
                    <button
                      className={g.joined ? "groupLeaveBtn" : "groupJoinBtn"}
                      onClick={() => (g.joined ? handleLeave(g.id) : handleJoin(g.id))}
                      disabled={!g.id || membershipActionId === g.id || g.status === "dissolved" || (!g.joined && g.status === "full")}
                    >
                      {membershipActionId === g.id
                        ? (g.joined ? "Leaving…" : "Joining…")
                        : (g.joined ? "Leave" : (g.membershipStatus === "pending" ? "Pending" : "Join"))}
                    </button>
                  )}
                  {!g.isAdmin && (
                    <button className="groupManageBtn" onClick={() => nav(`/group/${g.id}`)}>Info</button>
                  )}
                  {g.isAdmin && (
                    <button className="groupManageBtn" onClick={() => nav(`/group/${g.id}`)}>Manage</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showCreate && (
        <div className="modalOverlay" onClick={() => setShowCreate(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h2 className="modalTitle">Create Study Group</h2>
            <form className="modalForm" onSubmit={handleCreate}>
              <label className="modalLabel">Group Name *
                <input className="modalInput" required style={{ textTransform: "uppercase" }} value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value.toUpperCase() })} />
              </label>
              <div className="modalRow">
                <label className="modalLabel">Module / Subject *
                  <input className="modalInput" required placeholder="e.g. CS2030" style={{ textTransform: "uppercase" }} value={newGroup.moduleCode} onChange={(e) => setNewGroup({ ...newGroup, moduleCode: e.target.value.toUpperCase() })} />
                </label>
                <label className="modalLabel">Topic
                  <input className="modalInput" placeholder="e.g. Data Structures" value={newGroup.topic} onChange={(e) => setNewGroup({ ...newGroup, topic: e.target.value })} />
                </label>
              </div>
              <div className="modalRow">
                <label className="modalLabel">Study Mode
                  <select className="modalInput" value={newGroup.studyMode} onChange={(e) => setNewGroup({ ...newGroup, studyMode: e.target.value })}>
                    <option value="online">Online</option>
                    <option value="in-person">In-Person</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <label className="modalLabel">Max Members
                  <input className="modalInput" type="number" min={2} max={50} value={newGroup.maxMembers} onChange={(e) => setNewGroup({ ...newGroup, maxMembers: Number(e.target.value) })} />
                </label>
              </div>
              {(newGroup.studyMode === "in-person" || newGroup.studyMode === "hybrid") && (
                <label className="modalLabel">Location
                  <input className="modalInput" required placeholder="e.g. COM1 Level 2" value={newGroup.location} onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })} />
                </label>
              )}
              {(newGroup.studyMode === "online" || newGroup.studyMode === "hybrid") && (
                <label className="modalLabel">Meeting Link
                  <input className="modalInput" required placeholder="e.g. https://teams.microsoft.com/..." value={newGroup.meetingLink} onChange={(e) => setNewGroup({ ...newGroup, meetingLink: e.target.value })} />
                </label>
              )}
              <label className="modalLabel">Preferred Schedule *
                <div className="modalRow">
                  <input className="modalInput" type="date" required min={new Date().toISOString().split("T")[0]} value={newGroup.scheduleDate} onChange={(e) => setNewGroup({ ...newGroup, scheduleDate: e.target.value })} />
                  <input className="modalInput" type="time" required value={newGroup.scheduleTime} onChange={(e) => setNewGroup({ ...newGroup, scheduleTime: e.target.value })} />
                </div>
              </label>
              <label className="modalLabel">Description
                <textarea className="modalInput modalTextarea" required rows={3} value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
              </label>
              <label className="modalLabel" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={newGroup.approvalRequired} onChange={(e) => setNewGroup({ ...newGroup, approvalRequired: e.target.checked })} />
                Require admin approval for join requests
              </label>
              <div className="modalActions">
                <button type="button" className="modalCancel" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="modalSubmit" disabled={creating}>{creating ? "Creating…" : "Create Group"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="modalOverlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirmDialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirmMsg">{confirmDialog.message}</p>
            <div className="confirmActions">
              <button className={confirmDialog.cancelBtnClass || "modalCancel"} onClick={confirmDialog.onCancel}>{confirmDialog.cancelLabel || "Cancel"}</button>
              <button className={confirmDialog.confirmBtnClass || "modalSubmit"} onClick={confirmDialog.onConfirm}>{confirmDialog.confirmLabel || "Yes"}</button>
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

/* ═══════════════════════════════════════════════════
   Main export — switches based on auth state
   ═══════════════════════════════════════════════════ */
export default function Home() {
  const isLoggedIn = !!localStorage.getItem("accessToken");
  return isLoggedIn ? <DashboardHome /> : <LandingHome />;
}
