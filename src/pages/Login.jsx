import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function Login() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const isLoggedIn = accounts.length > 0;
  //console.log("Accounts:", instance.getAllAccounts());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
  if (accounts.length > 0) {
    navigate("/");
  }
  }, [accounts, navigate]);
  
  const handleContinue = (e) => {
    e.preventDefault();
    alert(`Login placeholder for: ${email || "(empty)"} / ${password ? "••••••" : "(no password)"}`);
  };

  return (
    <div className="page centerPage">
      <section className="authCard">
        <h1 className="authTitle">Login To Start Learning Now!</h1>

        {isLoggedIn && (
        <p style={{ color: "green", marginBottom: "10px" }}>
          You are logged in with Microsoft.
        </p>
        )}

        <div className="socialStack">
          <button className="socialBtn" type="button">Continue with Google</button>
          <button className="socialBtn" type="button">Continue with Facebook</button>
          <button 
            className="socialBtn" 
            type="button"
            onClick={() =>
              instance.loginRedirect({
                scopes: ["User.Read"],
              })
            }
          >
            Continue with Microsoft
          </button>

        </div>

        <div className="divider"><span>OR</span></div>

        <form onSubmit={handleContinue} className="authForm">
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
          />

          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />

          <button className="primaryBtn" type="submit">Login</button>
        </form>

        <div className="authHint">
          Don&apos;t have a PeerConnect account? <Link to="/signup">Sign up now</Link>
        </div>
      </section>
    </div>
  );
}
