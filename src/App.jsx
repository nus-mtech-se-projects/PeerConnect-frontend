import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import PrivateRoute from "./components/PrivateRoute"
import PublicRoute from "./components/PublicRoute";

const API_BASE = "http://localhost:8080";
export default function App() {
  const { instance, accounts } = useMsal();
  const nav = useNavigate();

  useEffect(() => {
    if (accounts.length === 0) return;
    if (localStorage.getItem("accessToken")) return; // already logged in, skip

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
            nav("/profile");
          }
        })
        .catch((err) => console.error("Microsoft token exchange failed:", err));
    }).catch((err) => console.error("acquireTokenSilent failed:", err));
  }, [accounts, instance, nav]);

  return (
    <div className="appShell">
      <Navbar />

      <main className="mainContent">
        <Routes>
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/contact" element={<PublicRoute><About /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
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
