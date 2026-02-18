import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// Shared auth page styles (login + signup)
import "../styles/pages/Auth.css";

const API_BASE ="http://localhost:8080";

export default function Signup() {
  const nav = useNavigate();

  const [nusStudentId, setNusStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const registerBody = useMemo(
    () => ({
      nusStudentId: nusStudentId.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    }),
    [nusStudentId, firstName, lastName, email, phone, password]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (
      !registerBody.nusStudentId ||
      !registerBody.firstName ||
      !registerBody.lastName ||
      !registerBody.email ||
      !registerBody.phone ||
      !registerBody.password
    ) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(registerBody),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 403)
          throw new Error("Forbidden (403). Check Spring Security config.");
        throw new Error(text || `Register failed (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));
      console.log("Register success:", data);

      nav("/login");
    } catch (err) {
      setError(
        err?.message || "Network error. Is Spring Boot running on 8080?"
      );
    } finally {
      setIsSubmitting(false);
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
      <div className="authCard authCardWide">
        <h1 className="authTitle">Create account</h1>
        <p className="authSubtitle">Sign up to start using PeerConnect</p>

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

        <form className="authFormGrid" onSubmit={onSubmit}>
          <div className="authField">
            <label className="authLabel">NUS Student ID</label>
            <input
              className="authInput"
              value={nusStudentId}
              onChange={(e) => setNusStudentId(e.target.value)}
            />
          </div>

          <div className="authRow2">
            <div className="authField">
              <label className="authLabel">First Name</label>
              <input
                className="authInput"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="authField">
              <label className="authLabel">Last Name</label>
              <input
                className="authInput"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="authField">
            <label className="authLabel">Email</label>
            <input
              className="authInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="authField">
            <label className="authLabel">Phone</label>
            <input
              className="authInput"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="authField">
            <label className="authLabel">Password</label>
            <input
              className="authInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </div>

          {error ? <div className="authError">{error}</div> : null}

          <button className="authButton" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="authFooter authFooterRow">
          <span>
            Already have an account? <Link to="/login">Login</Link>
          </span>
          <span>
            Forgot password? <span className="fakeLink">Click here</span>
          </span>
        </div>
      </div>
    </div>
  );
}
