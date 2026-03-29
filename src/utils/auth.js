const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export { API_BASE };

export function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Validates the code+password+retypePassword fields shared by
 * ChangePassword and ForgotPassword.
 * Returns an error string, or null when inputs are valid.
 */
export function validatePasswordCode(code, password, retypePassword) {
  if (!code.trim()) return "Please enter the verification code.";
  if (!password) return "Please enter a new password.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password !== retypePassword) return "Passwords do not match.";
  return null;
}

export function waitForToken(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 > Date.now()) { resolve(token); return; }
        } catch { /* malformed */ }
      }
      if (Date.now() - start > timeoutMs) { reject(new Error("Token timeout")); return; }
      setTimeout(check, 300);
    })();
  });
}
