import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, authHeaders } from "../utils/auth";
import "../styles/pages/Auth.css";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── Shared: send/resend verification code ────────────── */
  async function requestCode() {
    const res = await fetch(`${API_BASE}/api/auth/change-password/request`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Failed to send code (${res.status})`);
    }
  }

  /* ── On mount: immediately send the verification code ── */
  useEffect(() => {
    let cancelled = false;
    requestCode()
      .then(() => { if (!cancelled) setSuccess("A verification code has been sent to your email."); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Failed to send verification code. Please try again."); })
      .finally(() => { if (!cancelled) setSendingCode(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── Resend code ────────────────────────────────────────── */
  async function handleResend() {
    setError("");
    setSuccess("");
    setSendingCode(true);
    try {
      await requestCode();
      setSuccess("A new verification code has been sent to your email.");
    } catch (err) {
      setError(err?.message || "Failed to resend code. Please try again.");
    } finally {
      setSendingCode(false);
    }
  }

  /* ── Submit new password ────────────────────────────────── */
  async function onChangePassword(e) {
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== retypePassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password/confirm`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({
          code: code.trim(),
          newPassword: password,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 400) throw new Error(text || "Invalid or expired code.");
        throw new Error(text || `Password change failed (${res.status})`);
      }

      setSuccess("Password changed successfully! Redirecting to profile…");
      setTimeout(() => navigate("/profile"), 2000);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <h1 className="authTitle">Change password</h1>
        <p className="authSubtitle">
          {sendingCode
            ? "Sending a verification code to your email…"
            : "Enter the code sent to your email and choose a new password."}
        </p>

        {success && <div className="authSuccess">{success}</div>}

        {!sendingCode && (
          <form className="authForm" onSubmit={onChangePassword}>
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
              {loading ? "Changing…" : "Change password"}
            </button>

            <button
              type="button"
              className="authLinkBtn"
              onClick={handleResend}
              disabled={sendingCode}
            >
              Resend verification code
            </button>

            <button
              type="button"
              className="authLinkBtn"
              onClick={() => navigate("/profile")}
            >
              ← Back to Profile
            </button>
          </form>
        )}

        {sendingCode && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <span style={{ fontSize: "24px" }} className="profileDropSpin">⟳</span>
          </div>
        )}
      </div>
    </div>
  );
}
