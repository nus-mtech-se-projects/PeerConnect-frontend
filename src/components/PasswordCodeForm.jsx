import PropTypes from "prop-types";

export default function PasswordCodeForm({
  code,
  onCodeChange,
  password,
  onPasswordChange,
  retypePassword,
  onRetypeChange,
  error,
  loading,
  submitLabel,
  onSubmit,
  children,
}) {
  return (
    <form className="authForm" onSubmit={onSubmit}>
      <div className="authField">
        <label className="authLabel" htmlFor="pcf-code">
          <span>Verification code</span>
          <input
            id="pcf-code"
            className="authInput"
            value={code}
            onChange={onCodeChange}
            placeholder="Enter 6-digit code"
            autoComplete="one-time-code"
          />
        </label>
      </div>

      <div className="authField">
        <label className="authLabel" htmlFor="pcf-password">
          <span>New password</span>
          <input
            id="pcf-password"
            className="authInput"
            value={password}
            onChange={onPasswordChange}
            type="password"
            placeholder="New password"
            autoComplete="new-password"
          />
        </label>
      </div>

      <div className="authField">
        <label className="authLabel" htmlFor="pcf-retype">
          <span>Retype password</span>
          <input
            id="pcf-retype"
            className="authInput"
            value={retypePassword}
            onChange={onRetypeChange}
            type="password"
            placeholder="Retype new password"
            autoComplete="new-password"
          />
        </label>
      </div>

      {error && <div className="authError">{error}</div>}

      <button className="authButton" type="submit" disabled={loading}>
        {submitLabel}
      </button>

      {children}
    </form>
  );
}

PasswordCodeForm.propTypes = {
  code: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  password: PropTypes.string.isRequired,
  onPasswordChange: PropTypes.func.isRequired,
  retypePassword: PropTypes.string.isRequired,
  onRetypeChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool.isRequired,
  submitLabel: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  children: PropTypes.node,
};
