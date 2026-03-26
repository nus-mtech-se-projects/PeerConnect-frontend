import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/pages/Dashboard.css";


export default function RestrictUser() {
  const nav = useNavigate();
  const isLoggedIn = !!localStorage.getItem("accessToken");

  useEffect(() => {
    if (!isLoggedIn) nav("/login");
  }, [isLoggedIn, nav]);

  return (
    <div className="page">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#003D7C", marginBottom: 8 }}>Restricted Member</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Manage members who have participated in your groups or tutoring sessions. Select a member to restrict them from joining your future groups or tutoring sessions.
        </p>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e8e8", padding: 40, textAlign: "center", color: "#9ca3af" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4, marginBottom: 12 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="18" y1="8" x2="23" y2="13" />
            <line x1="23" y1="8" x2="18" y2="13" />
          </svg>
          <p style={{ fontSize: 15, margin: 0 }}>This feature is coming soon.</p>
          <p style={{ fontSize: 13, margin: "8px 0 0", color: "#b0b0b0" }}>
            You will be able to view all members from your groups and tutoring sessions, and restrict specific members from future participation.
          </p>
        </div>
      </div>
    </div>
  );
}
