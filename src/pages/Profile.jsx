import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";


const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";


export default function Profile() {
  const nav = useNavigate();
  const { instance, accounts } = useMsal();
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
    if (accounts.length > 0) {
      // Hand over navigation to MSAL so it can clear the Microsoft server session
      instance.logoutRedirect({
        account: accounts[0],         // Crucial: This tells Microsoft WHO is logging out so it can redirect back
        postLogoutRedirectUri: "/",   // Sends them to your unauthenticated home page
      });
    } else {
      // Fallback: If they logged in via standard email/password, just use React Router
      nav("/"); 
    }
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