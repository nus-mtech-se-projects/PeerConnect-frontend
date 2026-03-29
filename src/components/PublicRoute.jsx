import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";

// Redirects already-authenticated users away from public-only pages (login, signup).
export default function PublicRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? <Navigate to="/" replace /> : children;
}

PublicRoute.propTypes = {
  children: PropTypes.node,
};