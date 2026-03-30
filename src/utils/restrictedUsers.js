import { API_BASE, authHeaders } from "./auth";

export function getRuMemberInitials(user) {
  if (!user) return "?";
  const names = [user.firstName || "", user.lastName || ""].filter(Boolean).join(" ");
  return names.charAt(0).toUpperCase() || "?";
}

export function ruAuthRequestOptions(options = {}) {
  return { headers: authHeaders(), credentials: "include", ...options };
}

export async function ruParseJsonOrEmpty(response) {
  return response.json().catch(() => ({}));
}

export function formatRestrictedUserName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
}

export function createAllowConfirmDialog(userId, setConfirmDialog, executeAllow, showToast) {
  return {
    message: "Are you sure you want to allow this user? They will be able to join your groups again.",
    confirmBtnClass: "confirmBtnGreen",
    cancelBtnClass: "confirmBtnOutline",
    confirmLabel: "Allow",
    cancelLabel: "Cancel",
    onConfirm: () => { setConfirmDialog(null); executeAllow(userId, showToast); },
    onCancel: () => setConfirmDialog(null),
  };
}

export async function executeRestrictionAction({ userId, method, url, fallbackError, successMessage, restrictedValue, showToast, loadRestricted, setSearchResults }) {
  try {
    const res = await fetch(url, ruAuthRequestOptions(method === "POST" ? { method, body: JSON.stringify({ userId }) } : { method }));
    const data = await ruParseJsonOrEmpty(res);
    if (!res.ok) throw new Error(data?.error || `${fallbackError} (${res.status})`);
    showToast(successMessage);
    if (loadRestricted) await loadRestricted();
    if (setSearchResults) {
      setSearchResults((prev) => prev.map((u) => u.userId === userId ? { ...u, restricted: restrictedValue } : u));
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function loadRestrictedUsers(showToast) {
  try {
    const res = await fetch(`${API_BASE}/api/restricted-users`, ruAuthRequestOptions());
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    return await res.json();
  } catch (err) {
    showToast?.(err.message, "error");
    return [];
  }
}
