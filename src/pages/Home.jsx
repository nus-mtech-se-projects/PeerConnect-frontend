import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import Carousel from "../components/Carousel";
import FeatureCard from "../components/FeatureCard";
import { AvatarContent } from "../components/DashboardLayout";
import tutoringImg from "../assets/images/tutoring.jpg";
import studyGroupImg from "../assets/images/study-group.jpg";
import chatBotImg from "../assets/images/chatbot.jpg";
import supportSystemImg from "../assets/images/support-system.jpg";
import PropTypes from "prop-types";
import { API_BASE, authHeaders, waitForToken } from "../utils/auth";
import { extractAvatarUrl, subscribeProfileUpdated } from "../utils/profileSync";
import {
  getRuMemberInitials,
  ruAuthRequestOptions,
  ruParseJsonOrEmpty,
  formatRestrictedUserName,
  createAllowConfirmDialog,
  loadRestrictedUsers,
} from "../utils/restrictedUsers";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import "../styles/pages/Dashboard.css";
import "../styles/pages/RestrictUser.css";
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

const TEAMS_FREE_URL = "https://teams.live.com/";
const TEAMS_MEETING_GUIDANCE = "Open Teams Free, create the meeting there, then paste the join link below.";

function getNamePartsLabel(firstName, lastName, fallback = "") {
  const fullName = [firstName, lastName]
    .map(cleanDisplayText)
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || fallback;
}

function cleanDisplayText(value) {
  if (typeof value !== "string") return value;
  const cleaned = value
    .split(/\s+/)
    .filter((part) => part && part !== "null" && part !== "undefined")
    .join(" ")
    .trim();
  return cleaned || "";
}

function getFeedbackReviewerLabel(entry, fallback = "Anonymous") {
  return (
    cleanDisplayText(entry?.reviewerName) ||
    getNamePartsLabel(entry?.reviewerFirstName, entry?.reviewerLastName, "") ||
    cleanDisplayText(entry?.reviewer?.name) ||
    getNamePartsLabel(entry?.reviewer?.firstName, entry?.reviewer?.lastName, "") ||
    cleanDisplayText(entry?.submittedByName) ||
    cleanDisplayText(entry?.createdByName) ||
    cleanDisplayText(entry?.authorName) ||
    cleanDisplayText(entry?.reviewerEmail) ||
    cleanDisplayText(entry?.submittedByEmail) ||
    fallback
  );
}

function normalizeFeedbackEntry(entry, index = 0) {
  const anonymousToPeer = !!entry?.anonymousToPeer;
  const reviewerLabel = anonymousToPeer ? "Anonymous" : getFeedbackReviewerLabel(entry);
  return {
    id: entry?.id || entry?._id || entry?.feedbackId || `${reviewerLabel}-${entry?.submittedAt || entry?.savedAt || index}`,
    reviewerLabel,
    reviewerEmail: anonymousToPeer
      ? ""
      : cleanDisplayText(entry?.reviewerEmail) || cleanDisplayText(entry?.submittedByEmail) || cleanDisplayText(entry?.reviewer?.email) || "",
    revieweeLabel:
      cleanDisplayText(entry?.revieweeLabel) ||
      cleanDisplayText(entry?.revieweeName) ||
      getNamePartsLabel(entry?.revieweeFirstName, entry?.revieweeLastName, "") ||
      cleanDisplayText(entry?.reviewee?.name) ||
      cleanDisplayText(entry?.revieweeEmail) ||
      cleanDisplayText(entry?.revieweeId) ||
      "Tutor",
    overallRating: Number(entry?.overallRating || 0),
    preparedness: Number(entry?.preparedness || 0),
    communication: Number(entry?.communication || 0),
    helpfulness: Number(entry?.helpfulness || 0),
    reliability: Number(entry?.reliability || 0),
    strengths: entry?.strengths || "",
    improvements: entry?.improvements || "",
    anonymousToPeer,
    submittedAt: entry?.submittedAt || entry?.createdAt || entry?.savedAt || "",
    syncStatus: entry?.syncStatus || "",
  };
}

function normalizeFeedbackCollection(payload) {
  const extractItems = (p) => {
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.feedback)) return p.feedback;
    if (Array.isArray(p?.feedbacks)) return p.feedbacks;
    if (Array.isArray(p?.items)) return p.items;
    if (Array.isArray(p?.records)) return p.records;
    return [];
  };
  const rawItems = extractItems(payload);
  return rawItems.map((item, index) => normalizeFeedbackEntry(item, index));
}

function getTutoringActionLabel(course, enrollingId) {
  if (enrollingId === course.id) {
    return course.enrolled ? "Leaving…" : "Joining…";
  }
  return course.enrolled ? "Leave" : "Join";
}

function getGroupMembershipButtonLabel(group, membershipActionId) {
  if (membershipActionId === group.id) {
    return group.joined ? "Leaving…" : "Joining…";
  }
  if (group.joined) return "Leave";
  return group.membershipStatus === "pending" ? "Pending" : "Join";
}

function getProfileDisplayName(profileData) {
  const fullName = [profileData?.firstName, profileData?.lastName].filter(Boolean).join(" ");
  return fullName || profileData?.name || "";
}

function filterDashboardGroups(groups, search, myGroupsOnly) {
  const q = search.toLowerCase().trim();
  return groups.filter((group) => {
    const matchesAdminFilter = !myGroupsOnly || group.isAdmin;
    const matchesSearch =
      !q ||
      group.name?.toLowerCase().includes(q) ||
      group.moduleCode?.toLowerCase().includes(q) ||
      group.courseCode?.toLowerCase().includes(q) ||
      group.topic?.toLowerCase().includes(q);
    return matchesAdminFilter && matchesSearch;
  });
}

function openMeetingLink(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function getReviewableMembers(members, userEmail) {
  return members.filter((member) => member.membershipStatus === "approved" && member.email !== userEmail);
}

async function fetchFirstAvailableProfile() {
  const headers = authHeaders();
  let fallbackProfile = null;
  for (const url of [`${API_BASE}/api/users/me`, `${API_BASE}/api/profile`]) {
    try {
      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!fallbackProfile) fallbackProfile = data;
      const avatar = extractAvatarUrl(data);
      if (avatar) return data;
    } catch {
      // Try next endpoint.
    }
  }
  return fallbackProfile;
}

/* ──────── SVG icons ──────── */
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const GroupsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const TutoringIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
);
const AiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /><path d="M17 12h.01" /><path d="M7 12h.01" /></svg>
);
const SupportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
);
const RestrictIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="4" /><line x1="17" y1="9" x2="21" y2="13" /></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const GridViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
);
const ListViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" /></svg>
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

/* ──────────────────── Peer Tutoring Components ──────────────────── */

TutorDashboard.propTypes = {
  onClassCreated: PropTypes.func,
  onViewFeedbacks: PropTypes.func,
  showToast: PropTypes.func.isRequired,
  setConfirmDialog: PropTypes.func.isRequired,
};
function TutorDashboard({ onClassCreated, onViewFeedbacks, showToast, setConfirmDialog }) {
  const emptyClassForm = {
    title: "", moduleCode: "", topic: "", description: "",
    schedule: "", mode: "online", location: "", meetingLink: "", maxStudents: 5,
  };
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingClassId, setEditingClassId] = useState(null);
  const [newClass, setNewClass] = useState(emptyClassForm);
  const [formErrors, setFormErrors] = useState({});
  const [viewMode, setViewMode] = useState("grid");

  function validateNewClass(cls) {
    const errors = {};
    if (!cls.title.trim())
      errors.title = 'Class title is required. Try something like "CS2030 Weekly Tutoring" or "MA1521 Calculus Help".';
    else if (cls.title.trim().length < 3)
      errors.title = 'Title is too short. Use at least 3 characters (e.g. "CS2040 Tutoring").';

    if (!cls.moduleCode.trim())
      errors.moduleCode = "Module code is required. Format: 2-3 letters + 4 digits + optional letter (e.g. CS2030, MA1521, CS2030S).";
    else if (!/^[A-Z]{2,3}\d{4}[A-Z]{0,2}$/i.test(cls.moduleCode.trim()))
      errors.moduleCode = `"${cls.moduleCode.trim()}" is not a valid NUS module code. Expected: 2-3 letters + 4 digits + optional letter (e.g. CS2030, MA1521, GEA1000N).`;

    if (!cls.schedule.trim())
      errors.schedule = 'Schedule is required. Describe when sessions run (e.g. "Every Sat 2-4pm" or "Mon & Wed 6-7:30pm").';
    else if (cls.schedule.trim().length < 5)
      errors.schedule = 'Schedule is too vague. Try something like "Every Friday 3-5pm" or "Sundays 10am-12pm".';

    if (cls.maxStudents < 1 || cls.maxStudents > 20)
      errors.maxStudents = "Max students must be between 1 and 20.";

    if ((cls.mode === "online" || cls.mode === "hybrid") && !cls.meetingLink.trim())
      errors.meetingLink = "A meeting link is required for online/hybrid classes. Paste your Zoom, Teams, or Google Meet link (e.g. https://zoom.us/j/123456789).";
    else if ((cls.mode === "online" || cls.mode === "hybrid") && cls.meetingLink.trim() &&
      !/^https?:\/\/.+/i.test(cls.meetingLink.trim()))
      errors.meetingLink = `"${cls.meetingLink.trim()}" doesn't look like a valid link. It should start with https:// (e.g. https://zoom.us/j/123456789 or https://teams.microsoft.com/...).`;

    if ((cls.mode === "in-person" || cls.mode === "hybrid") && !cls.location.trim())
      errors.location = "Location is required for in-person/hybrid classes. Include the building and room (e.g. COM1-B103 or CLB Seminar Room 6).";

    if (cls.description && cls.description.length > 500)
      errors.description = `Description is ${cls.description.length} characters. Please shorten it to 500 or fewer.`;

    return errors;
  }

  useEffect(() => {
    let cancelled = false;
    const loadTutorClasses = async () => {
      setLoading(true);
      try {
        await waitForToken();
        const res = await fetch(`${API_BASE}/api/tutoring/classes`, { headers: authHeaders(), credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const myClasses = Array.isArray(data) ? data.filter((c) => c.isTutor) : [];
        setClasses(myClasses);
      } catch (err) {
        if (!cancelled) {
          const message = err?.message === "Authentication timeout" ? err.message : (err?.message || "Authentication timeout");
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTutorClasses();
    return () => { cancelled = true; };
  }, []);

  function closeClassModal() {
    setShowCreate(false);
    setEditingClassId(null);
    setNewClass(emptyClassForm);
    setFormErrors({});
  }

  function openCreateModal() {
    setEditingClassId(null);
    setNewClass(emptyClassForm);
    setFormErrors({});
    setShowCreate(true);
  }

  function openEditModal(classData) {
    setEditingClassId(classData.id);
    setNewClass({
      title: classData.title || "",
      moduleCode: classData.moduleCode || "",
      topic: classData.topic || "",
      description: classData.description || "",
      schedule: classData.schedule || "",
      mode: classData.mode || "online",
      location: classData.location || "",
      meetingLink: classData.meetingLink || "",
      maxStudents: classData.maxStudents ?? 5,
    });
    setFormErrors({});
    setShowCreate(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const errors = validateNewClass(newClass);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setCreating(true);
    try {
      const isEditing = !!editingClassId;
      const res = await fetch(`${API_BASE}/api/tutoring/classes${isEditing ? `/${editingClassId}` : ""}`, {
        method: isEditing ? "PUT" : "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify(newClass),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `${isEditing ? "Update" : "Create"} failed (${res.status})`);
      if (isEditing) {
        setClasses((prev) => prev.map((c) => c.id === editingClassId ? data : c));
        showToast("Tutor group updated successfully.");
      } else {
        setClasses((prev) => [data, ...prev]);
        onClassCreated?.(data);
        showToast("Tutor group created successfully.");
      }
      closeClassModal();
    } catch (err) {
      setFormErrors({ _submit: err.message });
      showToast(err.message, "error");
    }
    finally { setCreating(false); }
  }

  async function executeDelete(classId) {
    try {
      const res = await fetch(`${API_BASE}/api/tutoring/classes/${classId}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      closeClassModal();
      showToast("Tutor group deleted successfully.");
    } catch (err) { showToast(err.message, "error"); }
  }

  function handleDelete(classId) {
    closeClassModal();
    setConfirmDialog({
      message: "Are you sure you want to delete this tutoring class?",
      confirmBtnClass: "ptUnifiedBtn",
      cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setConfirmDialog(null);
        executeDelete(classId);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }

  return (
    <div>
      <div className="dashHeader">
        <div className="dashHeaderTop">
          <div>
            <h1 className="dashTitle">Tutor Dashboard</h1>
            <p className="dashSubtitle">Create and manage your tutoring classes</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="ptViewToggle">
              <button className={`ptViewBtn${viewMode === "grid" ? " active" : ""}`} onClick={() => setViewMode("grid")} title="Grid view"><GridViewIcon /></button>
              <button className={`ptViewBtn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")} title="List view"><ListViewIcon /></button>
            </div>
            <button className="dashCreateBtn" onClick={openCreateModal}><PlusIcon /> Create Class</button>
          </div>
        </div>
      </div>

      {loading && <p className="dashMsg">Loading classes…</p>}
      {error && <p className="dashMsg dashError">{error}</p>}
      {!loading && !error && classes.length === 0 && (
        <div className="dashEmpty"><TutoringIcon /><p>No classes yet. Create one to start tutoring!</p></div>
      )}

      {viewMode === "grid" ? (
        <div className="dashGrid">
          {classes.map((c) => (
            <div className="groupCard" key={c.id}>
              <div className="groupCardHeader">
                <span className="groupCourse">{c.moduleCode || "General"}</span>
                <span className={`groupMode ${c.mode}`}>{c.mode === "online" ? "Online" : "In-Person"}</span>
              </div>
              <h3 className="groupName">{c.title}</h3>
              {c.topic && <p className="groupTopic">Topic:{c.topic}</p>}
              {c.description && <p className="groupDesc">Description:{c.description}</p>}
              {c.schedule && (
                <p className="groupTopic" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Schedule:{c.schedule}
                </p>
              )}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #f3f4f6" }}>
                <span className="groupMembers">{c.enrolledCount ?? 0}/{c.maxStudents ?? "∞"} enrolled</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.meetingLink && (
                    <button className="ptUnifiedBtn" onClick={() => openMeetingLink(c.meetingLink)}>
                      Join Meeting
                    </button>
                  )}
                  <button className="ptUnifiedBtn" onClick={() => onViewFeedbacks?.(c)}>View Feedbacks</button>
                  <button className="ptUnifiedBtn" onClick={() => openEditModal(c)}>Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ptListView">
          <table className="ptTable">
            <thead>
              <tr>
                <th>Module</th>
                <th>Title</th>
                <th>Topic</th>
                <th>Schedule</th>
                <th>Mode</th>
                <th>Enrolled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td><span className="groupCourse">{c.moduleCode || "General"}</span></td>
                  <td className="ptTableTitle">{c.title}</td>
                  <td>{c.topic || "—"}</td>
                  <td>{c.schedule || "—"}</td>
                  <td><span className={`groupMode ${c.mode}`}>{c.mode === "online" ? "Online" : "In-Person"}</span></td>
                  <td>{c.enrolledCount ?? 0}/{c.maxStudents ?? "∞"}</td>
                  <td>
                    <div className="ptTableActions">
                      {c.meetingLink && (
                        <button className="ptUnifiedBtn" onClick={() => openMeetingLink(c.meetingLink)}>Join Meeting</button>
                      )}
                      <button className="ptUnifiedBtn" onClick={() => onViewFeedbacks?.(c)}>View Feedbacks</button>
                      <button className="ptUnifiedBtn" onClick={() => openEditModal(c)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <>
          <button type="button" className="modalOverlay" aria-label="Close tutoring class modal" onClick={closeClassModal} />
          <dialog open className="modalCard" aria-modal="true" onCancel={(e) => { e.preventDefault(); closeClassModal(); }}>
            <h2 className="modalTitle">{editingClassId ? "Edit Tutoring Class" : "Create Tutoring Class"}</h2>
            <form className="modalForm" onSubmit={handleCreate}>
              {formErrors._submit && <p className="fieldError" style={{ marginBottom: 8 }}>{formErrors._submit}</p>}
              <label className="modalLabel">
                <span>Class Title *</span>
                <input className={`modalInput${formErrors.title ? " modalInput--error" : ""}`} value={newClass.title} onChange={(e) => { setNewClass({ ...newClass, title: e.target.value }); setFormErrors((p) => ({ ...p, title: "" })); }} placeholder="e.g. CS2030 Weekly Tutoring" />
                {formErrors.title && <span className="fieldError">{formErrors.title}</span>}
              </label>
              <div className="modalRow">
                <label className="modalLabel">
                  <span>Module Code *</span>
                  <input className={`modalInput${formErrors.moduleCode ? " modalInput--error" : ""}`} value={newClass.moduleCode} onChange={(e) => { setNewClass({ ...newClass, moduleCode: e.target.value.toUpperCase() }); setFormErrors((p) => ({ ...p, moduleCode: "" })); }} placeholder="e.g. CS2030" />
                  {formErrors.moduleCode && <span className="fieldError">{formErrors.moduleCode}</span>}
                </label>
                <label className="modalLabel">
                  <span>Topic</span>
                  <input className="modalInput" value={newClass.topic} onChange={(e) => setNewClass({ ...newClass, topic: e.target.value })} placeholder="e.g. OOP & Streams" />
                </label>
              </div>
              <div className="modalRow">
                <label className="modalLabel">
                  <span>Mode</span>
                  <select className="modalInput" value={newClass.mode} onChange={(e) => { setNewClass({ ...newClass, mode: e.target.value, meetingLink: "", location: "" }); }}>
                    <option value="online">Online</option>
                    <option value="in-person">In-Person</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <label className="modalLabel">
                  <span>Max Students</span>
                  <input className={`modalInput${formErrors.maxStudents ? " modalInput--error" : ""}`} type="number" min={1} max={20} value={newClass.maxStudents} onChange={(e) => { setNewClass({ ...newClass, maxStudents: Number(e.target.value) }); setFormErrors((p) => ({ ...p, maxStudents: "" })); }} />
                  {formErrors.maxStudents && <span className="fieldError">{formErrors.maxStudents}</span>}
                </label>
              </div>
              {(newClass.mode === "in-person" || newClass.mode === "hybrid") && (
                <label className="modalLabel">
                  <span>Location *</span>
                  <input className={`modalInput${formErrors.location ? " modalInput--error" : ""}`} value={newClass.location} onChange={(e) => { setNewClass({ ...newClass, location: e.target.value }); setFormErrors((p) => ({ ...p, location: "" })); }} placeholder="e.g. COM1 Level 2" />
                  {formErrors.location && <span className="fieldError">{formErrors.location}</span>}
                </label>
              )}
              {(newClass.mode === "online" || newClass.mode === "hybrid") && (
                <div className="modalLabel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Meeting Link *</span>
                    <button
                      type="button"
                      className="modalCancel"
                      style={{ padding: "8px 12px" }}
                      onClick={() => {
                        window.open(TEAMS_FREE_URL, "_blank", "noopener,noreferrer");
                        setFormErrors((p) => ({ ...p, meetingLink: TEAMS_MEETING_GUIDANCE }));
                      }}
                    >
                      Open Teams Free
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    {TEAMS_MEETING_GUIDANCE}
                  </div>
                  <input
                    aria-label="Meeting Link *"
                    className={`modalInput${formErrors.meetingLink ? " modalInput--error" : ""}`}
                    value={newClass.meetingLink}
                    onChange={(e) => { setNewClass({ ...newClass, meetingLink: e.target.value }); setFormErrors((p) => ({ ...p, meetingLink: "" })); }}
                    placeholder="e.g. https://zoom.us/j/..."
                  />
                  {formErrors.meetingLink && <span className="fieldError">{formErrors.meetingLink}</span>}
                </div>
              )}
              <label className="modalLabel">
                <span>Schedule *</span>
                <input className={`modalInput${formErrors.schedule ? " modalInput--error" : ""}`} value={newClass.schedule} onChange={(e) => { setNewClass({ ...newClass, schedule: e.target.value }); setFormErrors((p) => ({ ...p, schedule: "" })); }} placeholder="e.g. Every Sat 2–4pm" />
                {formErrors.schedule && <span className="fieldError">{formErrors.schedule}</span>}
              </label>
              <label className="modalLabel">
                <span>Description <span style={{ fontWeight: 400, color: "#9ca3af" }}>({newClass.description.length}/500)</span></span>
                <textarea className={`modalInput modalTextarea${formErrors.description ? " modalInput--error" : ""}`} rows={3} value={newClass.description} onChange={(e) => { setNewClass({ ...newClass, description: e.target.value }); setFormErrors((p) => ({ ...p, description: "" })); }} />
                {formErrors.description && <span className="fieldError">{formErrors.description}</span>}
              </label>
              <div className="modalActions">
                {editingClassId && (
                  <button type="button" className="groupJoinBtn ptDeleteBtn" onClick={() => handleDelete(editingClassId)} disabled={creating}>Delete</button>
                )}
                <button type="button" className="modalCancel" onClick={closeClassModal}>Cancel</button>
                <button type="submit" className="modalSubmit" disabled={creating}>{creating ? (editingClassId ? "Updating…" : "Creating…") : (editingClassId ? "Update" : "Create Class")}</button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </div>
  );
}

TuteeDashboard.propTypes = {
  excludeIds: PropTypes.instanceOf(Set),
  onGiveFeedback: PropTypes.func,
  showToast: PropTypes.func.isRequired,
};
function TuteeDashboard({ excludeIds = new Set(), onGiveFeedback, showToast }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [enrollingId, setEnrollingId] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  useEffect(() => {
    let cancelled = false;
    const loadTuteeClasses = async () => {
      setLoading(true);
      try {
        await waitForToken();
        const res = await fetch(`${API_BASE}/api/tutoring/classes`, { headers: authHeaders(), credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const visibleClasses = Array.isArray(data)
          ? data.filter((c) => !c.isTutor && !excludeIds.has(c.id))
          : [];
        setClasses(visibleClasses);
      } catch (err) {
        if (!cancelled) {
          const message = err?.message === "Authentication timeout" ? err.message : (err?.message || "Authentication timeout");
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTuteeClasses();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const visible = classes.filter((c) => !excludeIds.has(c.id));
    const q = search.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.moduleCode?.toLowerCase().includes(q) ||
      c.topic?.toLowerCase().includes(q) ||
      c.tutorName?.toLowerCase().includes(q)
    );
  }, [classes, search, excludeIds]);

  async function handleEnroll(classId) {
    setEnrollingId(classId);
    try {
      const res = await fetch(`${API_BASE}/api/tutoring/classes/${classId}/enroll`, {
        method: "POST", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Enroll failed (${res.status})`);
      setClasses((prev) => prev.map((c) => c.id === classId ? { ...c, enrolled: true, enrolledCount: (c.enrolledCount ?? 0) + 1 } : c));
      showToast("Joined tutor group successfully. Notification emails were sent automatically.");
    } catch (err) {
      showToast(err.message, "error");
    } finally { setEnrollingId(null); }
  }

  async function handleLeaveClass(classId) {
    setEnrollingId(classId);
    try {
      const res = await fetch(`${API_BASE}/api/tutoring/classes/${classId}/leave`, {
        method: "POST", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Leave failed (${res.status})`);
      setClasses((prev) => prev.map((c) => c.id === classId ? { ...c, enrolled: false, enrolledCount: Math.max(0, (c.enrolledCount ?? 1) - 1) } : c));
      showToast("Left tutor group successfully. Notification emails were sent automatically.");
    } catch (err) {
      showToast(err.message, "error");
    } finally { setEnrollingId(null); }
  }

  return (
    <div>
      <div className="dashHeader">
        <div className="dashHeaderTop">
          <div>
            <h1 className="dashTitle">Tutee Dashboard</h1>
            <p className="dashSubtitle">Find and join tutoring classes</p>
          </div>
          <div className="ptViewToggle">
            <button className={`ptViewBtn${viewMode === "grid" ? " active" : ""}`} onClick={() => setViewMode("grid")} title="Grid view"><GridViewIcon /></button>
            <button className={`ptViewBtn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")} title="List view"><ListViewIcon /></button>
          </div>
        </div>
        <div className="dashSearchWrap">
          <SearchIcon />
          <input className="dashSearch" type="text" placeholder="Search by module, topic, or tutor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading && <p className="dashMsg">Loading classes…</p>}
      {error && <p className="dashMsg dashError">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="dashEmpty"><TutoringIcon /><p>No tutoring classes available yet.</p></div>
      )}

      {viewMode === "grid" ? (
        <div className="dashGrid">
          {filtered.map((c) => (
            <div className="groupCard" key={c.id}>
              <div className="groupCardHeader">
                <span className="groupCourse">{c.moduleCode || "General"}</span>
                <span className={`groupMode ${c.mode}`}>{c.mode === "online" ? "Online" : "In-Person"}</span>
              </div>
              <h3 className="groupName">{c.title}</h3>
              {c.tutorName && <p className="groupTopic">Tutor: <strong>{c.tutorName.split(" ").filter((p) => p && p !== "null" && p !== "undefined").join(" ")}</strong></p>}
              {c.topic && <p className="groupTopic">{c.topic}</p>}
              {c.description && <p className="groupDesc">{c.description}</p>}
              {c.schedule && (
                <p className="groupTopic" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>🗓</span> {c.schedule}
                </p>
              )}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #f3f4f6" }}>
                <span className="groupMembers">{c.enrolledCount ?? 0}/{c.maxStudents ?? "∞"} enrolled</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.enrolled && c.meetingLink && (
                    <button className="ptUnifiedBtn" onClick={() => openMeetingLink(c.meetingLink)}>
                      Join Meeting
                    </button>
                  )}
                  {c.enrolled && onGiveFeedback && (
                    <button className="ptUnifiedBtn" onClick={() => onGiveFeedback(c)}>Feedback</button>
                  )}
                  <button
                    className="ptUnifiedBtn"
                    onClick={() => c.enrolled ? handleLeaveClass(c.id) : handleEnroll(c.id)}
                    disabled={!c.id || enrollingId === c.id || (!c.enrolled && (c.enrolledCount ?? 0) >= (c.maxStudents ?? Infinity))}
                  >
                    {getTutoringActionLabel(c, enrollingId)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ptListView">
          <table className="ptTable">
            <thead>
              <tr>
                <th>Module</th>
                <th>Title</th>
                <th>Tutor</th>
                <th>Topic</th>
                <th>Schedule</th>
                <th>Mode</th>
                <th>Enrolled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td><span className="groupCourse">{c.moduleCode || "General"}</span></td>
                  <td className="ptTableTitle">{c.title}</td>
                  <td>{c.tutorName ? c.tutorName.split(" ").filter((p) => p && p !== "null" && p !== "undefined").join(" ") : "—"}</td>
                  <td>{c.topic || "—"}</td>
                  <td>{c.schedule || "—"}</td>
                  <td><span className={`groupMode ${c.mode}`}>{c.mode === "online" ? "Online" : "In-Person"}</span></td>
                  <td>{c.enrolledCount ?? 0}/{c.maxStudents ?? "∞"}</td>
                  <td>
                    <div className="ptTableActions">
                      {c.enrolled && c.meetingLink && (
                        <button className="ptUnifiedBtn" onClick={() => openMeetingLink(c.meetingLink)}>Join Meeting</button>
                      )}
                      {c.enrolled && onGiveFeedback && (
                        <button className="ptUnifiedBtn" onClick={() => onGiveFeedback(c)}>Feedback</button>
                      )}
                      <button
                        className="ptUnifiedBtn"
                        onClick={() => c.enrolled ? handleLeaveClass(c.id) : handleEnroll(c.id)}
                        disabled={!c.id || enrollingId === c.id || (!c.enrolled && (c.enrolledCount ?? 0) >= (c.maxStudents ?? Infinity))}
                      >
                        {getTutoringActionLabel(c, enrollingId)}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

PeerTutoringSection.propTypes = {
  onGiveFeedback: PropTypes.func,
  onViewTutorFeedbacks: PropTypes.func,
  showToast: PropTypes.func.isRequired,
  setConfirmDialog: PropTypes.func.isRequired,
};
function PeerTutoringSection({ onGiveFeedback, onViewTutorFeedbacks, showToast, setConfirmDialog }) {
  const [role, setRole] = useState(null);
  const [myClassIds, setMyClassIds] = useState(new Set());

  function handleClassCreated(classData) {
    if (classData?.id) {
      setMyClassIds((prev) => new Set([...prev, classData.id]));
    }
  }

  return (
    <div>
      <div className="ptRoleNav">
        <button
          className={`ptRoleBtn ${role === "tutor" ? "active" : ""}`}
          onClick={() => setRole("tutor")}
        >
          <TutoringIcon /> I&apos;m a Tutor
        </button>
        <button
          className={`ptRoleBtn ${role === "tutee" ? "active" : ""}`}
          onClick={() => setRole("tutee")}
        >
          <GroupsIcon /> I&apos;m a Tutee
        </button>
      </div>

      {!role && (
        <div className="dashEmpty" style={{ marginTop: 40 }}>
          <TutoringIcon />
          <p>Select your role above to get started with peer tutoring.</p>
        </div>
      )}

      {role === "tutor" && <TutorDashboard onClassCreated={handleClassCreated} onViewFeedbacks={onViewTutorFeedbacks} showToast={showToast} setConfirmDialog={setConfirmDialog} />}
      {role === "tutee" && <TuteeDashboard excludeIds={myClassIds} onGiveFeedback={onGiveFeedback} showToast={showToast} />}
    </div>
  );
}

StarRating.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  label: PropTypes.string,
};
function StarRating({ value, onChange, label }) {
  return (
    <fieldset style={{ display: "flex", gap: 4, marginTop: 4, border: "none", padding: 0, margin: 0 }}>
      {label && <legend className="sr-only">{label}</legend>}
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: star <= value ? "#f59e0b" : "#d1d5db", padding: "0 2px" }}
        >
          {star <= value ? "★" : "☆"}
        </button>
      ))}
    </fieldset>
  );
}

/* ──────────── Restricted Members Section ──────────── */

RestrictionActionButton.propTypes = {
  userId: PropTypes.string.isRequired,
  restricted: PropTypes.bool.isRequired,
  actionId: PropTypes.string,
  onRestrict: PropTypes.func.isRequired,
  onAllow: PropTypes.func.isRequired,
};
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

RestrictUsersTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    userId: PropTypes.string,
    restrictedUserId: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    avatarUrl: PropTypes.string,
    createdAt: PropTypes.string,
    restricted: PropTypes.bool,
  })).isRequired,
  actionId: PropTypes.string,
  onRestrict: PropTypes.func.isRequired,
  onAllow: PropTypes.func.isRequired,
  showRestrictedOn: PropTypes.bool,
};
function RestrictUsersTable({ rows, actionId, onRestrict, onAllow, showRestrictedOn = false }) {
  return (
    <div className="ruTableWrap">
      <table className="ruTable">
        <thead>
          <tr>
            <th>Avatar</th>
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
                <td>
                  <div className="ruUserAvatar">
                    <AvatarContent avatarUrl={extractAvatarUrl(user) || ""} userInitial={getRuMemberInitials(user)} />
                  </div>
                </td>
                <td>{formatRestrictedUserName(user)}</td>
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

RestrictedMemberSection.propTypes = {
  showToast: PropTypes.func.isRequired,
  setConfirmDialog: PropTypes.func.isRequired,
};
function RestrictedMemberSection({ showToast, setConfirmDialog }) {
  const [restrictedList, setRestrictedList] = useState([]);
  const [ruLoading, setRuLoading] = useState(true);
  const [ruSearch, setRuSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);
  const searchTimer = useRef(null);

  async function executeRestrictionAction({ userId, method, url, fallbackError, successMessage, restrictedValue }) {
    try {
      const res = await fetch(url, ruAuthRequestOptions(method === "POST" ? { method, body: JSON.stringify({ userId }) } : { method }));
      const data = await ruParseJsonOrEmpty(res);
      if (!res.ok) throw new Error(data?.error || `${fallbackError} (${res.status})`);
      showToast(successMessage);
      await loadRestricted();
      setSearchResults((prev) => prev.map((u) => u.userId === userId ? { ...u, restricted: restrictedValue } : u));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function loadRestricted() {
    try {
      const data = await loadRestrictedUsers();
      setRestrictedList(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message, "error"); }
    finally { setRuLoading(false); }
  }

  useEffect(() => {
    waitForToken().then(() => loadRestricted()).catch(() => setRuLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (ruSearch.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/restricted-users/search?q=${encodeURIComponent(ruSearch.trim())}`,
          ruAuthRequestOptions()
        );
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [ruSearch]);

  async function executeRestrict(userId) {
    await executeRestrictionAction({
      userId, method: "POST", url: `${API_BASE}/api/restricted-users`,
      fallbackError: "Restrict failed", successMessage: "User restricted successfully!", restrictedValue: true,
    });
  }

  async function executeAllow(userId) {
    await executeRestrictionAction({
      userId, method: "DELETE", url: `${API_BASE}/api/restricted-users/${userId}`,
      fallbackError: "Allow failed", successMessage: "User allowed successfully!", restrictedValue: false,
    });
  }

  function handleRestrict(userId) {
    setActionId(userId);
    executeRestrict(userId);
  }

  function handleAllow(userId) {
    setConfirmDialog(createAllowConfirmDialog(userId, setConfirmDialog, executeAllow, showToast));
  }

  return (
    <section className="dashMain" style={{ display: "block" }}>
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
            value={ruSearch}
            onChange={(e) => setRuSearch(e.target.value)}
          />
        </div>
      </div>

      {ruSearch.trim().length >= 2 && (
        <div className="ruSearchResults">
          <h3 className="ruSectionTitle">Search Results</h3>
          {searching && <p className="dashMsg">Searching…</p>}
          {!searching && searchResults.length === 0 && <p className="dashMsg">No users found.</p>}
          {!searching && searchResults.length > 0 && (
            <RestrictUsersTable rows={searchResults} actionId={actionId} onRestrict={handleRestrict} onAllow={handleAllow} />
          )}
        </div>
      )}

      <div className="ruSection">
        <h3 className="ruSectionTitle">Restricted Members ({restrictedList.length})</h3>
        {ruLoading && <p className="dashMsg">Loading…</p>}
        {!ruLoading && restrictedList.length === 0 && (
          <div className="dashEmpty">
            <RestrictIcon />
            <p>No restricted members. Users you restrict will appear here.</p>
          </div>
        )}
        {!ruLoading && restrictedList.length > 0 && (
          <RestrictUsersTable rows={restrictedList} actionId={actionId} onRestrict={handleRestrict} onAllow={handleAllow} showRestrictedOn />
        )}
      </div>
    </section>
  );
}

StudyGroupCard.propTypes = {
  group: PropTypes.object.isRequired,
  membershipActionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onJoin: PropTypes.func.isRequired,
  onLeave: PropTypes.func.isRequired,
  onOpenGroup: PropTypes.func.isRequired,
};
function StudyGroupCard({ group, membershipActionId, onJoin, onLeave, onOpenGroup }) {
  return (
    <div className="groupCard" key={group.id || group.name}>
      <div className="groupCardHeader">
        <span className="groupCourse">{group.moduleCode || group.courseCode || "General"}</span>
        <span className={`groupMode ${group.studyMode}`}>{group.studyMode === "online" ? "Online" : "In-Person"}</span>
      </div>
      <h3 className="groupName">{group.name || "Study Group"}</h3>
      <p className="groupTopic">{group.topic || "No topic specified"}</p>
      {group.description && <p className="groupDesc">{group.description}</p>}
      {group.preferredSchedule && <p className="groupTopic">Schedule: {group.preferredSchedule}</p>}
      {group.status && <p className="groupTopic">Status: {group.status}</p>}
      <div className="groupFooter">
        <span className="groupMembers">{group.memberCount ?? "?"}/{group.maxMembers ?? "∞"} members</span>
        <div style={{ display: "flex", gap: 8 }}>
          {!group.isAdmin && (
            <button
              className={group.joined ? "groupLeaveBtn" : "groupJoinBtn"}
              onClick={() => (group.joined ? onLeave(group.id) : onJoin(group.id))}
              disabled={!group.id || membershipActionId === group.id || group.status === "dissolved" || (!group.joined && group.status === "full")}
            >
              {getGroupMembershipButtonLabel(group, membershipActionId)}
            </button>
          )}
          <button className="groupManageBtn" onClick={() => onOpenGroup(group.id)}>
            {group.isAdmin ? "Manage" : "Info"}
          </button>
        </div>
      </div>
    </div>
  );
}

StudyGroupsModule.propTypes = {
  myGroupsOnly: PropTypes.bool.isRequired,
  setMyGroupsOnly: PropTypes.func.isRequired,
  setShowCreate: PropTypes.func.isRequired,
  search: PropTypes.string.isRequired,
  setSearch: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  filtered: PropTypes.array.isRequired,
  membershipActionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onJoin: PropTypes.func.isRequired,
  onLeave: PropTypes.func.isRequired,
  onOpenGroup: PropTypes.func.isRequired,
};
function StudyGroupsModule({
  myGroupsOnly,
  setMyGroupsOnly,
  setShowCreate,
  search,
  setSearch,
  loading,
  error,
  filtered,
  membershipActionId,
  onJoin,
  onLeave,
  onOpenGroup,
}) {
  return (
    <>
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
          <StudyGroupCard
            key={g.id || g.name}
            group={g}
            membershipActionId={membershipActionId}
            onJoin={onJoin}
            onLeave={onLeave}
            onOpenGroup={onOpenGroup}
          />
        ))}
      </div>
    </>
  );
}

CreateGroupModal.propTypes = {
  showCreate: PropTypes.bool.isRequired,
  setShowCreate: PropTypes.func.isRequired,
  creating: PropTypes.bool.isRequired,
  newGroup: PropTypes.object.isRequired,
  setNewGroup: PropTypes.func.isRequired,
  handleCreate: PropTypes.func.isRequired,
};
function CreateGroupModal({ showCreate, setShowCreate, creating, newGroup, setNewGroup, handleCreate }) {
  if (!showCreate) return null;
  return (
    <>
      <button type="button" className="modalOverlay" aria-label="Close create study group modal" onClick={() => setShowCreate(false)} />
      <dialog open className="modalCard" aria-modal="true" onCancel={(e) => { e.preventDefault(); setShowCreate(false); }}>
        <h2 className="modalTitle">Create Study Group</h2>
        <form className="modalForm" onSubmit={handleCreate}>
          <label className="modalLabel">
            <span>Group Name *</span>
            <input className="modalInput" required value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
          </label>
          <div className="modalRow">
            <label className="modalLabel">
              <span>Module / Subject *</span>
              <input className="modalInput" required placeholder="e.g. CS2030" value={newGroup.moduleCode} onChange={(e) => setNewGroup({ ...newGroup, moduleCode: e.target.value })} />
            </label>
            <label className="modalLabel">
              <span>Topic</span>
              <input className="modalInput" placeholder="e.g. Data Structures" value={newGroup.topic} onChange={(e) => setNewGroup({ ...newGroup, topic: e.target.value })} />
            </label>
          </div>
          <div className="modalRow">
            <label className="modalLabel">
              <span>Study Mode</span>
              <select className="modalInput" value={newGroup.studyMode} onChange={(e) => setNewGroup({ ...newGroup, studyMode: e.target.value })}>
                <option value="online">Online</option>
                <option value="in-person">In-Person</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="modalLabel">
              <span>Max Members</span>
              <input className="modalInput" type="number" min={2} max={50} value={newGroup.maxMembers} onChange={(e) => setNewGroup({ ...newGroup, maxMembers: Number(e.target.value) })} />
            </label>
          </div>
          {(newGroup.studyMode === "in-person" || newGroup.studyMode === "hybrid") && (
            <label className="modalLabel">
              <span>Location</span>
              <input className="modalInput" required placeholder="e.g. COM1 Level 2" value={newGroup.location} onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })} />
            </label>
          )}
          {(newGroup.studyMode === "online" || newGroup.studyMode === "hybrid") && (
            <label className="modalLabel">
              <span>Meeting Link</span>
              <input className="modalInput" required placeholder="e.g. https://teams.microsoft.com/..." value={newGroup.meetingLink} onChange={(e) => setNewGroup({ ...newGroup, meetingLink: e.target.value })} />
            </label>
          )}
          <label className="modalLabel">
            <span>Preferred Schedule *</span>
            <div className="modalRow">
              <input className="modalInput" type="date" required value={newGroup.scheduleDate} onChange={(e) => setNewGroup({ ...newGroup, scheduleDate: e.target.value })} />
              <input className="modalInput" type="time" required value={newGroup.scheduleTime} onChange={(e) => setNewGroup({ ...newGroup, scheduleTime: e.target.value })} />
            </div>
          </label>
          <label className="modalLabel">
            <span>Description</span>
            <textarea className="modalInput modalTextarea" required rows={3} value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
          </label>
          <label className="modalLabel" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={newGroup.approvalRequired} onChange={(e) => setNewGroup({ ...newGroup, approvalRequired: e.target.checked })} />
            <span>Require admin approval for join requests</span>
          </label>
          <div className="modalActions">
            <button type="button" className="modalCancel" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="modalSubmit" disabled={creating}>{creating ? "Creating…" : "Create Group"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

FeedbackPickerModal.propTypes = {
  showFeedbackPicker: PropTypes.bool.isRequired,
  closeFeedbackPicker: PropTypes.func.isRequired,
  selectedFeedbackGroup: PropTypes.object,
  selectedFeedbackGroupId: PropTypes.string.isRequired,
  selectedFeedbackSessionId: PropTypes.string.isRequired,
  setSelectedFeedbackSessionId: PropTypes.func.isRequired,
  handleSelectFeedbackGroup: PropTypes.func.isRequired,
  handleLaunchFeedback: PropTypes.func.isRequired,
  feedbackOptions: PropTypes.array.isRequired,
};
function FeedbackPickerModal({
  showFeedbackPicker,
  closeFeedbackPicker,
  selectedFeedbackGroup,
  selectedFeedbackGroupId,
  selectedFeedbackSessionId,
  setSelectedFeedbackSessionId,
  handleSelectFeedbackGroup,
  handleLaunchFeedback,
  feedbackOptions,
}) {
  if (!showFeedbackPicker) return null;
  return (
    <>
      <button type="button" className="modalOverlay" aria-label="Close feedback picker modal" onClick={closeFeedbackPicker} />
      <dialog open className="modalCard" aria-modal="true" onCancel={(e) => { e.preventDefault(); closeFeedbackPicker(); }}>
        <h2 className="modalTitle">Give Peer Feedback</h2>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>Select the group and session you want to provide feedback for.</p>
        <label className="modalLabel">
          <span>Study Group</span>
          <select className="modalInput" value={selectedFeedbackGroupId} onChange={(e) => handleSelectFeedbackGroup(e.target.value)}>
            {feedbackOptions.map((o) => (
              <option key={o.group.id} value={o.group.id}>{o.group.name}</option>
            ))}
          </select>
        </label>
        {selectedFeedbackGroup && (
          <label className="modalLabel">
            <span>Session</span>
            <select className="modalInput" value={selectedFeedbackSessionId} onChange={(e) => setSelectedFeedbackSessionId(e.target.value)}>
              {selectedFeedbackGroup.sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title || s.startsAt || s.id}</option>
              ))}
            </select>
          </label>
        )}
        <div className="modalActions">
          <button type="button" className="modalCancel" onClick={closeFeedbackPicker}>Cancel</button>
          <button type="button" className="modalSubmit" onClick={handleLaunchFeedback} disabled={!selectedFeedbackGroupId || !selectedFeedbackSessionId}>Next →</button>
        </div>
      </dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Dashboard (shown to logged-in users)
   ═══════════════════════════════════════════════════ */
function DashboardHome() {
  const nav = useNavigate();
  const location = useLocation();
  const { instance, accounts } = useMsal();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(location.state?.avatarUrl ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [membershipActionId, setMembershipActionId] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: "", moduleCode: "", topic: "", studyMode: "online",
    location: "", meetingLink: "", scheduleDate: "", scheduleTime: "", maxMembers: 10,
    description: "", approvalRequired: false,
  });
  const [creating, setCreating] = useState(false);
  const [activeModule, setActiveModule] = useState(location.state?.activeModule || "studyGroups");
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
  const [feedbackApiPath, setFeedbackApiPath] = useState("");
  const [showTutorFeedbacks, setShowTutorFeedbacks] = useState(false);
  const [tutorFeedbackClass, setTutorFeedbackClass] = useState(null);
  const [tutorFeedbackLoading, setTutorFeedbackLoading] = useState(false);
  const [tutorFeedbackError, setTutorFeedbackError] = useState("");
  const [tutorFeedbackItems, setTutorFeedbackItems] = useState([]);
  const [selectedTutorFeedback, setSelectedTutorFeedback] = useState(null);

  function showToast(message, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  /* fetch user name + avatar */
  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        await waitForToken();
        if (cancelled) return;
        const profileData = await fetchFirstAvailableProfile();
        if (cancelled || !profileData) return;
        const profileAvatar = extractAvatarUrl(profileData);
        if (profileAvatar !== null) setAvatarUrl(profileAvatar);
        const displayName = getProfileDisplayName(profileData);
        if (displayName) setProfileName(displayName);
      } catch {
        // Best effort profile enrichment.
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return subscribeProfileUpdated((detail) => {
      if (typeof detail.avatarUrl === "string") setAvatarUrl(detail.avatarUrl);
      if (typeof detail.profileName === "string" && detail.profileName.trim()) {
        setProfileName(detail.profileName.trim());
      }
    });
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

  const filtered = useMemo(() => filterDashboardGroups(groups, search, myGroupsOnly), [groups, search, myGroupsOnly]);

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

  const closeFeedbackPicker = useCallback(() => {
    setShowFeedbackPicker(false);
    setFeedbackOptions([]);
    setSelectedFeedbackGroupId("");
    setSelectedFeedbackSessionId("");
  }, []);

  function openFeedback(session, membersOverride) {
    const members = membersOverride ?? selectedMembers;
    const firstApprovedMember = members.find(
      (m) => m.membershipStatus === "approved" && m.email !== userEmail
    );
    setFeedbackSession(session);
    setFeedbackForm({ ...createFeedbackForm(), revieweeId: firstApprovedMember?.userId || firstApprovedMember?.email || "" });
    setFeedbackStatus({ type: "", message: "" });
    setShowFeedback(true);
  }


  function handleSelectFeedbackGroup(groupId) {
    setSelectedFeedbackGroupId(groupId);
    const opt = feedbackOptions.find((o) => o.group.id === groupId);
    setSelectedFeedbackSessionId(opt?.sessions[0]?.id || "");
  }

  function handleLaunchFeedback() {
    const opt = feedbackOptions.find((o) => o.group.id === selectedFeedbackGroupId);
    const session = opt?.sessions.find((s) => s.id === selectedFeedbackSessionId);
    if (!opt || !session) return;
    setSelectedGroup(opt.group);
    setSelectedMembers(opt.members);
    setFeedbackApiPath(`${API_BASE}/api/tutoring/classes/${opt.group.id}/feedback`);
    closeFeedbackPicker();
    openFeedback(session, opt.members);
  }

  function handleTutoringFeedback(classObj) {
    setFeedbackApiPath(`${API_BASE}/api/tutoring/classes/${classObj.id}/feedback`);
    setFeedbackSession({ id: classObj.id, title: classObj.title });
    setSelectedGroup({ id: classObj.id, name: classObj.title });
    setSelectedMembers([{
      userId: classObj.tutorId || classObj.tutorEmail || "tutor",
      email: classObj.tutorEmail || "",
      firstName: classObj.tutorName?.split(" ")[0] || "Tutor",
      lastName: classObj.tutorName?.split(" ").slice(1).join(" ") || "",
      membershipStatus: "approved",
    }]);
    setFeedbackForm({ ...createFeedbackForm(), revieweeId: classObj.tutorId || classObj.tutorEmail || "tutor" });
    setFeedbackStatus({ type: "", message: "" });
    setShowFeedback(true);
  }

  function closeTutorFeedbacks() {
    setShowTutorFeedbacks(false);
    setTutorFeedbackClass(null);
    setTutorFeedbackLoading(false);
    setTutorFeedbackError("");
    setTutorFeedbackItems([]);
    setSelectedTutorFeedback(null);
  }

  async function handleViewTutorFeedbacks(classObj) {
    setTutorFeedbackClass(classObj);
    setTutorFeedbackLoading(true);
    setTutorFeedbackError("");
    setTutorFeedbackItems([]);
    setSelectedTutorFeedback(null);
    setShowTutorFeedbacks(true);

    try {
      const res = await fetch(`${API_BASE}/api/tutoring/classes/${classObj.id}/feedback`, {
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to load feedbacks (${res.status})`);
      }

      const nextItems = normalizeFeedbackCollection(data).sort(
        (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
      );
      setTutorFeedbackItems(nextItems);
      setSelectedTutorFeedback(nextItems[0] || null);
    } catch (err) {
      setTutorFeedbackError(err.message || "Unable to load feedbacks.");
    } finally {
      setTutorFeedbackLoading(false);
    }
  }

  function closeFeedback() {
    setShowFeedback(false);
    setFeedbackSession(null);
    setFeedbackForm(createFeedbackForm());
    setFeedbackStatus({ type: "", message: "" });
    setFeedbackApiPath("");
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
      reviewerName: userName,
      reviewerEmail: userEmail,
    };
    setFeedbackSubmitting(true);
    setFeedbackStatus({ type: "", message: "" });
    try {
      const endpoint = feedbackApiPath || `${API_BASE}/api/groups/${selectedGroup.id}/sessions/${feedbackSession.id}/feedback`;
      const res = await fetch(endpoint, {
        method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedbackStatus({ type: "warning", message: data?.error || `Submission failed (${res.status})` });
        return;
      }
      setFeedbackStatus({ type: "success", message: "Feedback submitted successfully." });
    } catch (err) {
      setFeedbackStatus({ type: "warning", message: err.message || "Feedback submission failed." });
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
  const accountGivenName = typeof account?.idTokenClaims?.given_name === "string" ? account.idTokenClaims.given_name : "";
  const accountFamilyName = typeof account?.idTokenClaims?.family_name === "string" ? account.idTokenClaims.family_name : "";
  const userName = profileName || account?.name || account?.idTokenClaims?.name ||
    [accountGivenName, accountFamilyName].filter(Boolean).join(" ") || "Student";
  const userEmail = account?.username || "";
  const userInitial = userName.charAt(0).toUpperCase();

  const reviewableMembers = getReviewableMembers(selectedMembers, userEmail);
  const selectedFeedbackGroup = feedbackOptions.find((o) => o.group.id === selectedFeedbackGroupId) || null;

  return (
    <div className="dashPage">
      {/* mobile top bar */}
      <div className="dashTopBar">
        <button className="dashMenuBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><MenuIcon /></button>
        <h1 className="dashTopTitle">Dashboard</h1>
        <div className="dashTopRight">
          <button className="dashTopAvatar" onClick={() => nav("/profile")}>
            <AvatarContent avatarUrl={avatarUrl} userInitial={userInitial} />
          </button>
        </div>
      </div>

      {sidebarOpen && <button type="button" className="dashOverlay" onClick={closeSidebar} aria-label="Close menu" />}

      <aside className={`dashSidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dashUserCard">
          <button
            type="button"
            className="dashUserCardBtn"
            onClick={() => { nav("/profile"); closeSidebar(); }}
            aria-label="Go to profile"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            <div className="dashAvatar">
              <AvatarContent avatarUrl={avatarUrl} userInitial={userInitial} />
            </div>
            <div className="dashUserInfo">
              <h3 className="dashUserName">{userName}</h3>
              <p className="dashUserEmail">{userEmail}</p>
            </div>
          </button>
          <button className="dashCloseBtn" onClick={closeSidebar} aria-label="Close menu"><CloseIcon /></button>
        </div>

        <nav className="dashNav">
          <span className="dashNavLabel">MODULES</span>
          <button className={`dashNavItem ${activeModule === "studyGroups" ? "active" : ""}`} onClick={() => { setActiveModule("studyGroups"); closeSidebar(); }}><GroupsIcon /> Study Groups</button>
          <button className={`dashNavItem ${activeModule === "peerTutoring" ? "active" : ""}`} onClick={() => { setActiveModule("peerTutoring"); closeSidebar(); }}><TutoringIcon /> Peer Tutoring</button>
          <button className={`dashNavItem ${activeModule === "restrictedMembers" ? "active" : ""}`} onClick={() => { setActiveModule("restrictedMembers"); closeSidebar(); }}><RestrictIcon /> Restricted Member</button>
          <button className="dashNavItem" disabled><AiIcon /> AI Tutor</button>
          <button className="dashNavItem" disabled><SupportIcon /> Support</button>
        </nav>

        <div className="dashSidebarFooter">
          <button className="dashLogoutBtn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <section className="dashMain">
        {activeModule === "studyGroups" && (
          <StudyGroupsModule
            myGroupsOnly={myGroupsOnly}
            setMyGroupsOnly={setMyGroupsOnly}
            setShowCreate={setShowCreate}
            search={search}
            setSearch={setSearch}
            loading={loading}
            error={error}
            filtered={filtered}
            membershipActionId={membershipActionId}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onOpenGroup={(groupId) => nav(`/group/${groupId}`)}
          />
        )}

        {activeModule === "peerTutoring" && (
          <>
            <div className="dashHeader">
              <div className="dashHeaderTop">
                <div>
                  <h1 className="dashTitle">Peer Tutoring</h1>
                  <p className="dashSubtitle">Connect with tutors or offer your expertise</p>
                </div>
              </div>
            </div>
            <PeerTutoringSection
              onGiveFeedback={handleTutoringFeedback}
              onViewTutorFeedbacks={handleViewTutorFeedbacks}
              showToast={showToast}
              setConfirmDialog={setConfirmDialog}
            />
          </>
        )}
        {activeModule === "restrictedMembers" && <RestrictedMemberSection showToast={showToast} setConfirmDialog={setConfirmDialog} />}
      </section>

      <CreateGroupModal
        showCreate={showCreate}
        setShowCreate={setShowCreate}
        creating={creating}
        newGroup={newGroup}
        setNewGroup={setNewGroup}
        handleCreate={handleCreate}
      />

      <FeedbackPickerModal
        showFeedbackPicker={showFeedbackPicker}
        closeFeedbackPicker={closeFeedbackPicker}
        selectedFeedbackGroup={selectedFeedbackGroup}
        selectedFeedbackGroupId={selectedFeedbackGroupId}
        selectedFeedbackSessionId={selectedFeedbackSessionId}
        setSelectedFeedbackSessionId={setSelectedFeedbackSessionId}
        handleSelectFeedbackGroup={handleSelectFeedbackGroup}
        handleLaunchFeedback={handleLaunchFeedback}
        feedbackOptions={feedbackOptions}
      />

      {showFeedback && (
        <>
          <button type="button" className="modalOverlay" aria-label="Close peer feedback modal" onClick={closeFeedback} />
          <dialog open className="modalCard" aria-modal="true" onCancel={(e) => { e.preventDefault(); closeFeedback(); }}>
            <h2 className="modalTitle">Peer Feedback — {feedbackSession?.title || "Session"}</h2>
            <form className="modalForm" onSubmit={handleSubmitFeedback}>
              <label className="modalLabel">
                <span>Reviewing</span>
                <select className="modalInput" value={feedbackForm.revieweeId} onChange={(e) => setFeedbackForm({ ...feedbackForm, revieweeId: e.target.value })}>
                  <option value="">Select peer</option>
                  {reviewableMembers.map((m) => (
                    <option key={m.userId || m.email} value={m.userId || m.email}>
                      {getNamePartsLabel(m.firstName, m.lastName, m.email || m.userId || "Unknown")}
                    </option>
                  ))}
                </select>
              </label>
              {[
                { key: "overallRating", label: "Overall Rating" },
                { key: "preparedness", label: "Preparedness" },
                { key: "communication", label: "Communication" },
                { key: "helpfulness", label: "Helpfulness" },
                { key: "reliability", label: "Reliability" },
              ].map(({ key, label }) => (
                <label key={key} className="modalLabel">{label}
                  <StarRating label={label} value={feedbackForm[key]} onChange={(v) => setFeedbackForm({ ...feedbackForm, [key]: v })} />
                </label>
              ))}
              <label className="modalLabel">
                <span>Strengths</span>
                <textarea className="modalInput modalTextarea" rows={2} value={feedbackForm.strengths} onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })} />
              </label>
              <label className="modalLabel">
                <span>Areas for Improvement</span>
                <textarea className="modalInput modalTextarea" rows={2} value={feedbackForm.improvements} onChange={(e) => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })} />
              </label>
              <label className="modalLabel" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={feedbackForm.anonymousToPeer} onChange={(e) => setFeedbackForm({ ...feedbackForm, anonymousToPeer: e.target.checked })} />
                <span>Submit anonymously</span>
              </label>
              {feedbackStatus.message && (
                <p style={{ color: feedbackStatus.type === "success" ? "#16a34a" : "#d97706", fontSize: 14 }}>{feedbackStatus.message}</p>
              )}
              <div className="modalActions">
                <button type="button" className="modalCancel" onClick={closeFeedback}>Cancel</button>
                <button type="submit" className="modalSubmit" disabled={feedbackSubmitting || !feedbackForm.revieweeId || !feedbackForm.overallRating}>
                  {feedbackSubmitting ? "Submitting…" : "Submit Feedback"}
                </button>
              </div>
            </form>
          </dialog>
        </>
      )}

      {showTutorFeedbacks && (
        <>
          <button type="button" className="modalOverlay" aria-label="Close submitted feedback modal" onClick={closeTutorFeedbacks} />
          <dialog open className="modalCard tutorFeedbackModal" aria-modal="true" onCancel={(e) => { e.preventDefault(); closeTutorFeedbacks(); }}>
            <h2 className="modalTitle">Submitted Feedbacks{tutorFeedbackClass?.title ? ` - ${tutorFeedbackClass.title}` : ""}</h2>
            <p className="tutorFeedbackIntro">
              Select a student name to view the feedback they submitted for this tutoring class.
            </p>

            {tutorFeedbackLoading && <p className="dashMsg">Loading feedbacksâ€¦</p>}
            {!tutorFeedbackLoading && tutorFeedbackError && <p className="dashMsg dashError">{tutorFeedbackError}</p>}
            {!tutorFeedbackLoading && !tutorFeedbackError && tutorFeedbackItems.length === 0 && (
              <div className="dashEmpty tutorFeedbackEmpty">
                <TutoringIcon />
                <p>No feedbacks have been submitted for this class yet.</p>
              </div>
            )}

            {!tutorFeedbackLoading && tutorFeedbackItems.length > 0 && (
              <div className="tutorFeedbackLayout">
                <ul className="tutorFeedbackList" aria-label="Submitted feedback names">
                  {tutorFeedbackItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`tutorFeedbackListItem ${selectedTutorFeedback?.id === item.id ? "active" : ""}`}
                        onClick={() => setSelectedTutorFeedback(item)}
                      >
                        <span className="tutorFeedbackReviewer">{item.reviewerLabel}</span>
                        <span className="tutorFeedbackMeta">
                          {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Submission time unavailable"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="tutorFeedbackDetail">
                  {selectedTutorFeedback ? (
                    <>
                      <div className="tutorFeedbackDetailHeader">
                        <h3>{selectedTutorFeedback.reviewerLabel}</h3>
                        <p>
                          {selectedTutorFeedback.submittedAt
                            ? `Submitted on ${new Date(selectedTutorFeedback.submittedAt).toLocaleString()}`
                            : "Submission time unavailable"}
                        </p>
                        {selectedTutorFeedback.anonymousToPeer && (
                          <p className="tutorFeedbackAnonNote">This feedback was submitted anonymously.</p>
                        )}
                      </div>

                      <div className="tutorFeedbackRatings">
                        {[
                          { key: "overallRating", label: "Overall Rating" },
                          { key: "preparedness", label: "Preparedness" },
                          { key: "communication", label: "Communication" },
                          { key: "helpfulness", label: "Helpfulness" },
                          { key: "reliability", label: "Reliability" },
                        ].map(({ key, label }) => (
                          <div key={key} className="tutorFeedbackRatingRow">
                            <span>{label}</span>
                            <strong>{selectedTutorFeedback[key] || 0}/5</strong>
                          </div>
                        ))}
                      </div>

                      <div className="tutorFeedbackSection">
                        <h4>About</h4>
                        <p>{selectedTutorFeedback.revieweeLabel}</p>
                      </div>

                      <div className="tutorFeedbackSection">
                        <h4>Strengths</h4>
                        <p>{selectedTutorFeedback.strengths || "No strengths provided."}</p>
                      </div>

                      <div className="tutorFeedbackSection">
                        <h4>Areas for Improvement</h4>
                        <p>{selectedTutorFeedback.improvements || "No improvement notes provided."}</p>
                      </div>
                    </>
                  ) : (
                    <div className="dashEmpty tutorFeedbackEmpty">
                      <p>Select a name from the left to view the full feedback.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="modalActions">
              <button type="button" className="modalCancel" onClick={closeTutorFeedbacks}>Close</button>
            </div>
          </dialog>
        </>
      )}

      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
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
