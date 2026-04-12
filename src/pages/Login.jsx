import { useMemo, useState} from "react";
import { Link, useNavigate } from "react-router-dom";
/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
import { useMsal } from "@azure/msal-react";
/* SWA BUILT-IN AUTH — commented out on feature/msal-b2b-auth branch.
   Preserved for reference. See main branch for active SWA implementation. */
// import { SWA_LOGIN_URL } from "../AuthConfig";
import { API_BASE } from "../utils/auth";
// Shared auth page styles (login + signup)
import "../styles/pages/Auth.css";


export default function Login() {
  const navigate = useNavigate();
  /* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
  const { instance } = useMsal();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginBody = useMemo(() => {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes("@");
    const isStudentId = !isEmail;
    return {
      email: isEmail ? trimmed : null,
      nusStudentId: isStudentId ? trimmed : null,
      password,
    };
  }, [identifier, password]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      setError("Please enter your email/NUS Student ID and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginBody),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 401) throw new Error("Invalid credentials.");
        throw new Error(text || `Login failed (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      navigate("/");
    } catch (err) {
      setError(
        err?.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <h1 className="authTitle">Login</h1>
        <p className="authSubtitle">Welcome back — sign in to PeerConnect</p>

        <div className="socialStack">
          {/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */}
          <button
            type="button"
            className="socialBtn"
            onClick={async () => {
              try {
                await instance.loginRedirect({ scopes: ["User.Read"] });
              } catch (err) {
                if (err.errorCode !== "interaction_in_progress") {
                  setError("Microsoft login failed. Please try again.");
                }
              }
            }}
          >
            Continue with Microsoft
          </button>
          {/* SWA BUILT-IN AUTH — commented out on feature/msal-b2b-auth branch.
              Preserved for reference. See main branch for active SWA implementation.
          <button
            type="button"
            className="socialBtn"
            onClick={() => {
              sessionStorage.setItem("swaLoggingIn", "true");
              window.location.href = `${SWA_LOGIN_URL}?post_login_redirect_uri=/`;
            }}
          >
            Continue with Microsoft
          </button>
          */}
        </div>

        <div className="divider" role="separator">
          <span />
          <em>or</em>
          <span />
        </div>

        <form className="authForm" onSubmit={onSubmit}>
          <div className="authField">
            <label className="authLabel" htmlFor="login-identifier">Email or NUS Student ID</label>
            <input
              id="login-identifier"
              className="authInput"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. johntan@u.nus.edu or A1234567X"
              autoComplete="username"
            />
          </div>

          <div className="authField">
            <label className="authLabel" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="authInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="authError">{error}</div> : null}

          <button className="authButton" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <div className="authFooter authFooterRow">
          <span>
            Don&apos;t have an account? <Link to="/signup">Create one</Link>
          </span>
          <span>
            Forgot password? <Link to="/forgot-password">Click here</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
