import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { API_BASE, authHeaders, waitForToken } from "../utils/auth";
import { MenuIcon, CloseIcon, GroupsIcon, TutoringIcon, AiIcon, SupportIcon, RestrictIcon } from "./Icons";
import ConfirmDialog from "./ConfirmDialog";
import Toast from "./Toast";
import "../styles/pages/Dashboard.css";

const NAV_ITEMS = [
  { id: "groups", label: "Study Groups", icon: <GroupsIcon />, path: "/" },
  { id: "tutoring", label: "Peer Tutoring", icon: <TutoringIcon />, disabled: true },
  { id: "restrict", label: "Restricted Member", icon: <RestrictIcon />, path: "/restrict-user" },
  { id: "ai", label: "AI Tutor", icon: <AiIcon />, disabled: true },
  { id: "support", label: "Support", icon: <SupportIcon />, disabled: true },
];

function applyProfileData(data, state, setAvatarUrl, setProfileName) {
  if (data.avatarUrl) { setAvatarUrl(data.avatarUrl); state.avatarFound = true; }
  if (!state.nameFound) {
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.name || "";
    if (name) { setProfileName(name); state.nameFound = true; }
  }
}

async function fetchProfileData(h, getCancelled, setAvatarUrl, setProfileName) {
  const state = { nameFound: false, avatarFound: false };
  for (const url of [`${API_BASE}/api/users/me`, `${API_BASE}/api/profile`]) {
    try {
      const res = await fetch(url, { headers: h, credentials: "include" });
      if (!res.ok) continue;
      const data = await res.json();
      if (getCancelled()) return;
      applyProfileData(data, state, setAvatarUrl, setProfileName);
      if (state.nameFound && state.avatarFound) break;
    } catch { /* try next */ }
  }
}

export default function DashboardLayout({ activeNav, children }) {
  const nav = useNavigate();
  const { instance, accounts } = useMsal();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    waitForToken()
      .then(() => fetchProfileData(authHeaders(), () => cancelled, setAvatarUrl, setProfileName))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  const account = accounts[0];
  const userName = profileName || account?.name || account?.idTokenClaims?.name ||
    [account?.idTokenClaims?.given_name, account?.idTokenClaims?.family_name].filter(Boolean).join(" ") || "Student";
  const userEmail = account?.username || "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="dashPage">
      <div className="dashTopBar">
        <button className="dashMenuBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><MenuIcon /></button>
        <h1 className="dashTopTitle">Dashboard</h1>
        <div className="dashTopRight">
          <button className="dashTopAvatar" onClick={() => nav("/profile")}>
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="dashAvatarImg" /> : userInitial}
          </button>
        </div>
      </div>

      {sidebarOpen && <button type="button" className="dashOverlay" onClick={closeSidebar} aria-label="Close sidebar" />}

      <aside className={`dashSidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dashUserCard">
          <button type="button" className="dashUserCardBtn" onClick={() => { nav("/profile"); closeSidebar(); }} aria-label="Go to profile">
            <div className="dashAvatar">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="dashAvatarImg" /> : userInitial}
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
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`dashNavItem${item.id === activeNav ? " active" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.id === activeNav) { closeSidebar(); return; }
                if (item.path) { nav(item.path); closeSidebar(); }
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="dashSidebarFooter">
          <button className="dashLogoutBtn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {typeof children === "function"
        // eslint-disable-next-line react-hooks/refs
        ? children({ showToast, setConfirmDialog })
        : children}

      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
