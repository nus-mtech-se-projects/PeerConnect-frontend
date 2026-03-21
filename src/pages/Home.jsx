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
const FEEDBACK_DRAFTS_KEY = "peerconnect-feedback-drafts";

function createFeedbackForm() {
  return {
    revieweeId: "",
    overallRating: 0,
    preparedness: 0,
    communication: 0,
    helpfulness: 0,
    reliability: 0,
    strengths: "",
    improvements: "",
    anonymousToPeer: false,
  };
}

function getFeedbackKey(sessionId, revieweeId) {
  return `${sessionId || "group"}::${revieweeId || "unknown"}`;
}

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
  const [showManage, setShowManage] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [membershipActionId, setMembershipActionId] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: "", moduleCode: "", topic: "", studyMode: "online",
    location: "", meetingLink: "", scheduleDate: "", scheduleTime: "", maxMembers: 10,
    description: "", approvalRequired: false,
  });
  const [sessionForm, setSessionForm] = useState({
    title: "", startsAt: "", endsAt: "", location: "", meetingLink: "", notes: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [transferOwnerId, setTransferOwnerId] = useState("");
  const [manageScheduleDate, setManageScheduleDate] = useState("");
  const [manageScheduleTime, setManageScheduleTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [myGroupsOnly, setMyGroupsOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showFeedbackPicker, setShowFeedbackPicker] = useState(false);
  const [feedbackOptions, setFeedbackOptions] = useState([]);
  const [selectedFeedbackGroupId, setSelectedFeedbackGroupId] = useState("");
  const [selectedFeedbackSessionId, setSelectedFeedbackSessionId] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState(createFeedbackForm);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState({ type: "", message: "" });
  const [feedbackRecords, setFeedbackRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(FEEDBACK_DRAFTS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function showToast(message, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const saveFeedbackRecords = useCallback((updater) => {
    setFeedbackRecords((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem(FEEDBACK_DRAFTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const closeFeedbackPicker = useCallback(() => {
    setShowFeedbackPicker(false);
    setFeedbackOptions([]);
    setSelectedFeedbackGroupId("");
    setSelectedFeedbackSessionId("");
  }, []);

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

  async function loadGroupDetails(groupId, { applyState = true } = {}) {
    try {
      const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to load group details (${res.status})`);
      const nextGroup = {
        ...data,
        moduleCode: data.moduleCode || data.courseCode || "",
      };
      const nextMembers = Array.isArray(data.members) ? data.members : [];
      const nextSessions = Array.isArray(data.sessions) ? data.sessions : [];
      if (applyState) {
        setSelectedGroup(nextGroup);
        setSelectedMembers(nextMembers);
        setSelectedSessions(nextSessions);
        setTransferOwnerId("");
        setInviteEmail("");
        const ps = typeof data.preferredSchedule === "string" ? data.preferredSchedule : "";
        const parts = ps.split(/[T ]/);
        setManageScheduleDate(parts[0] || "");
        setManageScheduleTime(parts[1] ? parts[1].substring(0, 5) : "");
        setSessionForm({ title: "", startsAt: "", endsAt: "", location: data.location || "", meetingLink: data.meetingLink || "", notes: "" });
      }
      return { group: nextGroup, members: nextMembers, sessions: nextSessions };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async function openManage(groupId) {
    setManageLoading(true);
    setShowManage(true);
    try {
      await loadGroupDetails(groupId);
    } catch (err) {
      showToast(err.message, "error");
      setShowManage(false);
    } finally {
      setManageLoading(false);
    }
  }

  function closeManage() {
    setShowManage(false);
    setSelectedGroup(null);
    setSelectedMembers([]);
    setSelectedSessions([]);
    closeFeedbackPicker();
    setShowFeedback(false);
    setFeedbackSession(null);
    setFeedbackForm(createFeedbackForm());
    setFeedbackStatus({ type: "", message: "" });
  }

  function openFeedback(session, membersOverride = selectedMembers) {
    const approvedMembers = membersOverride.filter((member) =>
      member.membershipStatus === "approved" && member.email !== userEmail
    );
    const firstReviewee = approvedMembers[0]?.userId || approvedMembers[0]?.email || "";
    setFeedbackSession(session);
    setFeedbackForm({
      ...createFeedbackForm(),
      revieweeId: firstReviewee,
    });
    setFeedbackStatus({ type: "", message: "" });
    setShowFeedback(true);
  }

  async function handleOpenPeerTutoring() {
    closeSidebar();
    const joinedGroups = groups.filter((group) => group.joined);
    if (joinedGroups.length === 0) {
      alert("Join a study group first to submit peer feedback.");
      return;
    }

    setManageLoading(true);
    try {
      const nextOptions = [];
      for (const group of joinedGroups) {
        const details = await loadGroupDetails(group.id, { applyState: false });
        const approvedPeers = details.members.filter((member) =>
          member.membershipStatus === "approved" && member.email !== userEmail
        );
        const availableSessions = details.sessions.filter((session) => session?.id);

        if (availableSessions.length > 0 && approvedPeers.length > 0) {
          nextOptions.push({
            group: details.group,
            members: details.members,
            sessions: availableSessions,
          });
        }
      }

      if (nextOptions.length === 0) {
        alert("No peer feedback session is ready yet. Make sure one of your groups has a scheduled session and at least one approved peer.");
        return;
      }

      setShowManage(false);
      setFeedbackOptions(nextOptions);
      setSelectedFeedbackGroupId(nextOptions[0].group.id);
      setSelectedFeedbackSessionId(nextOptions[0].sessions[0]?.id || "");
      setShowFeedbackPicker(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setManageLoading(false);
    }
  }

  function handleSelectFeedbackGroup(groupId) {
    setSelectedFeedbackGroupId(groupId);
    const nextGroup = feedbackOptions.find((option) => option.group.id === groupId);
    setSelectedFeedbackSessionId(nextGroup?.sessions[0]?.id || "");
  }

  function handleLaunchFeedback() {
    const selectedOption = feedbackOptions.find((option) => option.group.id === selectedFeedbackGroupId);
    const selectedSession = selectedOption?.sessions.find((session) => session.id === selectedFeedbackSessionId);
    if (!selectedOption || !selectedSession) return;

    setSelectedGroup(selectedOption.group);
    setSelectedMembers(selectedOption.members);
    setSelectedSessions(selectedOption.sessions);
    closeFeedbackPicker();
    openFeedback(selectedSession, selectedOption.members);
  }

  function closeFeedback() {
    setShowFeedback(false);
    setFeedbackSession(null);
    setFeedbackForm(createFeedbackForm());
    setFeedbackStatus({ type: "", message: "" });
  }

  async function refreshSelectedGroup() {
    if (!selectedGroup?.id) return;
    const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}`, {
      headers: authHeaders(),
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to refresh group details (${res.status})`);
    setSelectedGroup({ ...data, moduleCode: data.moduleCode || data.courseCode || "" });
    setSelectedMembers(Array.isArray(data.members) ? data.members : []);
    setSelectedSessions(Array.isArray(data.sessions) ? data.sessions : []);
    setGroups((prev) => prev.map((g) => (g.id === data.id ? { ...g, ...data } : g)));
  }

  async function handleUpdateGroup(e) {
    e.preventDefault();
    if (!selectedGroup?.id) return;
    try {
      const payload = {
        name: selectedGroup.name,
        moduleCode: selectedGroup.moduleCode,
        topic: selectedGroup.topic,
        description: selectedGroup.description,
        studyMode: selectedGroup.studyMode,
        location: selectedGroup.location,
        meetingLink: selectedGroup.meetingLink,
        preferredSchedule: [manageScheduleDate, manageScheduleTime].filter(Boolean).join("T"),
        maxMembers: Number(selectedGroup.maxMembers),
        approvalRequired: !!selectedGroup.approvalRequired,
      };
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}`, {
        method: "PUT",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
      setGroups((prev) => prev.map((g) => (g.id === data.id ? { ...g, ...data } : g)));
      setSelectedGroup((prev) => ({ ...prev, ...data }));
      showToast("Group updated successfully!");
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    if (!selectedGroup?.id) return;
    try {
      const payload = {
        title: sessionForm.title,
        startsAt: sessionForm.startsAt,
        endsAt: sessionForm.endsAt || null,
        location: sessionForm.location,
        meetingLink: sessionForm.meetingLink,
        notes: sessionForm.notes,
      };
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/sessions`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create session failed (${res.status})`);
      setSessionForm({ ...sessionForm, title: "", startsAt: "", endsAt: "", notes: "" });
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteSession(sessionId) {
    if (!selectedGroup?.id) return;
    if (!window.confirm("Delete this session?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Delete session failed (${res.status})`);
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!selectedGroup?.id || !inviteEmail.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/members/invite`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Invite failed (${res.status})`);
      setInviteEmail("");
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleApproveMember(userId) {
    if (!selectedGroup?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/members/${userId}/approve`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Approve failed (${res.status})`);
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRemoveMember(userId) {
    if (!selectedGroup?.id) return;
    if (!window.confirm("Remove this member from group?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/members/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Remove failed (${res.status})`);
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleTransferOwnership() {
    if (!selectedGroup?.id || !transferOwnerId) return;
    if (!window.confirm("Transfer ownership to selected member?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/transfer-ownership`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ newOwnerUserId: transferOwnerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Transfer failed (${res.status})`);
      showToast("Ownership transferred successfully!");
      await refreshSelectedGroup();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDissolveGroup() {
    if (!selectedGroup?.id) return;
    if (!window.confirm("Dissolve this group? This will set status to dissolved.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/dissolve`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Dissolve failed (${res.status})`);
      setGroups((prev) => prev.filter((g) => g.id !== selectedGroup.id));
      closeManage();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleSubmitFeedback(e) {
    e.preventDefault();
    if (!selectedGroup?.id || !feedbackSession?.id || !feedbackForm.revieweeId) return;

    const payload = {
      sessionId: feedbackSession.id,
      groupId: selectedGroup.id,
      revieweeId: feedbackForm.revieweeId,
      overallRating: feedbackForm.overallRating,
      preparedness: feedbackForm.preparedness,
      communication: feedbackForm.communication,
      helpfulness: feedbackForm.helpfulness,
      reliability: feedbackForm.reliability,
      strengths: feedbackForm.strengths.trim() || null,
      improvements: feedbackForm.improvements.trim() || null,
      anonymousToPeer: feedbackForm.anonymousToPeer,
    };
    const feedbackKey = getFeedbackKey(feedbackSession.id, feedbackForm.revieweeId);

    setFeedbackSubmitting(true);
    setFeedbackStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/sessions/${feedbackSession.id}/feedback`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Feedback submission failed (${res.status})`);

      saveFeedbackRecords((prev) => ({
        ...prev,
        [feedbackKey]: {
          ...payload,
          revieweeLabel: data?.revieweeName || getRevieweeLabel(feedbackForm.revieweeId),
          savedAt: new Date().toISOString(),
          syncStatus: "submitted",
        },
      }));
      setFeedbackStatus({ type: "success", message: "Feedback submitted successfully." });
    } catch {
      saveFeedbackRecords((prev) => ({
        ...prev,
        [feedbackKey]: {
          ...payload,
          revieweeLabel: getRevieweeLabel(feedbackForm.revieweeId),
          savedAt: new Date().toISOString(),
          syncStatus: "local",
        },
      }));
      setFeedbackStatus({
        type: "warning",
        message: "Backend sync is not available yet. Your feedback has been saved locally for demo purposes.",
      });
    } finally {
      setFeedbackSubmitting(false);
    }
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
  const reviewableMembers = selectedMembers.filter((member) =>
    member.membershipStatus === "approved" && member.email !== userEmail
  );
  const selectedFeedbackGroup = feedbackOptions.find((option) => option.group.id === selectedFeedbackGroupId) || null;
  const getRevieweeLabel = useCallback((revieweeId) => {
    const reviewee = selectedMembers.find((member) => (member.userId || member.email) === revieweeId);
    return reviewee
      ? ([reviewee.firstName, reviewee.lastName].filter(Boolean).join(" ") || reviewee.email || reviewee.userId)
      : "Selected peer";
  }, [selectedMembers]);
  const feedbackSummaryBySession = useMemo(() => Object.values(feedbackRecords).reduce((acc, record) => {
    const sessionId = record?.sessionId;
    if (!sessionId) return acc;
    if (!acc[sessionId]) acc[sessionId] = { submitted: 0, local: 0 };
    if (record.syncStatus === "submitted") acc[sessionId].submitted += 1;
    else acc[sessionId].local += 1;
    return acc;
  }, {}), [feedbackRecords]);

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
          <button className="dashNavItem" onClick={handleOpenPeerTutoring}><TutoringIcon /> Peer Tutoring</button>
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
                  {g.isAdmin && (
                    <button className="groupManageBtn" onClick={() => openManage(g.id)}>Manage</button>
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
                <input className="modalInput" required value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
              </label>
              <div className="modalRow">
                <label className="modalLabel">Module / Subject *
                  <input className="modalInput" required placeholder="e.g. CS2030" value={newGroup.moduleCode} onChange={(e) => setNewGroup({ ...newGroup, moduleCode: e.target.value })} />
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
                  <input className="modalInput" type="date" required value={newGroup.scheduleDate} onChange={(e) => setNewGroup({ ...newGroup, scheduleDate: e.target.value })} />
                  <input className="modalInput" type="time" required value={newGroup.scheduleTime} onChange={(e) => setNewGroup({ ...newGroup, scheduleTime: e.target.value })} />
                </div>
              </label>
              <label className="modalLabel">Description
                <textarea className="modalInput modalTextarea" required rows={3} value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
              </label>
              <label className="modalLabel" style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

      {showManage && (
        <div className="modalOverlay" onClick={closeManage}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            {!selectedGroup || manageLoading ? (
              <p>Loading group details…</p>
            ) : (
              <>
                <h2 className="modalTitle">Manage Group: {selectedGroup.name}</h2>
                <form className="modalForm" onSubmit={handleUpdateGroup}>
                  <label className="modalLabel">Group Name *
                    <input className="modalInput" required value={selectedGroup.name || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, name: e.target.value })} />
                  </label>
                  <div className="modalRow">
                    <label className="modalLabel">Module / Subject *
                      <input className="modalInput" required value={selectedGroup.moduleCode || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, moduleCode: e.target.value })} />
                    </label>
                    <label className="modalLabel">Topic
                      <input className="modalInput" value={selectedGroup.topic || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, topic: e.target.value })} />
                    </label>
                  </div>
                  <div className="modalRow">
                    <label className="modalLabel">Study Mode
                      <select className="modalInput" value={selectedGroup.studyMode || "online"} onChange={(e) => setSelectedGroup({ ...selectedGroup, studyMode: e.target.value })}>
                        <option value="online">Online</option>
                        <option value="in-person">In-Person</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <label className="modalLabel">Max Members
                      <input className="modalInput" type="number" min={2} max={100} value={selectedGroup.maxMembers || 10} onChange={(e) => setSelectedGroup({ ...selectedGroup, maxMembers: Number(e.target.value) })} />
                    </label>
                  </div>
                  <label className="modalLabel">Location
                    <input className="modalInput" value={selectedGroup.location || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, location: e.target.value })} />
                  </label>
                  <label className="modalLabel">Meeting Link
                    <input className="modalInput" value={selectedGroup.meetingLink || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, meetingLink: e.target.value })} />
                  </label>
                  <label className="modalLabel">Preferred Schedule *
                    <div className="modalRow">
                      <input className="modalInput" type="date" required value={manageScheduleDate} onChange={(e) => setManageScheduleDate(e.target.value)} />
                      <input className="modalInput" type="time" required value={manageScheduleTime} onChange={(e) => setManageScheduleTime(e.target.value)} />
                    </div>
                  </label>
                  <label className="modalLabel">Description *
                    <textarea className="modalInput modalTextarea" required rows={3} value={selectedGroup.description || ""} onChange={(e) => setSelectedGroup({ ...selectedGroup, description: e.target.value })} />
                  </label>
                  <label className="modalLabel" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={!!selectedGroup.approvalRequired} onChange={(e) => setSelectedGroup({ ...selectedGroup, approvalRequired: e.target.checked })} />
                    Require admin approval for join requests
                  </label>
                  <div className="modalActions">
                    <button type="submit" className="modalSubmit">Save Group</button>
                  </div>
                </form>

                <hr />
                <h3>Members</h3>
                <form className="modalRow" onSubmit={handleInviteMember}>
                  <label className="modalLabel">Invite by email
                    <input className="modalInput" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="student@u.nus.edu" />
                  </label>
                  <div className="modalActions" style={{ alignSelf: "end" }}>
                    <button type="submit" className="modalSubmit">Invite</button>
                  </div>
                </form>
                <div>
                  {selectedMembers.map((m) => (
                    <div key={`${m.userId}-${m.role}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                      <div>
                        <strong>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId}</strong>
                        <div>{m.email} · {m.role} · {m.membershipStatus}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(m.membershipStatus === "pending" || m.membershipStatus === "invited") && (
                          <button className="groupJoinBtn" onClick={() => handleApproveMember(m.userId)}>Approve</button>
                        )}
                        {selectedGroup.createdBy !== m.userId && (
                          <button className="groupJoinBtn" onClick={() => handleRemoveMember(m.userId)}>Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modalRow" style={{ marginTop: 12 }}>
                  <label className="modalLabel">Transfer Ownership
                    <select className="modalInput" value={transferOwnerId} onChange={(e) => setTransferOwnerId(e.target.value)}>
                      <option value="">Select approved member</option>
                      {selectedMembers
                        .filter((m) => m.membershipStatus === "approved" && m.userId !== selectedGroup.createdBy)
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId}</option>
                        ))}
                    </select>
                  </label>
                  <div className="modalActions" style={{ alignSelf: "end" }}>
                    <button className="modalSubmit" onClick={handleTransferOwnership} type="button">Transfer</button>
                  </div>
                </div>

                <hr />
                <h3>Scheduled Sessions</h3>
                <form className="modalForm" onSubmit={handleCreateSession}>
                  <label className="modalLabel">Session Title *
                    <input className="modalInput" required value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} />
                  </label>
                  <div className="modalRow">
                    <label className="modalLabel">Starts At (ISO) *
                      <input className="modalInput" required placeholder="2026-03-15T19:00:00" value={sessionForm.startsAt} onChange={(e) => setSessionForm({ ...sessionForm, startsAt: e.target.value })} />
                    </label>
                    <label className="modalLabel">Ends At (ISO)
                      <input className="modalInput" placeholder="2026-03-15T21:00:00" value={sessionForm.endsAt} onChange={(e) => setSessionForm({ ...sessionForm, endsAt: e.target.value })} />
                    </label>
                  </div>
                  <div className="modalRow">
                    <label className="modalLabel">Location
                      <input className="modalInput" value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} />
                    </label>
                    <label className="modalLabel">Meeting Link
                      <input className="modalInput" value={sessionForm.meetingLink} onChange={(e) => setSessionForm({ ...sessionForm, meetingLink: e.target.value })} />
                    </label>
                  </div>
                  <label className="modalLabel">Notes
                    <textarea className="modalInput modalTextarea" rows={2} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} />
                  </label>
                  <div className="modalActions">
                    <button type="submit" className="modalSubmit">Create Session</button>
                  </div>
                </form>

                <div>
                  {selectedSessions.map((s) => (
                    <div key={s.id} className="sessionCard">
                      <div className="sessionCardBody">
                        <strong>{s.title}</strong>
                        <div>{s.startsAt} {s.endsAt ? `→ ${s.endsAt}` : ""}</div>
                        <div>{s.location || s.meetingLink || "No location/link"}</div>
                        <div className="sessionFeedbackMeta">
                          {feedbackSummaryBySession[s.id]?.submitted > 0 && (
                            <span className="sessionFeedbackBadge sessionFeedbackBadgeSuccess">
                              {feedbackSummaryBySession[s.id].submitted} submitted
                            </span>
                          )}
                          {feedbackSummaryBySession[s.id]?.local > 0 && (
                            <span className="sessionFeedbackBadge sessionFeedbackBadgeWarning">
                              {feedbackSummaryBySession[s.id].local} local draft
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="sessionCardActions">
                        <button
                          type="button"
                          className="feedbackActionBtn"
                          onClick={() => openFeedback(s)}
                          disabled={reviewableMembers.length === 0}
                        >
                          Give Feedback
                        </button>
                        <button className="groupJoinBtn" onClick={() => handleDeleteSession(s.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modalActions" style={{ marginTop: 16, justifyContent: "space-between" }}>
                  <button type="button" className="modalCancel" onClick={closeManage}>Close</button>
                  <button type="button" className="modalCancel" onClick={handleDissolveGroup}>Dissolve Group</button>
                </div>
              </>
            )}
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

      {showFeedback && (
        <div className="modalOverlay" onClick={closeFeedback}>
          <div className="modalCard feedbackModalCard" onClick={(e) => e.stopPropagation()}>
            <h2 className="modalTitle">Give Feedback</h2>
            <div className="feedbackIntro">
              <p className="feedbackIntroTitle">{feedbackSession?.title || "Session feedback"}</p>
              <p className="feedbackIntroMeta">Group: {selectedGroup?.name || "Study Group"}</p>
              <p className="feedbackIntroNote">
                Structured peer feedback is ready in the frontend. If the backend endpoint is unavailable, we will save your submission locally.
              </p>
            </div>

            {reviewableMembers.length === 0 ? (
              <div className="feedbackEmptyState">
                No approved peers are available to review yet. Invite or approve more members first.
              </div>
            ) : (
              <form className="modalForm" onSubmit={handleSubmitFeedback}>
                <label className="modalLabel">
                  Select peer to review
                  <select
                    className="modalInput"
                    value={feedbackForm.revieweeId}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, revieweeId: e.target.value })}
                    required
                  >
                    <option value="">Choose a peer</option>
                    {reviewableMembers.map((member) => {
                      const memberId = member.userId || member.email;
                      const memberLabel = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || member.userId;
                      return <option key={memberId} value={memberId}>{memberLabel}</option>;
                    })}
                  </select>
                </label>

                <div className="feedbackSection">
                  <span className="modalLabel">Overall rating</span>
                  <div className="ratingRow" role="radiogroup" aria-label="Overall rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`ratingStar ${feedbackForm.overallRating >= value ? "active" : ""}`}
                        onClick={() => setFeedbackForm({ ...feedbackForm, overallRating: value })}
                        aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="feedbackGrid">
                  {[
                    ["preparedness", "Preparedness"],
                    ["communication", "Communication"],
                    ["helpfulness", "Helpfulness / Contribution"],
                    ["reliability", "Reliability / Punctuality"],
                  ].map(([field, label]) => (
                    <div className="feedbackMetricCard" key={field}>
                      <span className="feedbackMetricLabel">{label}</span>
                      <div className="feedbackScaleRow">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <label className="feedbackScaleOption" key={value}>
                            <input
                              type="radio"
                              name={field}
                              value={value}
                              checked={feedbackForm[field] === value}
                              onChange={() => setFeedbackForm({ ...feedbackForm, [field]: value })}
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <label className="modalLabel">
                  What went well?
                  <textarea
                    className="modalInput modalTextarea"
                    rows={3}
                    placeholder="Highlight positive behaviors, contributions, or collaboration."
                    value={feedbackForm.strengths}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                  />
                </label>

                <label className="modalLabel">
                  Suggestions for improvement
                  <textarea
                    className="modalInput modalTextarea"
                    rows={3}
                    placeholder="Share concrete, respectful suggestions."
                    value={feedbackForm.improvements}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })}
                  />
                </label>

                <label className="feedbackCheckbox">
                  <input
                    type="checkbox"
                    checked={feedbackForm.anonymousToPeer}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, anonymousToPeer: e.target.checked })}
                  />
                  <span>Anonymous to peer</span>
                </label>

                {feedbackStatus.message && (
                  <div className={`feedbackStatus feedbackStatus${feedbackStatus.type === "success" ? "Success" : "Warning"}`}>
                    {feedbackStatus.message}
                  </div>
                )}

                <div className="modalActions">
                  <button type="button" className="modalCancel" onClick={closeFeedback}>Close</button>
                  <button
                    type="submit"
                    className="modalSubmit"
                    disabled={
                      feedbackSubmitting ||
                      !feedbackForm.revieweeId ||
                      feedbackForm.overallRating === 0 ||
                      feedbackForm.preparedness === 0 ||
                      feedbackForm.communication === 0 ||
                      feedbackForm.helpfulness === 0 ||
                      feedbackForm.reliability === 0
                    }
                  >
                    {feedbackSubmitting ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showFeedbackPicker && (
        <div className="modalOverlay" onClick={closeFeedbackPicker}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h2 className="modalTitle">Choose Feedback Session</h2>
            <p className="dashSubtitle">Select one of your joined study groups and a scheduled session before submitting peer feedback.</p>

            <div className="modalForm">
              <label className="modalLabel">
                Study group
                <select
                  className="modalInput"
                  value={selectedFeedbackGroupId}
                  onChange={(e) => handleSelectFeedbackGroup(e.target.value)}
                >
                  {feedbackOptions.map((option) => (
                    <option key={option.group.id} value={option.group.id}>
                      {option.group.name || "Study Group"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="modalLabel">
                Scheduled session
                <select
                  className="modalInput"
                  value={selectedFeedbackSessionId}
                  onChange={(e) => setSelectedFeedbackSessionId(e.target.value)}
                >
                  {(selectedFeedbackGroup?.sessions || []).map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} - {session.startsAt}
                    </option>
                  ))}
                </select>
              </label>

              <div className="feedbackEmptyState">
                You can only choose from study groups you have joined that already have at least one scheduled session and one approved peer to review.
              </div>

              <div className="modalActions">
                <button type="button" className="modalCancel" onClick={closeFeedbackPicker}>Cancel</button>
                <button
                  type="button"
                  className="modalSubmit"
                  onClick={handleLaunchFeedback}
                  disabled={!selectedFeedbackGroupId || !selectedFeedbackSessionId}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
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
