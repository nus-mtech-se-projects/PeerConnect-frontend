import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";


const DEFAULT_API_BASE = "http://localhost:8080";

export default function Login() {
  const navigate = useNavigate();

  const API_BASE = useMemo(
    () => import.meta?.env?.VITE_API_BASE_URL || DEFAULT_API_BASE,
    []
  );

  // OAuth (UI + redirect). Adjust the path to match whatever you configure in
  // Spring Security (common default is /oauth2/authorization/{registrationId}).
  const oauthLogin = (provider) => {
    window.location.href = `${API_BASE}/oauth2/authorization/${provider}`;
  };

  const [identifier, setIdentifier] = useState(""); // email or nusStudentId
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEmail = (value) => value.includes("@");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const payload = {
        email: isEmail(identifier) ? identifier : null,
        nusStudentId: !isEmail(identifier) ? identifier : null,
        password,
      };

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || `Login failed (${res.status})`);
        setLoading(false);
        return;
      }

      setSuccess("Login successful.");
      // If you later return JWT from backend, store it here:
      // localStorage.setItem("token", data.token)

      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authContainer">
        <div className="authCard">
          <h1 className="authTitle">Login</h1>
          <p className="authSubtitle">Welcome back — sign in to PeerConnect</p>

          <form className="authForm" onSubmit={onSubmit}>
            <div className="authRow">
              <label>Email or NUS Student ID</label>
              <input
                className="authInput"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. johntan@u.nus.edu or A1234567X"
                autoComplete="username"
                required
              />
            </div>

            <div className="authRow">
              <label>Password</label>
              <input
                className="authInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button className="authButton" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Login"}
            </button>

            {/* OAuth login (UI + redirect) */}
            <div className="authDivider" aria-hidden="true">
              <span>or</span>
            </div>

            <button
              className="authOauthButton"
              type="button"
              onClick={() => oauthLogin("google")}
            >
              Continue with Google
            </button>

            {error ? <div className="authError">{error}</div> : null}
            {success ? <div className="authMessage">{success}</div> : null}

            <div className="authLinks">
              <span className="authHint">Don&apos;t have an account?</span>{" "}
              <Link to="/signup">Create one</Link>
            </div>

            {/* per your request: text + link string, not necessarily clickable */}
            <div className="authHint" style={{ marginTop: 8 }}>
              Forgot password? <span className="fakeLink">/forgot-password</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
