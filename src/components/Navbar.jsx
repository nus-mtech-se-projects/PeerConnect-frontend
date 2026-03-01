import React, { useState, useCallback, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import peerconnectIcon from "../assets/images/peerconnect_icon.png";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = !!localStorage.getItem("accessToken");

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header className="navPro">
      <div className="navProInner">
        <button className="brandPro" onClick={() => navigate("/")}>
          <img src={peerconnectIcon} alt="PeerConnect" className="brandProIcon" />
          <div className="brandProText">
            <div className="brandProName">PeerConnect</div>
            <div className="brandProSub">Learn together, faster</div>
          </div>
        </button>

        {/* Hamburger button — visible only on mobile */}
        <button
          className={`navHamburger ${menuOpen ? "open" : ""}`}
          onClick={toggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span className="navHamburgerBar" />
          <span className="navHamburgerBar" />
          <span className="navHamburgerBar" />
        </button>

        {/* Overlay backdrop */}
        {menuOpen && (
          <div className="navOverlay" onClick={() => setMenuOpen(false)} />
        )}

        {/* Links + actions — drawer on mobile, inline on desktop */}
        <div className={`navDrawer ${menuOpen ? "open" : ""}`}>
          <nav className="navProLinks">
            <NavLink className={({ isActive }) => `navLink ${isActive ? "active" : ""}`} to="/">
              Home
            </NavLink>
            <NavLink
              className={({ isActive }) => `navLink ${isActive ? "active" : ""}`}
              to="/contact"
            >
              About / Contact
            </NavLink>
            {isLoggedIn && (
              <NavLink
                className={({ isActive }) => `navLink ${isActive ? "active" : ""}`}
                to="/dashboard"
              >
                Dashboard
              </NavLink>
            )}
          </nav>

          <div className="navProActions">
            {isLoggedIn ? (
              <>
                <NavLink className="btnGhost" to="/profile">
                  Profile
                </NavLink>
                <button
                  className="btnPrimary"
                  onClick={async () => {
                    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";
                    try {
                      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
                    } catch { /* proceed anyway */ }
                    localStorage.removeItem("accessToken");
                    if (accounts.length > 0) {
                      instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: "/" });
                    } else {
                      navigate("/");
                    }
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink className="btnGhost" to="/login">
                  Login
                </NavLink>
                <NavLink className="btnPrimary" to="/signup">
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
