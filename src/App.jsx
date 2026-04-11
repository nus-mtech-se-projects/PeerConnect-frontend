import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { getSwaUser } from "./AuthConfig";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PrivateRoute from "./components/PrivateRoute"
import PublicRoute from "./components/PublicRoute";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Profile = lazy(() => import("./pages/Profile"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const WellBeing = lazy(() => import("./pages/WellBeing"));
const AiTutor = lazy(() => import("./pages/AiTutor"));

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
  const nav = useNavigate();
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    // If we have a valid token, no need to check SWA auth
    const existingToken = localStorage.getItem("accessToken");
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        if (payload.exp * 1000 > Date.now() + 60000) return false;
      } catch { /* fall through */ }
      localStorage.removeItem("accessToken");
    }
    // Only show loading state if we're returning from SWA login redirect
    return sessionStorage.getItem("swaLoggingIn") === "true";
  });

  useEffect(() => {
    // Skip SWA check if not returning from a login redirect
    if (!isAuthChecking) return;

    let cancelled = false;

    const authenticateWithRetry = async () => {
      try {
        // 1. Get the SWA user (Microsoft Entra ID)
        const clientPrincipal = await getSwaUser();
        
        if (!clientPrincipal) {
          if (!cancelled) {
            sessionStorage.removeItem("swaLoggingIn");
            setIsAuthChecking(false);
          }
          return;
        }

        // 2. Retry logic for Backend Cold Start
        // If the backend hasn't been used for a while, it takes time to wake up.
        // We will retry the token exchange up to 10 times (30 seconds total) to guarantee a successful login.
        let tokenExchanged = false;
        for (let attempt = 1; attempt <= 10; attempt++) {
          if (cancelled) return;
          try {
            const res = await fetch(`${API_BASE}/api/auth/microsoft`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientPrincipal }),
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.accessToken) {
                localStorage.setItem("accessToken", data.accessToken);
                tokenExchanged = true;
                break; // Success! Exit the retry loop.
              }
            } else if (res.status >= 400 && res.status < 500) {
              // Client error (e.g. 401 unauthorized), no point in retrying.
              break;
            }
          } catch (err) {
            console.warn(`Backend waking up... attempt ${attempt} failed.`);
          }
          
          // Wait 3 seconds before the next retry
          if (attempt < 10) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        if (!tokenExchanged) {
          console.error("Microsoft token exchange failed after multiple retries.");
        }
      } catch (err) {
        // This catches any errors from getSwaUser() failing or timing out
        console.error("Microsoft SWA authentication check failed:", err);
      } finally {
        if (!cancelled) {
          // Guarantee we exit the loading screen and proceed to the app
          sessionStorage.removeItem("swaLoggingIn");
          setIsAuthChecking(false);
          nav("/");
        }
      }
    };

    authenticateWithRetry();

    return () => {
      cancelled = true;
    };
  }, [isAuthChecking, nav]);

  if (isAuthChecking) {
    return <div className="appShell"><main className="mainContent" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p className="dashMsg">Authenticating...</p></main></div>;
  }

  return (
    <div className="appShell">
      <Navbar />

      <main className="mainContent">
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><p className="dashMsg">Loading module...</p></div>}>
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
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
