import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { API_BASE, authHeaders } from "../utils/auth";
import { emitProfileUpdated } from "../utils/profileSync";
import "../styles/pages/Profile.css";
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const FACULTY_MAJORS = {
  "Faculty of Arts and Social Sciences": [
    "Chinese Language", "Chinese Studies", "Communications and New Media",
    "Economics", "English Language", "English Literature", "Geography",
    "Global Studies", "History", "Japanese Studies", "Malay Studies",
    "Philosophy", "Political Science", "Psychology", "Social Work",
    "Sociology", "South Asian Studies", "Southeast Asian Studies",
  ],
  "School of Business": [
    "Business Administration", "Accountancy",
  ],
  "School of Computing": [
    "Computer Science", "Information Systems", "Information Security",
    "Computer Engineering", "Business Analytics",
  ],
  "College of Design and Engineering": [
    "Architecture", "Biomedical Engineering", "Chemical Engineering",
    "Civil Engineering", "Electrical Engineering",
    "Engineering Science", "Environmental Engineering",
    "Industrial and Systems Engineering", "Infrastructure and Project Management",
    "Landscape Architecture", "Materials Science and Engineering",
    "Mechanical Engineering", "Industrial Design",
  ],
  "Faculty of Dentistry": [
    "Dentistry",
  ],
  "Faculty of Law": [
    "Law",
  ],
  "Yong Loo Lin School of Medicine": [
    "Medicine", "Nursing",
  ],
  "Yong Siew Toh Conservatory of Music": [
    "Music",
  ],
  "Faculty of Science": [
    "Chemistry", "Data Science and Analytics", "Food Science and Technology",
    "Life Sciences", "Mathematics", "Pharmaceutical Science", "Pharmacy",
    "Physics", "Quantitative Finance", "Statistics",
  ],
};

const FACULTIES = Object.keys(FACULTY_MAJORS);

export default function Profile() {
  const nav = useNavigate();
  const { accounts } = useMsal();

  const [form, setForm] = useState({
    faculty: "",
    major: "",
    yearOfStudy: "",
    fullTime: true,
    bio: "",
    avatarUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(""); // local preview while uploading
  const fileInputRef = useRef(null);

  /* ── load existing profile ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/profile`, { headers: authHeaders(), credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          localStorage.removeItem("accessToken");
          nav("/login");
          return null;
        }
        if (!r.ok) throw new Error(`Failed to load profile (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setForm({
          faculty: data.faculty || "",
          major: data.major || "",
          yearOfStudy: data.yearOfStudy ?? "",
          fullTime: data.fullTime ?? true,
          bio: data.bio || "",
          avatarUrl: data.avatarUrl || "",
        });
      })
      .catch(() => {
        // profile may not exist yet — that's fine, user fills it in
      })
      .finally(() => setLoading(false));
  }, [nav]);

  /* ── save profile ── */
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({
          faculty: form.faculty.trim() || null,
          major: form.major.trim() || null,
          yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : null,
          fullTime: form.fullTime,
          bio: form.bio.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("accessToken");
        nav("/login");
        return;
      }
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setMessage("Profile saved successfully!");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field) {
    return (e) => {
      const value = e.target.value;
      if (field === "faculty") {
        // Reset major when faculty changes
        setForm((prev) => ({ ...prev, faculty: value, major: "" }));
      } else {
        setForm((prev) => ({ ...prev, [field]: value }));
      }
    };
  }

  const availableMajors = form.faculty ? (FACULTY_MAJORS[form.faculty] || []) : [];

  /* ── avatar file handling ── */
  async function processAvatarFile(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setMessage("Only PNG or JPG files are allowed.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setMessage("File must be smaller than 2 MB.");
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setMessage("");
    setUploading(true);

    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch(`${API_BASE}/api/profile/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      const data = await res.json();
      // Backend returns the stored URL, e.g. { avatarUrl: "https://..." }
      setForm((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
      emitProfileUpdated({ avatarUrl: data.avatarUrl || "" });
      setAvatarPreview("");
    } catch (err) {
      setMessage(err.message);
      setAvatarPreview("");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    processAvatarFile(e.target.files?.[0]);
    e.target.value = ""; // allow re-selecting same file
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    setDragging(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processAvatarFile(e.dataTransfer.files?.[0]);
  }

  async function handleRemoveAvatar() {
    setForm((prev) => ({ ...prev, avatarUrl: "" }));
    setAvatarPreview("");
    emitProfileUpdated({ avatarUrl: "" });

    // Also delete the blob from Azure Storage
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`${API_BASE}/api/profile/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort; profile save will clear the URL anyway
    }
  }

  // Resolved avatar source: local preview (during upload) or saved URL
  const avatarSrc = avatarPreview || form.avatarUrl;
  let dropZoneContent;
  if (uploading) {
    dropZoneContent = (
      <div className="profileDropContent">
        <span className="profileDropIcon profileDropSpin">⟳</span>
        <span className="profileDropText">Uploading…</span>
      </div>
    );
  } else if (avatarSrc) {
    dropZoneContent = (
      <div className="profileDropPreview">
        <img src={avatarSrc} alt="Avatar preview" className="profileDropThumb" />
        <span className="profileDropHint">Click to replace</span>
        <button
          type="button"
          className="profileDropRemove"
          onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
          title="Remove avatar"
        >
          ✕
        </button>
      </div>
    );
  } else {
    dropZoneContent = (
      <div className="profileDropContent">
        <span className="profileDropIcon">⇧</span>
        <span className="profileDropText">Click or drag image here</span>
        <span className="profileDropHint">PNG / JPG — max 2 MB</span>
      </div>
    );
  }

  if (loading) return <div className="profilePage"><p className="profileMsg">Loading profile…</p></div>;

  return (
    <div className="profilePage">
      <div className="profileCard">
        {/* avatar preview */}
        <div className="profileAvatarSection">
          <div className="profileAvatar">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="profileAvatarImg" />
            ) : (
              <span className="profileAvatarLetter">
                {accounts[0]?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <h2 className="profileName">{accounts[0]?.name || "Student"}</h2>
          <p className="profileEmail">{accounts[0]?.username || ""}</p>
        </div>

        <form className="profileForm" onSubmit={handleSave}>
          <div className="profileRow">
            <label className="profileLabel">
              <span>Faculty</span>
              <select
                className="profileInput profileSelect"
                value={form.faculty}
                onChange={handleChange("faculty")}
              >
                <option value="">Select faculty</option>
                {FACULTIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>

            <label className="profileLabel">
              <span>Major</span>
              <select
                className="profileInput profileSelect"
                value={form.major}
                onChange={handleChange("major")}
                disabled={!form.faculty}
              >
                <option value="">{form.faculty ? "Select major" : "Select faculty first"}</option>
                {availableMajors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="profileRow">
            <label className="profileLabel">
              <span>Year of Study</span>
              <select
                className="profileInput"
                value={form.yearOfStudy}
                onChange={handleChange("yearOfStudy")}
              >
                <option value="">Select year</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5+</option>
              </select>
            </label>

            <div className="profileLabel">
              <span>Avatar</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                className="profileFileHidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className={`profileDropZone${dragging ? " profileDropZoneActive" : ""}`}
                onClick={handleAvatarClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {dropZoneContent}
              </button>
            </div>
          </div>

          <div className="profileToggleRow">
            <span className="profileLabel">Full Time</span>
            <div className="profileRadioGroup">
              <label className="profileRadioLabel">
                <input
                  type="radio"
                  name="fullTime"
                  className="profileRadio"
                  checked={form.fullTime === true}
                  onChange={() => setForm((prev) => ({ ...prev, fullTime: true }))}
                />
                <span>Yes</span>
              </label>
              <label className="profileRadioLabel">
                <input
                  type="radio"
                  name="fullTime"
                  className="profileRadio"
                  checked={form.fullTime === false}
                  onChange={() => setForm((prev) => ({ ...prev, fullTime: false }))}
                />
                <span>No</span>
              </label>
            </div>
          </div>

          <label className="profileLabel">
            <span>Bio</span>
            <textarea
              className="profileInput profileTextarea"
              rows={4}
              placeholder="Tell others about yourself…"
              value={form.bio}
              onChange={handleChange("bio")}
            />
          </label>

          {message && (
            <p className={`profileMsg ${message.includes("success") ? "profileSuccess" : "profileError"}`}>
              {message}
            </p>
          )}

          <div className="profileBtnRow">
            <button
              className="profileChangePassBtn"
              type="button"
              disabled={saving}
              onClick={() => nav("/change-password")}
            >
              Change Password
            </button>
            <button className="profileSaveBtn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}