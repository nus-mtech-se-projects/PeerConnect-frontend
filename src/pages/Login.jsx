import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");

  const handleContinue = (e) => {
    e.preventDefault();
    alert(`Login placeholder for: ${email || "(empty)"}`);
  };

  return (
    <div className="page centerPage">
      <section className="authCard">
        <h1 className="authTitle">Login To Start Learning Now!</h1>

        <div className="socialStack">
          <button className="socialBtn" type="button">Continue with Google</button>
          <button className="socialBtn" type="button">Continue with Facebook</button>
          <button className="socialBtn" type="button">Continue with Microsoft</button>
        </div>

        <div className="divider"><span>OR</span></div>

        <form onSubmit={handleContinue} className="authForm">
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
          />
          <button className="primaryBtn" type="submit">Continue</button>
        </form>

        <div className="authHint">
          Don&apos;t have a PeerConnect account? <Link to="/signup">Sign up now</Link>
        </div>
      </section>
    </div>
  );
}
