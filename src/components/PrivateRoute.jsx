import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
import { useIsAuthenticated } from "@azure/msal-react";

/* FIXED: was checking localStorage.getItem("accessToken") only. A stale/expired
   localStorage token would let a user past this guard even after their MSAL session
   ended. Now uses MSAL's useIsAuthenticated() so the guard reflects the live
   Microsoft session state, not a cached string. */
export default function PrivateRoute({ children }) {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

PrivateRoute.propTypes = {
  children: PropTypes.node,
};
