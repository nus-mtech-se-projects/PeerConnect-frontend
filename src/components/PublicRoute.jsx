import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
import { useIsAuthenticated } from "@azure/msal-react";

/* FIXED: was checking localStorage.getItem("accessToken") only. Aligned with
   PrivateRoute to use MSAL's useIsAuthenticated() as the source of truth. */
export default function PublicRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

PublicRoute.propTypes = {
  children: PropTypes.node,
};
