import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8080";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nusStudentId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Registration failed");
        return;
      }

      setOk("Account created. You can login now.");
      setTimeout(() => navigate("/login"), 600);
    } catch (err) {
      setError("Network error. Is Spring Boot running on 8080?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authContainer">
        <div className="authCard">
          <h1 className="authTitle">Create account</h1>
          <p className="authSubtitle">Sign up to start using PeerConnect</p>

          <form className="authForm" onSubmit={onSubmit}>
            <label className="authLabel">NUS Student ID</label>
            <input
              className="authInput"
              name="nusStudentId"
              value={form.nusStudentId}
              onChange={onChange}
              autoComplete="off"
              required
            />

            <div className="authRow2">
              <div>
                <label className="authLabel">First Name</label>
                <input
                  className="authInput"
                  name="firstName"
                  value={form.firstName}
                  onChange={onChange}
                  autoComplete="given-name"
                  required
                />
              </div>

              <div>
                <label className="authLabel">Last Name</label>
                <input
                  className="authInput"
                  name="lastName"
                  value={form.lastName}
                  onChange={onChange}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <label className="authLabel">Email</label>
            <input
              className="authInput"
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
              required
            />

            <label className="authLabel">Phone</label>
            <input
              className="authInput"
              name="phone"
              value={form.phone}
              onChange={onChange}
              autoComplete="tel"
              required
            />

            <label className="authLabel">Password</label>
            <input
              className="authInput"
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              autoComplete="new-password"
              required
            />

            {error && <div className="authMsg authMsgError">{error}</div>}
            {ok && <div className="authMsg authMsgOk">{ok}</div>}

            <button type="submit" className="primaryBtn" disabled={loading}>
              Create account
            </button>
          </form>

          <div className="authLinksTwoLines">
            <div>
              Already have an account? <a href="/login">Login</a>
            </div>
            <div>
              Forgot password? <span className="fakeLink">Click here</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
