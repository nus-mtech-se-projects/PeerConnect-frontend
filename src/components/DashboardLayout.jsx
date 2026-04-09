import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { SWA_LOGOUT_URL } from "../AuthConfig";
import { API_BASE, authHeaders } from "../utils/auth";
import { extractAvatarUrl, subscribeProfileUpdated } from "../utils/profileSync";
import { MenuIcon, CloseIcon, GroupsIcon, TutoringIcon, AiIcon, SupportIcon, RestrictIcon, WellBeingIcon } from "./Icons";
import ConfirmDialog from "./ConfirmDialog";
import Toast from "./Toast";
import "../styles/pages/Dashboard.css";

const NAV_ITEMS = [
  { id: "groups", label: "Study Groups", icon: <GroupsIcon />, path: "/", navState: { activeModule: "studyGroups" } },
  { id: "tutoring", label: "Peer Tutoring", icon: <TutoringIcon />, path: "/", navState: { activeModule: "peerTutoring" } },
  { id: "restrict", label: "Restricted Member", icon: <RestrictIcon />, path: "/", navState: { activeModule: "restrictedMembers" } },
  { id: "ai", label: "AI Tutor", icon: <AiIcon />, disabled: true },
  { id: "support", label: "Support", icon: <SupportIcon />, disabled: true },
  { id: "wellbeing", label: "Well-being", icon: <WellBeingIcon />, path: "/wellbeing" },
];

export function AvatarContent({ avatarUrl, userInitial }) {
  return avatarUrl ? <img src={avatarUrl} alt="Avatar" className="dashAvatarImg" /> : userInitial;
}

AvatarContent.propTypes = {
  avatarUrl: PropTypes.string,
  userInitial: PropTypes.string.isRequired,
};

function SidebarUserCard({ avatarUrl, userInitial, userName, userEmail, onProfileClick, onClose }) {
  return (
    <div className="dashUserCard">
      <button type="button" className="dashUserCardBtn" onClick={onProfileClick} aria-label="Go to profile" style={{ background: "transparent", border: "none" }}>
        <div className="dashAvatar">
          <AvatarContent avatarUrl={avatarUrl} userInitial={userInitial} />
        </div>
        <div className="dashUserInfo">
          <h3 className="dashUserName">{userName}</h3>
          <p className="dashUserEmail">{userEmail}</p>
        </div>
      </button>
      <button className="dashCloseBtn" onClick={onClose} aria-label="Close menu"><CloseIcon /></button>
    </div>
  );
}

SidebarUserCard.propTypes = {
  avatarUrl: PropTypes.string,
  userInitial: PropTypes.string.isRequired,
  userName: PropTypes.string.isRequired,
  userEmail: PropTypes.string,
  onProfileClick: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

function applyProfileData(data, state, setAvatarUrl, setProfileName, setProfileEmail) {
  const avatar = extractAvatarUrl(data);
  if (avatar !== null) {
    setAvatarUrl(avatar);
    state.avatarFound = true;
  }
  if (!state.nameFound) {
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.name || "";
    if (name) { setProfileName(name); state.nameFound = true; }
  }
  if (!state.emailFound && data.email) {
    setProfileEmail(data.email);
    state.emailFound = true;
  }
}

async function fetchProfileData(h, getCancelled, setAvatarUrl, setProfileName, setProfileEmail) {
  const state = { nameFound: false, avatarFound: false, emailFound: false };
  const results = await Promise.allSettled([
    fetch(`${API_BASE}/api/users/me`, { headers: h, credentials: "include" }).then((r) => r.ok ? r.json() : null),
    fetch(`${API_BASE}/api/profile`, { headers: h, credentials: "include" }).then((r) => r.ok ? r.json() : null),
  ]);
  for (const r of results) {
    if (getCancelled()) return;
    const data = r.status === "fulfilled" ? r.value : null;
    if (!data) continue;
    applyProfileData(data, state, setAvatarUrl, setProfileName, setProfileEmail);
    if (state.nameFound && state.avatarFound && state.emailFound) break;
  }
}

export default function DashboardLayout({ activeNav, children }) {
  const nav = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(location.state?.avatarUrl ?? "");
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
    fetchProfileData(authHeaders(), () => cancelled, setAvatarUrl, setProfileName, setProfileEmail).catch(() => {});
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
    window.location.href = `${SWA_LOGOUT_URL}?post_logout_redirect_uri=/`;
  }

  const userName = profileName || "Student";
  const userEmail = profileEmail || "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="dashPage">
      <div className="dashTopBar">
        <button className="dashMenuBtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><MenuIcon /></button>
        <h1 className="dashTopTitle">Dashboard</h1>
        <div className="dashTopRight">
          <button className="dashTopAvatar" onClick={() => nav("/profile")}>
            <AvatarContent avatarUrl={avatarUrl} userInitial={userInitial} />
          </button>
        </div>
      </div>

      {sidebarOpen && <button type="button" className="dashOverlay" onClick={closeSidebar} aria-label="Close sidebar" />}

      <aside className={`dashSidebar ${sidebarOpen ? "open" : ""}`}>
        <SidebarUserCard
          avatarUrl={avatarUrl}
          userInitial={userInitial}
          userName={userName}
          userEmail={userEmail}
          onProfileClick={() => { nav("/profile"); closeSidebar(); }}
          onClose={closeSidebar}
        />

        <nav className="dashNav">
          <span className="dashNavLabel">MODULES</span>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`dashNavItem${item.id === activeNav ? " active" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.id === activeNav) { closeSidebar(); return; }
                if (item.path) { nav(item.path, { state: { ...item.navState, avatarUrl } }); closeSidebar(); }
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

DashboardLayout.propTypes = {
  activeNav: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
};
