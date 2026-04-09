import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { getSwaUser } from "./AuthConfig";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";
import GroupDetail from "./pages/GroupDetail";
import WellBeing from "./pages/WellBeing";
import AiTutor from "./pages/AiTutor";
import PrivateRoute from "./components/PrivateRoute"
import PublicRoute from "./components/PublicRoute";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
  const nav = useNavigate();
  const [isAuthChecking, setIsAuthChecking] = useState(() => sessionStorage.getItem("swaLoggingIn") === "true");

  useEffect(() => {
    // Check if existing token is still valid (not expired)
    const existingToken = localStorage.getItem("accessToken");
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        const expiresAt = payload.exp * 1000;
        if (Date.now() < expiresAt - 60000) return; // still valid (1 min buffer)
        localStorage.removeItem("accessToken");
      } catch {
        localStorage.removeItem("accessToken");
      }
    }

    // Check SWA Entra ID auth and exchange with backend
    getSwaUser().then((clientPrincipal) => {
      if (!clientPrincipal) {
        if (sessionStorage.getItem("swaLoggingIn")) sessionStorage.removeItem("swaLoggingIn");
        setIsAuthChecking(false);
        return;
      }

      fetch(`${API_BASE}/api/auth/microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientPrincipal }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.accessToken) {
            localStorage.setItem("accessToken", data.accessToken);
            sessionStorage.removeItem("swaLoggingIn");
            setIsAuthChecking(false);
            nav("/");
          } else {
            sessionStorage.removeItem("swaLoggingIn");
            setIsAuthChecking(false);
          }
        })
        .catch((err) => {
          console.error("Microsoft token exchange failed:", err);
          sessionStorage.removeItem("swaLoggingIn");
          setIsAuthChecking(false);
        });
    });
  }, [nav]);

  if (isAuthChecking) {
    return <div className="appShell"><main className="mainContent" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p className="dashMsg">Authenticating...</p></main></div>;
  }

  return (
    <div className="appShell">
      <Navbar />

      <main className="mainContent">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<About />} />
          <Route path="/wellbeing" element={<WellBeing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <PrivateRoute>
                <ChangePassword />
              </PrivateRoute>
            }
          />
          <Route
            path="/restrict-user"
            element={
              <PrivateRoute>
                <Navigate to="/" replace state={{ activeModule: "restrictedMembers" }} />
              </PrivateRoute>
            }
          />
          <Route
            path="/group/:groupId"
            element={
              <PrivateRoute>
                <GroupDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-tutor"
            element={
              <PrivateRoute>
                <AiTutor />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
