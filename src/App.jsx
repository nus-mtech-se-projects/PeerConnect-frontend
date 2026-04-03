import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
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
import PrivateRoute from "./components/PrivateRoute"
import PublicRoute from "./components/PublicRoute";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
  const { instance, accounts } = useMsal();
  const nav = useNavigate();

  useEffect(() => {
    if (accounts.length === 0) return;

    // Check if existing token is still valid (not expired)
    const existingToken = localStorage.getItem("accessToken");
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        const expiresAt = payload.exp * 1000; // convert to ms
        if (Date.now() < expiresAt - 60000) return; // still valid (1 min buffer)
        // Token expired — remove it and continue with exchange
        localStorage.removeItem("accessToken");
      } catch {
        localStorage.removeItem("accessToken");
      }
    }

    instance.acquireTokenSilent({
      scopes: ["User.Read"],
      account: accounts[0],
    }).then((response) => {
      fetch(`${API_BASE}/api/auth/microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.idToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.accessToken) {
            localStorage.setItem("accessToken", data.accessToken);
            nav("/");
          }
        })
        .catch((err) => console.error("Microsoft token exchange failed:", err));
    }).catch((err) => {
      if (err instanceof InteractionRequiredAuthError) {
        instance.acquireTokenRedirect({ scopes: ["User.Read"], account: accounts[0] });
      } else {
        console.error("acquireTokenSilent failed:", err);
      }
    });
  }, [accounts, instance, nav]);

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
