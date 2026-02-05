import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const handleSignup = (e) => {
    e.preventDefault();
    alert(`Signup placeholder for: ${fullName}, ${email}`);
  };

  return (
    <div className="page centerPage">
      <section className="authCard">
        <h1 className="authTitle">Sign Up</h1>
        <div className="authSub">Create your PeerConnect account</div>

        <form onSubmit={handleSignup} className="authForm">
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" />
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
          <input className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" type="password" />
          <button className="primaryBtn" type="submit">Sign Up</button>
        </form>

        <div className="authHint">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </section>
    </div>
  );
}
