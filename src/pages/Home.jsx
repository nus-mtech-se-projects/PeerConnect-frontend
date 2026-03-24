import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Carousel from "../components/Carousel";
import FeatureCard from "../components/FeatureCard";
import DashboardLayout from "../components/DashboardLayout";
import { GroupsIcon, SearchIcon, PlusIcon } from "../components/Icons";
import { API_BASE, authHeaders, waitForToken } from "../utils/auth";
import tutoringImg from "../assets/images/tutoring.jpg";
import studyGroupImg from "../assets/images/study-group.jpg";
import chatBotImg from "../assets/images/chatbot.jpg";
import supportSystemImg from "../assets/images/support-system.jpg";

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

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [membershipActionId, setMembershipActionId] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: "", moduleCode: "", topic: "", studyMode: "online",
    location: "", meetingLink: "", scheduleDate: "", scheduleTime: "", maxMembers: 10,
    description: "", approvalRequired: false,
  });
  const [creating, setCreating] = useState(false);
  const [myGroupsOnly, setMyGroupsOnly] = useState(false);

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

  return (
    <DashboardLayout activeNav="groups">
      {({ showToast, setConfirmDialog }) => {

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

        async function executeJoin(groupId) {
          setMembershipActionId(groupId);
          try {
            const res = await fetch(`${API_BASE}/api/groups/${groupId}/join`, {
              method: "POST", headers: authHeaders(), credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `Join failed (${res.status})`);
            setGroups((prev) => prev.map((g) => {
              if (g.id !== groupId) return g;
              return { ...g, joined: true, memberCount: typeof data.memberCount === "number" ? data.memberCount : ((g.memberCount ?? 0) + 1) };
            }));
            if (data.alreadyJoined) { showToast("You have already joined this group.", "error"); }
          } catch (err) { showToast(err.message, "error"); }
          finally { setMembershipActionId(null); }
        }

        async function executeLeave(groupId) {
          setMembershipActionId(groupId);
          try {
            const res = await fetch(`${API_BASE}/api/groups/${groupId}/leave`, {
              method: "POST", headers: authHeaders(), credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `Leave failed (${res.status})`);
            setGroups((prev) => prev.map((g) => {
              if (g.id !== groupId) return g;
              return { ...g, joined: false, memberCount: typeof data.memberCount === "number" ? data.memberCount : Math.max(0, (g.memberCount ?? 1) - 1) };
            }));
          } catch (err) { showToast(err.message, "error"); }
          finally { setMembershipActionId(null); }
        }

        function handleJoin(groupId) {
          if (!groupId) return;
          setConfirmDialog({
            message: "Are you sure you want to join this group?",
            confirmBtnClass: "groupJoinBtn",
            onConfirm: () => { setConfirmDialog(null); executeJoin(groupId); },
            onCancel: () => setConfirmDialog(null),
          });
        }

        function handleLeave(groupId) {
          if (!groupId) return;
          setConfirmDialog({
            message: "Are you sure you want to leave this group?",
            confirmBtnClass: "groupLeaveBtn",
            onConfirm: () => { setConfirmDialog(null); executeLeave(groupId); },
            onCancel: () => setConfirmDialog(null),
          });
        }

        return (
          <>
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
              <div className="modalOverlay" onClick={() => setShowCreate(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowCreate(false); }} role="presentation">
                <div className="modalCard" onClick={(e) => e.stopPropagation()} role="dialog">
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
          </>
        );
      }}
    </DashboardLayout>
  );
}

/* ═══════════════════════════════════════════════════
   Main export — switches based on auth state
   ═══════════════════════════════════════════════════ */
export default function Home() {
  const isLoggedIn = !!localStorage.getItem("accessToken");
  return isLoggedIn ? <DashboardHome /> : <LandingHome />;
}
