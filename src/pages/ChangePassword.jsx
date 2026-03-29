import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, authHeaders, validatePasswordCode } from "../utils/auth";
import PasswordCodeForm from "../components/PasswordCodeForm";
import "../styles/pages/Auth.css";

async function requestPasswordChangeCode() {
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

export default function ChangePassword() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── On mount: immediately send the verification code ── */
  useEffect(() => {
    let cancelled = false;
    requestPasswordChangeCode()
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
      await requestPasswordChangeCode();
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

    const validationError = validatePasswordCode(code, password, retypePassword);
    if (validationError) { setError(validationError); return; }

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
          <PasswordCodeForm
            code={code}
            onCodeChange={(e) => setCode(e.target.value)}
            password={password}
            onPasswordChange={(e) => setPassword(e.target.value)}
            retypePassword={retypePassword}
            onRetypeChange={(e) => setRetypePassword(e.target.value)}
            error={error}
            loading={loading}
            submitLabel={loading ? "Changing…" : "Change password"}
            onSubmit={onChangePassword}
          >
            <button type="button" className="authLinkBtn" onClick={handleResend} disabled={sendingCode}>
              Resend verification code
            </button>
            <button type="button" className="authLinkBtn" onClick={() => navigate("/profile")}>
              ← Back to Profile
            </button>
          </PasswordCodeForm>
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
