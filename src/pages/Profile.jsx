import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function Profile() {
  const nav = useNavigate();

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // proceed with client-side logout even if request fails
    }

    localStorage.removeItem("accessToken");
    nav("/login");
  }

  return (
    <div style={{ padding: "48px 24px" }}>
      <p>Authenticated page</p>
      <button
        type="button"
        onClick={handleLogout}
        style={{
          marginTop: "16px",
          padding: "10px 24px",
          borderRadius: "10px",
          border: "none",
          background: "#f97316",
          color: "#fff",
          fontWeight: 700,
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}