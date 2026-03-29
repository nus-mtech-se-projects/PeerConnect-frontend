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
          Verification code
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
          New password
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
          Retype password
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
