import { Navigate } from "react-router-dom";

// Redirects already-authenticated users away from public-only pages (login, signup).
export default function PublicRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? <Navigate to="/profile" replace /> : children;
}