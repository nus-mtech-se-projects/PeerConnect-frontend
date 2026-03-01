import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/pages/Auth.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Step 1 = enter identifier, Step 2 = enter code + new password
  const [step, setStep] = useState(1);

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── Step 1: Request reset code ─────────────────────────── */
  async function onRequestCode(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Please enter your email or NUS Student ID.");
      return;
    }

    setLoading(true);
    try {
      const isEmail = trimmed.includes("@");
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isEmail ? trimmed : null,
          nusStudentId: !isEmail ? trimmed : null,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      setSuccess("A verification code has been sent to your registered email.");
      setStep(2);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: Reset password with code ───────────────────── */
  async function onResetPassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!code.trim()) {
      setError("Please enter the verification code.");
      return;
    }
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password !== retypePassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const trimmed = identifier.trim();
      const isEmail = trimmed.includes("@");
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isEmail ? trimmed : null,
          nusStudentId: !isEmail ? trimmed : null,
          code: code.trim(),
          newPassword: password,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 400) throw new Error(text || "Invalid or expired code.");
        throw new Error(text || `Reset failed (${res.status})`);
      }

      setSuccess("Password reset successfully! Redirecting to login…");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <h1 className="authTitle">Reset password</h1>
        <p className="authSubtitle">
          {step === 1
            ? "Enter your email or NUS Student ID and we'll send a verification code."
            : "Enter the code sent to your email and choose a new password."}
        </p>

        {success && <div className="authSuccess">{success}</div>}

        {/* ── Step 1: identifier ───────────────────────────── */}
        {step === 1 && (
          <form className="authForm" onSubmit={onRequestCode}>
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

            {error && <div className="authError">{error}</div>}

            <button className="authButton" type="submit" disabled={loading}>
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {/* ── Step 2: code + new password ──────────────────── */}
        {step === 2 && (
          <form className="authForm" onSubmit={onResetPassword}>
            <div className="authField">
              <label className="authLabel">Verification code</label>
              <input
                className="authInput"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
              />
            </div>

            <div className="authField">
              <label className="authLabel">New password</label>
              <input
                className="authInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>

            <div className="authField">
              <label className="authLabel">Retype password</label>
              <input
                className="authInput"
                value={retypePassword}
                onChange={(e) => setRetypePassword(e.target.value)}
                type="password"
                placeholder="Retype new password"
                autoComplete="new-password"
              />
            </div>

            {error && <div className="authError">{error}</div>}

            <button className="authButton" type="submit" disabled={loading}>
              {loading ? "Resetting…" : "Reset password"}
            </button>

            <button
              type="button"
              className="authLinkBtn"
              onClick={() => { setStep(1); setError(""); setSuccess(""); }}
            >
              ← Back to enter email
            </button>
          </form>
        )}

        <div className="authFooter authFooterRow">
          <span>
            Remember your password? <Link to="/login">Login</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
