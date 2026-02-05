import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="navPro">
      <div className="navProInner">
        <button className="brandPro" onClick={() => navigate("/")}>
          <div className="brandProText">
            <div className="brandProName">PeerConnect</div>
            <div className="brandProSub">Learn together, faster</div>
          </div>
        </button>

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
        </nav>

        <div className="navProActions">
          <NavLink className="btnGhost" to="/login">
            Login
          </NavLink>
          <NavLink className="btnPrimary" to="/signup">
            Sign up
          </NavLink>
        </div>
      </div>
    </header>
  );
}
