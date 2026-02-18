import { Navigate } from "react-router-dom";

// Reads the token stored by Login.jsx on successful login.
// Swap this check for a proper auth context later if needed.
export default function PrivateRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" replace />;
}