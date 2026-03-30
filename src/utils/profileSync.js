export const PROFILE_UPDATED_EVENT = "peerconnect:profile-updated";

const AVATAR_PATHS = [
  ["avatarUrl"],
  ["avatar"],
  ["avatarURL"],
  ["profileImageUrl"],
  ["profilePictureUrl"],
  ["profile", "avatarUrl"],
  ["profile", "avatar"],
  ["user", "avatarUrl"],
  ["user", "avatar"],
  ["imageUrl"],
  ["image"],
];

function readPath(obj, path) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
}

function normalizeAvatarValue(value) {
  if (value === null) return "";
  if (value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if (typeof value.url === "string") return value.url.trim();
    if (typeof value.src === "string") return value.src.trim();
  }
  return String(value).trim();
}

export function extractAvatarUrl(entity) {
  for (const path of AVATAR_PATHS) {
    const value = readPath(entity, path);
    const normalized = normalizeAvatarValue(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

export function emitProfileUpdated(payload = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: payload }));
}

export function subscribeProfileUpdated(handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event?.detail || {});
  window.addEventListener(PROFILE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, listener);
}