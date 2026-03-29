import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, validatePasswordCode } from "../utils/auth";
import PasswordCodeForm from "../components/PasswordCodeForm";
import "../styles/pages/Auth.css";

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
          nusStudentId: isEmail ? null : trimmed,
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

    const validationError = validatePasswordCode(code, password, retypePassword);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      const trimmed = identifier.trim();
      const isEmail = trimmed.includes("@");
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isEmail ? trimmed : null,
          nusStudentId: isEmail ? null : trimmed,
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
              <label className="authLabel">
                Email or NUS Student ID
                <input
                  className="authInput"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. johntan@u.nus.edu or A1234567X"
                  autoComplete="username"
                />
              </label>
            </div>

            {error && <div className="authError">{error}</div>}

            <button className="authButton" type="submit" disabled={loading}>
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {/* ── Step 2: code + new password ──────────────────── */}
        {step === 2 && (
          <PasswordCodeForm
            code={code}
            onCodeChange={(e) => setCode(e.target.value)}
            password={password}
            onPasswordChange={(e) => setPassword(e.target.value)}
            retypePassword={retypePassword}
            onRetypeChange={(e) => setRetypePassword(e.target.value)}
            error={error}
            loading={loading}
            submitLabel={loading ? "Resetting…" : "Reset password"}
            onSubmit={onResetPassword}
          >
            <button
              type="button"
              className="authLinkBtn"
              onClick={() => { setStep(1); setError(""); setSuccess(""); }}
            >
              ← Back to enter email
            </button>
          </PasswordCodeForm>
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
