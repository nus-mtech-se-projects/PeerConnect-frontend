import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
import { useMsal } from "@azure/msal-react";
import { backendTokenRequest } from "./AuthConfig";
/* SWA BUILT-IN AUTH — commented out on feature/msal-b2b-auth branch.
   Preserved for reference. See main branch for active SWA implementation. */
// import { getSwaUser } from "./AuthConfig";
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
  /* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
  const { instance, accounts } = useMsal();

  /* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
  useEffect(() => {
    if (accounts.length === 0) return;
    if (localStorage.getItem("accessToken")) return;

    /* FIXED: was scopes: ["User.Read"] — that acquires a token for Microsoft Graph,
       not for our backend. backendTokenRequest uses api://{clientId}/access_as_user
       so Spring Boot receives a token with the correct audience (aud) claim.
       FIXED: was sending response.idToken — ID tokens are for client-side identity
       only. Spring Boot must receive response.accessToken to validate audience/scope. */
    instance.acquireTokenSilent({
      ...backendTokenRequest,
      account: accounts[0],
    }).then((response) => {
      fetch(`${API_BASE}/api/auth/microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /* FIXED: backend checks for "idToken"/"credential"/"token" keys — "accessToken"
           is not in that list and would return 400. Sending as "token" which the
           backend already accepts as a fallback. The value is the access token (not
           the id token) so Spring Boot receives the correct audience/scope. */
        body: JSON.stringify({ token: response.accessToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.accessToken) {
            localStorage.setItem("accessToken", data.accessToken);
            nav("/");
          }
        })
        .catch((err) => console.error("Microsoft token exchange failed:", err));
    }).catch((err) => console.error("acquireTokenSilent failed:", err));
  }, [accounts, instance, nav]);

  /* SWA BUILT-IN AUTH — commented out on feature/msal-b2b-auth branch.
     Preserved for reference. See main branch for active SWA implementation. */
  /*
  const [authMessage, setAuthMessage] = useState("Authenticating...");
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    const existingToken = localStorage.getItem("accessToken");
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        if (payload.exp * 1000 > Date.now() + 60000) return false;
      } catch { }
      localStorage.removeItem("accessToken");
    }
    return sessionStorage.getItem("swaLoggingIn") === "true";
  });

  useEffect(() => {
    if (!isAuthChecking) return;
    let cancelled = false;
    const authenticateWithRetry = async () => {
      try {
        const clientPrincipal = await getSwaUser();
        if (!clientPrincipal) {
          if (!cancelled) { sessionStorage.removeItem("swaLoggingIn"); setIsAuthChecking(false); }
          return;
        }
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
              if (data.accessToken) { localStorage.setItem("accessToken", data.accessToken); tokenExchanged = true; break; }
            } else if (res.status >= 400 && res.status < 500) { break; }
          } catch {
            console.warn(`Backend waking up... attempt ${attempt} failed.`);
            setAuthMessage(`Connecting securely... (attempt ${attempt} of 10)`);
          }
          if (attempt < 10) await new Promise(resolve => setTimeout(resolve, 3000));
        }
        if (!tokenExchanged) console.error("Microsoft token exchange failed after multiple retries.");
      } catch (err) {
        console.error("Microsoft SWA authentication check failed:", err);
      } finally {
        if (!cancelled) { sessionStorage.removeItem("swaLoggingIn"); setIsAuthChecking(false); nav("/"); }
      }
    };
    authenticateWithRetry();
    return () => { cancelled = true; };
  }, [isAuthChecking, nav]);

  if (isAuthChecking) {
    return <div className="appShell"><main className="mainContent" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p className="dashMsg">{authMessage}</p></main></div>;
  }
  */

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
