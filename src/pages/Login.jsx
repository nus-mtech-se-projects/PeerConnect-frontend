import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// Shared auth page styles (login + signup)
import "../styles/pages/Auth.css";

const API_BASE = "http://localhost:8080";

export default function Login() {
  const nav = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginBody = useMemo(() => {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes("@");
    return {
      email: isEmail ? trimmed : null,
      nusStudentId: !isEmail ? trimmed : null,
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
      nav("/profile");
    } catch (err) {
      setError(
        err?.message || "Network error. Is Spring Boot running on 8080?"
      );
    } finally {
      setLoading(false);
    }
  }

  // Placeholder-only: wire these up when backend OAuth is ready
  function startOAuth(provider) {
    // Example future:
    // window.location.href = `${API_BASE}/oauth2/authorization/${provider}`;
    console.log("OAuth provider clicked:", provider);
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <h1 className="authTitle">Login</h1>
        <p className="authSubtitle">Welcome back — sign in to PeerConnect</p>

        <div className="socialStack">
          <button
            type="button"
            className="socialBtn"
            onClick={() => startOAuth("google")}
          >
            Continue with Google
          </button>
          <button
            type="button"
            className="socialBtn"
            onClick={() => startOAuth("microsoft")}
          >
            Continue with Microsoft
          </button>
          <button
            type="button"
            className="socialBtn"
            onClick={() => startOAuth("github")}
          >
            Continue with GitHub
          </button>
        </div>

        <div className="divider" aria-hidden="true">
          <span />
          <em>or</em>
          <span />
        </div>

        <form className="authForm" onSubmit={onSubmit}>
          <div className="authField">
            <label className="authLabel">Email or NUS Student ID</label>
            <input
              className="authInput"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. johntan@u.nus.edu or A1234567X"
              autoComplete="username"
            />
          </div>

          <div className="authField">
            <label className="authLabel">Password</label>
            <input
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
            Forgot password? <span className="fakeLink">Click here</span>
          </span>
        </div>
      </div>
    </div>
  );
}
