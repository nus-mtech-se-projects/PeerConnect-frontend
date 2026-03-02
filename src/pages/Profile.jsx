import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import "../styles/pages/Profile.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function Profile() {
  const { accounts } = useMsal();

  const [form, setForm] = useState({
    faculty: "",
    major: "",
    yearOfStudy: "",
    bio: "",
    avatarUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /* ── load existing profile ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/profile`, { headers: authHeaders(), credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load profile (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setForm({
          faculty: data.faculty || "",
          major: data.major || "",
          yearOfStudy: data.yearOfStudy ?? "",
          bio: data.bio || "",
          avatarUrl: data.avatarUrl || "",
        });
      })
      .catch(() => {
        // profile may not exist yet — that's fine, user fills it in
      })
      .finally(() => setLoading(false));
  }, []);

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
          bio: form.bio.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setMessage("Profile saved successfully!");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  if (loading) return <div className="profilePage"><p className="profileMsg">Loading profile…</p></div>;

  return (
    <div className="profilePage">
      <div className="profileCard">
        {/* avatar preview */}
        <div className="profileAvatarSection">
          <div className="profileAvatar">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Avatar" className="profileAvatarImg" />
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
              Faculty
              <input
                className="profileInput"
                placeholder="e.g. School of Computing"
                value={form.faculty}
                onChange={handleChange("faculty")}
              />
            </label>

            <label className="profileLabel">
              Major
              <input
                className="profileInput"
                placeholder="e.g. Computer Science"
                value={form.major}
                onChange={handleChange("major")}
              />
            </label>
          </div>

          <div className="profileRow">
            <label className="profileLabel">
              Year of Study
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

            <label className="profileLabel">
              Avatar URL
              <input
                className="profileInput"
                placeholder="https://example.com/avatar.jpg"
                value={form.avatarUrl}
                onChange={handleChange("avatarUrl")}
              />
            </label>
          </div>

          <label className="profileLabel">
            Bio
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

          <button className="profileSaveBtn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}