import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE, authHeaders } from "../utils/auth";
import "../styles/pages/GroupDetail.css";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mon}-${yyyy} at ${hh}:${mm}`;
}

async function loadGroupPreview(groupId, setGroup, setMembers, setSessions) {
  const listRes = await fetch(`${API_BASE}/api/groups`, { headers: authHeaders(), credentials: "include" });
  if (!listRes.ok) throw new Error("Unable to load group information");
  const allGroups = await listRes.json();
  const found = Array.isArray(allGroups) ? allGroups.find((g) => String(g.id) === String(groupId)) : null;
  if (!found) throw new Error("Group not found");
  setGroup({ ...found, moduleCode: found.moduleCode || found.courseCode || "" });
  let ownerMembers = Array.isArray(found.members)
    ? found.members.filter((m) => m.role === "owner").map((m) => ({ ...m, email: undefined }))
    : [];
  if (ownerMembers.length === 0 && found.createdBy) {
    const ownerFullName = found.ownerName || found.createdByName || "";
    const nameParts = ownerFullName.split(" ");
    ownerMembers = [{
      userId: found.createdBy,
      firstName: found.ownerFirstName || found.createdByFirstName || nameParts[0] || "",
      lastName: found.ownerLastName || found.createdByLastName || nameParts.slice(1).join(" ") || "",
      role: "owner",
    }];
  }
  setMembers(ownerMembers);
  setSessions(Array.isArray(found.sessions) ? found.sessions : []);
}

function getStudyModeLabel(mode) {
  if (mode === "online") return "Online";
  if (mode === "hybrid") return "Hybrid";
  return "In-Person";
}

function ownerFirstSort(a, b) {
  if (a.role === "owner") return -1;
  if (b.role === "owner") return 1;
  return 0;
}

async function doLoadGroup(groupId, setters) {
  const {
    setLoading, setGroup, setMembers, setSessions, setPreviewOnly,
    setScheduleDate, setScheduleTime, setSessionForm, setTransferOwnerId,
    setInviteEmail, setError,
  } = setters;
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
      headers: authHeaders(), credentials: "include",
    });
    if (res.status === 403 || res.status === 401) {
      await loadGroupPreview(groupId, setGroup, setMembers, setSessions);
      setPreviewOnly(true);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to load group (${res.status})`);
    setGroup({ ...data, moduleCode: data.moduleCode || data.courseCode || "" });
    setMembers(Array.isArray(data.members) ? data.members : []);
    setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    setPreviewOnly(false);
    const ps = typeof data.preferredSchedule === "string" ? data.preferredSchedule : "";
    const parts = ps.split(/[T ]/);
    setScheduleDate(parts[0] || "");
    setScheduleTime(parts[1] ? parts[1].substring(0, 5) : "");
    setSessionForm((prev) => ({ ...prev, location: data.location || "", meetingLink: data.meetingLink || "" }));
    setTransferOwnerId("");
    setInviteEmail("");
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

function showToast(message, type = "success", setToast, toastTimerRef) {
  clearTimeout(toastTimerRef.current);
  setToast({ message, type });
  toastTimerRef.current = setTimeout(() => setToast(null), 3500);
}

async function executeDeleteSession(sessionId, groupId, setToast, toastTimerRef, loadGroup) {
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/sessions/${sessionId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Delete session failed (${res.status})`);
    await loadGroup();
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
}

async function executeRemoveMember(userId, groupId, setSendingEmail, setToast, toastTimerRef, loadGroup) {
  setSendingEmail(true);
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/members/${userId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Remove failed (${res.status})`);
    await loadGroup();
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
  finally { setSendingEmail(false); }
}

async function executeTransferOwnership(groupId, transferOwnerId, setSendingEmail, setToast, toastTimerRef, loadGroup) {
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/transfer-ownership`, {
      method: "POST", headers: authHeaders(), credentials: "include",
      body: JSON.stringify({ newOwnerUserId: transferOwnerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Transfer failed (${res.status})`);
    showToast("Ownership transferred successfully!", "success", setToast, toastTimerRef);
    await loadGroup();
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
}

async function executeDissolveGroup(groupId, setSendingEmail, setToast, toastTimerRef, nav) {
  setSendingEmail(true);
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/dissolve`, {
      method: "POST", headers: authHeaders(), credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Dissolve failed (${res.status})`);
    nav("/");
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
  finally { setSendingEmail(false); }
}

async function executeJoinFromDetail(groupId, setJoiningGroup, setToast, toastTimerRef, loadGroup) {
  setJoiningGroup(true);
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/join`, {
      method: "POST", headers: authHeaders(), credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Join failed (${res.status})`);
    if (data.alreadyJoined) {
      showToast("You have already joined this group.", "error", setToast, toastTimerRef);
    } else {
      showToast("Successfully joined the group!", "success", setToast, toastTimerRef);
    }
    await loadGroup();
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
  finally { setJoiningGroup(false); }
}

async function executeLeaveFromDetail(groupId, setLeavingGroup, setToast, toastTimerRef, loadGroup) {
  setLeavingGroup(true);
  try {
    const res = await fetch(`${API_BASE}/api/groups/${groupId}/leave`, {
      method: "POST", headers: authHeaders(), credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Leave failed (${res.status})`);
    showToast("You have left the group.", "success", setToast, toastTimerRef);
    await loadGroup();
  } catch (err) { showToast(err.message, "error", setToast, toastTimerRef); }
  finally { setLeavingGroup(false); }
}

export default function GroupDetail() {
  const { groupId } = useParams();
  const nav = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [sessionForm, setSessionForm] = useState({
    title: "", startsAtDate: "", startsAtTime: "", endsAtDate: "", endsAtTime: "", location: "", meetingLink: "", notes: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [transferOwnerId, setTransferOwnerId] = useState("");

  const [joiningGroup, setJoiningGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadGroup = useCallback(() => doLoadGroup(groupId, {
    setLoading, setGroup, setMembers, setSessions, setPreviewOnly,
    setScheduleDate, setScheduleTime, setSessionForm, setTransferOwnerId,
    setInviteEmail, setError,
  }), [groupId]);

  useEffect(() => { loadGroup(); }, [loadGroup]);

  const isOwner = group?.isAdmin;

  /* ── Owner actions ── */

  async function handleUpdateGroup(e) {
    e.preventDefault();
    if (!group?.id) return;
    setSendingEmail(true);
    try {
      const payload = {
        name: group.name, moduleCode: group.moduleCode, topic: group.topic,
        description: group.description, studyMode: group.studyMode,
        location: group.location, meetingLink: group.meetingLink,
        preferredSchedule: [scheduleDate, scheduleTime].filter(Boolean).join("T"),
        maxMembers: Number(group.maxMembers),
        approvalRequired: !!group.approvalRequired,
      };
      const res = await fetch(`${API_BASE}/api/groups/${group.id}`, {
        method: "PUT", headers: authHeaders(), credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
      showToast("Group updated successfully!", "success", setToast, toastTimer);
      await loadGroup();
    } catch (err) { showToast(err.message, "error", setToast, toastTimer); }
    finally { setSendingEmail(false); }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    if (!group?.id) return;
    setSendingEmail(true);
    try {
      const payload = {
        title: sessionForm.title,
        startsAt: [sessionForm.startsAtDate, sessionForm.startsAtTime].filter(Boolean).join("T"),
        endsAt: sessionForm.endsAtDate ? [sessionForm.endsAtDate, sessionForm.endsAtTime].filter(Boolean).join("T") : null,
        location: sessionForm.location, meetingLink: sessionForm.meetingLink, notes: sessionForm.notes,
      };
      const res = await fetch(`${API_BASE}/api/groups/${group.id}/sessions`, {
        method: "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Create session failed (${res.status})`);
      setSessionForm({ ...sessionForm, title: "", startsAtDate: "", startsAtTime: "", endsAtDate: "", endsAtTime: "", notes: "" });
      showToast("Session created! Notifying members by email\u2026", "success", setToast, toastTimer);
      await loadGroup();
    } catch (err) { showToast(err.message, "error", setToast, toastTimer); }
    finally { setSendingEmail(false); }
  }

  function handleDeleteSession(sessionId) {
    if (!group?.id) return;
    setConfirmDialog({
      message: "Are you sure you want to delete this session?",
      confirmBtnClass: "confirmBtnRed", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Delete", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeDeleteSession(sessionId, group.id, setToast, toastTimer, loadGroup); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!group?.id || !inviteEmail.trim()) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups/${group.id}/members/invite`, {
        method: "POST", headers: authHeaders(), credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Invite failed (${res.status})`);

      setInviteEmail("");
      showToast("Invitation sent successfully!", "success", setToast, toastTimer);
      await loadGroup();
    } catch (err) { showToast(err.message, "error", setToast, toastTimer); }
    finally { setSendingEmail(false); }
  }

  async function handleApproveMember(userId) {
    if (!group?.id) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups/${group.id}/members/${userId}/approve`, {
        method: "POST", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Approve failed (${res.status})`);
      await loadGroup();
    } catch (err) { showToast(err.message, "error", setToast, toastTimer); }
    finally { setSendingEmail(false); }
  }

  function handleRemoveMember(userId) {
    if (!group?.id) return;
    setConfirmDialog({
      message: "Are you sure you want to reject this member from the group?",
      confirmBtnClass: "confirmBtnRed", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Reject", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeRemoveMember(userId, group.id, setSendingEmail, setToast, toastTimer, loadGroup); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  function handleTransferOwnership() {
    if (!group?.id || !transferOwnerId) return;
    setConfirmDialog({
      message: "Transfer ownership to selected member?",
      confirmBtnClass: "confirmBtnGreen", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Transfer", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeTransferOwnership(group.id, transferOwnerId, setSendingEmail, setToast, toastTimer, loadGroup); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  function handleDissolveGroup() {
    if (!group?.id) return;
    setConfirmDialog({
      message: "Are you sure you want to dissolve this group? This action will set the group status to dissolved and cannot be undone.",
      confirmBtnClass: "confirmBtnRed", cancelBtnClass: "confirmBtnOutline",
      confirmLabel: "Dissolve", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeDissolveGroup(group.id, setSendingEmail, setToast, toastTimer, nav); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  /* ── Join from detail page ── */

  function handleJoinFromDetail() {
    if (!group?.id) return;
    setConfirmDialog({
      message: "Are you sure you want to join this group?",
      confirmBtnClass: "gdSubmitBtn", cancelBtnClass: "gdCancelBtn",
      confirmLabel: "Join", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeJoinFromDetail(group.id, setJoiningGroup, setToast, toastTimer, loadGroup); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  /* ── Leave from detail page ── */

  function handleLeaveFromDetail() {
    if (!group?.id) return;
    setConfirmDialog({
      message: "Are you sure you want to leave this group?",
      confirmBtnClass: "gdLeaveBtn", cancelBtnClass: "gdCancelBtn",
      confirmLabel: "Leave", cancelLabel: "Cancel",
      onConfirm: () => { setConfirmDialog(null); executeLeaveFromDetail(group.id, setLeavingGroup, setToast, toastTimer, loadGroup); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  /* ── Render ── */

  if (loading) return <div className="gdPage"><p className="gdMsg">Loading group details…</p></div>;
  if (error) return <div className="gdPage"><p className="gdMsg gdError">{error}</p><button className="gdBackBtn" onClick={() => nav("/")}>← Back to Dashboard</button></div>;
  if (!group) return null;

  return (
    <div className="gdPage">
      {sendingEmail && (
        <div className="gdProgressBar">
          <div className="gdProgressBarFill" />
        </div>
      )}
      <button className="gdBackBtn" onClick={() => nav("/")}>← Back to Dashboard</button>

      <div className="gdCard">
        <div className="gdHeader">
          <h1 className="gdTitle">{group.name}</h1>
          <span className={`gdMode ${group.studyMode}`}>
            {getStudyModeLabel(group.studyMode)}
          </span>
        </div>

        {isOwner && !previewOnly ? (
          /* ════════ OWNER: EDITABLE VIEW ════════ */
          <>
            <div className="gdSection">
              <h2 className="gdSectionTitle">Group Details</h2>
              <form className="gdForm" onSubmit={handleUpdateGroup}>
                <label className="gdLabel">Group Name *
                  <input className="gdInput" required value={group.name || ""} onChange={(e) => setGroup({ ...group, name: e.target.value })} />
                </label>
                <div className="gdRow">
                  <label className="gdLabel">Module / Subject *
                    <input className="gdInput" required value={group.moduleCode || ""} onChange={(e) => setGroup({ ...group, moduleCode: e.target.value })} />
                  </label>
                  <label className="gdLabel">Topic
                    <input className="gdInput" value={group.topic || ""} onChange={(e) => setGroup({ ...group, topic: e.target.value })} />
                  </label>
                </div>
                <div className="gdRow">
                  <label className="gdLabel">Study Mode
                    <select className="gdInput" value={group.studyMode || "online"} onChange={(e) => setGroup({ ...group, studyMode: e.target.value })}>
                      <option value="online">Online</option>
                      <option value="in-person">In-Person</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  <label className="gdLabel">Max Members
                    <input className="gdInput" type="number" min={2} max={100} value={group.maxMembers || 10} onChange={(e) => setGroup({ ...group, maxMembers: Number(e.target.value) })} />
                  </label>
                </div>
                <label className="gdLabel">Location
                  <input className="gdInput" value={group.location || ""} onChange={(e) => setGroup({ ...group, location: e.target.value })} />
                </label>
                <label className="gdLabel">Meeting Link
                  <input className="gdInput" value={group.meetingLink || ""} onChange={(e) => setGroup({ ...group, meetingLink: e.target.value })} />
                </label>
                <label className="gdLabel">Preferred Schedule *
                  <div className="gdRow">
                    <input className="gdInput" type="date" required min={new Date().toISOString().split("T")[0]} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                    <input className="gdInput" type="time" required value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                </label>
                <label className="gdLabel">Description *
                  <textarea className="gdInput gdTextarea" required rows={3} value={group.description || ""} onChange={(e) => setGroup({ ...group, description: e.target.value })} />
                </label>
                <label className="gdLabel" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={!!group.approvalRequired} onChange={(e) => setGroup({ ...group, approvalRequired: e.target.checked })} />
                  Require admin approval for join requests
                </label>
                <div className="gdActions">
                  <button type="submit" className="gdSubmitBtn" disabled={sendingEmail}>
                    {sendingEmail ? "Saving…" : "Save Group"}
                  </button>
                </div>
              </form>
            </div>

            <div className="gdDivider"><span className="gdDividerLabel">Members</span></div>

            <div className="gdSection">
              <h2 className="gdSectionTitle">Members</h2>
              <form className="gdRow" onSubmit={handleInviteMember}>
                <label className="gdLabel" style={{ flex: 1 }}>Invite by email
                  <input className="gdInput" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="student@u.nus.edu" />
                </label>
                <div className="gdActions" style={{ alignSelf: "end" }}>
                  <button type="submit" className="gdSubmitBtn">Invite</button>
                </div>
              </form>

              {members.length > 0 && (
                <div className="gdTableWrap">
                  <table className="gdTable">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...members].sort(ownerFirstSort).map((m) => (
                        <tr key={`${m.userId}-${m.role}`}>
                          <td>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.userId}</td>
                          <td><span className={`gdRoleBadge gdRole-${m.role}`}>{m.role}</span></td>
                          <td>{m.role !== "owner" ? <span className={`gdStatusBadge gdStatus-${m.membershipStatus}`}>{m.membershipStatus}</span> : "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {(m.membershipStatus === "pending" || m.membershipStatus === "invited") && (
                                <button className="memberApproveBtn" onClick={() => handleApproveMember(m.userId)}>Approve</button>
                              )}
                              {group.createdBy !== m.userId && (
                                <button className="memberRejectBtn" onClick={() => handleRemoveMember(m.userId)}>Reject</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="gdRow" style={{ marginTop: 12 }}>
                <label className="gdLabel" style={{ flex: 1 }}>Transfer Ownership
                  <select className="gdInput" value={transferOwnerId} onChange={(e) => setTransferOwnerId(e.target.value)}>
                    <option value="">Select approved member</option>
                    {members
                      .filter((m) => m.membershipStatus === "approved" && m.userId !== group.createdBy)
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.userId}</option>
                      ))}
                  </select>
                </label>
                <div className="gdActions" style={{ alignSelf: "end" }}>
                  <button className="gdSubmitBtn" onClick={handleTransferOwnership} type="button">Transfer</button>
                </div>
              </div>
            </div>

            <div className="gdDivider"><span className="gdDividerLabel">Session Schedule</span></div>

            <div className="gdSection">
              <h2 className="gdSectionTitle">Scheduled Sessions</h2>
              <form className="gdForm" onSubmit={handleCreateSession}>
                <label className="gdLabel">Session Title *
                  <input className="gdInput" required value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} />
                </label>
                <label className="gdLabel">Starts At *
                  <div className="gdRow">
                    <input className="gdInput" type="date" required min={new Date().toISOString().split("T")[0]} value={sessionForm.startsAtDate} onChange={(e) => setSessionForm({ ...sessionForm, startsAtDate: e.target.value })} />
                    <input className="gdInput" type="time" required value={sessionForm.startsAtTime} onChange={(e) => setSessionForm({ ...sessionForm, startsAtTime: e.target.value })} />
                  </div>
                </label>
                <label className="gdLabel">Ends At
                  <div className="gdRow">
                    <input className="gdInput" type="date" min={new Date().toISOString().split("T")[0]} value={sessionForm.endsAtDate} onChange={(e) => setSessionForm({ ...sessionForm, endsAtDate: e.target.value })} />
                    <input className="gdInput" type="time" value={sessionForm.endsAtTime} onChange={(e) => setSessionForm({ ...sessionForm, endsAtTime: e.target.value })} />
                  </div>
                </label>
                <div className="gdRow">
                  <label className="gdLabel">Location
                    <input className="gdInput" value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} />
                  </label>
                  <label className="gdLabel">Meeting Link
                    <input className="gdInput" value={sessionForm.meetingLink} onChange={(e) => setSessionForm({ ...sessionForm, meetingLink: e.target.value })} />
                  </label>
                </div>
                <label className="gdLabel">Notes
                  <textarea className="gdInput gdTextarea" rows={2} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} />
                </label>
                <div className="gdActions">
                  <button type="submit" className="gdSubmitBtn" disabled={sendingEmail}>
                    {sendingEmail ? "Creating Session…" : "Create Session"}
                  </button>
                </div>
              </form>

              {sessions.length > 0 && (
                <div className="gdTableWrap">
                  <table className="gdTable">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Starts At</th>
                        <th>Ends At</th>
                        <th>Location / Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td>{s.title}</td>
                          <td>{formatDateTime(s.startsAt)}</td>
                          <td>{s.endsAt ? formatDateTime(s.endsAt) : "—"}</td>
                          <td>{s.location || s.meetingLink || "—"}</td>
                          <td><button className="memberRejectBtn" onClick={() => handleDeleteSession(s.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="gdFooterActions">
              <button type="button" className="gdBackBtn" onClick={() => nav("/")}>← Back to Dashboard</button>
              <button type="button" className="gdDissolveBtn" onClick={handleDissolveGroup}>Dissolve Group</button>
            </div>
          </>
        ) : (
          /* ════════ STUDENT: READ-ONLY VIEW ════════ */
          <>
            <div className="gdSection">
              <h2 className="gdSectionTitle">Group Details</h2>
              <div className="gdInfoGrid">
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Module / Subject</span>
                  <span className="gdInfoValue">{group.moduleCode || "—"}</span>
                </div>
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Topic</span>
                  <span className="gdInfoValue">{group.topic || "—"}</span>
                </div>
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Study Mode</span>
                  <span className="gdInfoValue">{getStudyModeLabel(group.studyMode)}</span>
                </div>
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Max Members</span>
                  <span className="gdInfoValue">{group.maxMembers ?? "—"}</span>
                </div>
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Location</span>
                  <span className="gdInfoValue">{group.location || "—"}</span>
                </div>
                <div className="gdInfoItem">
                  <span className="gdInfoLabel">Meeting Link</span>
                  <span className="gdInfoValue">{group.meetingLink ? <a href={group.meetingLink} target="_blank" rel="noopener noreferrer">{group.meetingLink}</a> : "—"}</span>
                </div>
                <div className="gdInfoItem gdInfoFull">
                  <span className="gdInfoLabel">Preferred Schedule</span>
                  <span className="gdInfoValue">{group.preferredSchedule ? formatDateTime(group.preferredSchedule) : "—"}</span>
                </div>
                <div className="gdInfoItem gdInfoFull">
                  <span className="gdInfoLabel">Description</span>
                  <span className="gdInfoValue">{group.description || "—"}</span>
                </div>
                {group.status && (
                  <div className="gdInfoItem">
                    <span className="gdInfoLabel">Status</span>
                    <span className="gdInfoValue">{group.status}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="gdSection">
              <h2 className="gdSectionTitle">{previewOnly ? "Owner" : "Members"}</h2>
              <div className="gdMemberList">
                {(previewOnly ? members.filter((m) => m.role === "owner") : [...members].sort(ownerFirstSort)).map((m) => (
                  <div key={`${m.userId}-${m.role}`} className="gdMemberRow">
                    <div>
                      <strong>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.userId}</strong>
                      <div className="gdMemberMeta">{m.role}{m.role !== "owner" ? ` · ${m.membershipStatus}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gdSection">
              <h2 className="gdSectionTitle">Scheduled Sessions</h2>
              {sessions.length === 0 && <p className="gdMemberMeta">No sessions scheduled yet.</p>}
              <div className="gdSessionList">
                {sessions.map((s) => (
                  <div key={s.id} className="gdSessionRow">
                    <div>
                      <strong>{s.title}</strong>
                      <div className="gdSessionMeta">{formatDateTime(s.startsAt)}{s.endsAt ? ` till ${formatDateTime(s.endsAt)}` : ""}</div>
                      <div className="gdSessionMeta">{s.location || s.meetingLink || "No location/link"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {previewOnly && group.status !== "dissolved" && group.status !== "full" && (
              <div className="gdSection" style={{ textAlign: "center" }}>
                <button
                  className="gdSubmitBtn"
                  style={{ padding: "12px 40px", fontSize: 15 }}
                  onClick={handleJoinFromDetail}
                  disabled={joiningGroup}
                >
                  {joiningGroup ? "Joining…" : "Join This Group"}
                </button>
              </div>
            )}

            {!previewOnly && !isOwner && (
              <div className="gdSection" style={{ textAlign: "center" }}>
                <button
                  className="gdLeaveBtn"
                  style={{ padding: "12px 40px", fontSize: 15 }}
                  onClick={handleLeaveFromDetail}
                  disabled={leavingGroup}
                >
                  {leavingGroup ? "Leaving…" : "Leave This Group"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {confirmDialog && (
        <div className="modalOverlay" onClick={() => setConfirmDialog(null)} onKeyDown={(e) => { if (e.key === "Escape") setConfirmDialog(null); }} role="presentation">
          <div className="confirmDialog" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="dialog">
            <p className="confirmMsg">{confirmDialog.message}</p>
            <div className="confirmActions">
              <button className={confirmDialog.cancelBtnClass || "gdCancelBtn"} onClick={confirmDialog.onCancel}>{confirmDialog.cancelLabel || "Cancel"}</button>
              <button className={confirmDialog.confirmBtnClass || "gdSubmitBtn"} onClick={confirmDialog.onConfirm}>{confirmDialog.confirmLabel || "Yes"}</button>
            </div>
          </div>
        </div>
      )}

      {sendingEmail && (
        <div className="gdEmailOverlay">
          <div className="gdEmailOverlayBox">
            <div className="gdEmailSpinner" />
            <p>Sending notification email…</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`dashToast ${toast.type === "error" ? "dashToastError" : "dashToastSuccess"}`} onClick={() => setToast(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setToast(null); }} role="button" tabIndex={0}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
