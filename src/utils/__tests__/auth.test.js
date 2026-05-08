import { authHeaders, validatePasswordCode, waitForToken } from "../auth";

function makeToken(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe("auth utils", () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("builds headers with and without bearer token", () => {
    expect(authHeaders()).toEqual({ "Content-Type": "application/json" });

    localStorage.setItem("accessToken", "abc");
    expect(authHeaders()).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer abc",
    });
  });

  it.each([
    ["", "password", "password", "Please enter the verification code."],
    ["123456", "", "", "Please enter a new password."],
    ["123456", "short", "short", "Password must be at least 6 characters."],
    ["123456", "password", "different", "Passwords do not match."],
    ["123456", "password", "password", null],
  ])("validates password-code inputs", (code, password, retypePassword, expected) => {
    expect(validatePasswordCode(code, password, retypePassword)).toBe(expected);
  });

  it("resolves once a valid token appears", async () => {
    vi.useFakeTimers();
    const promise = waitForToken(1000);

    vi.advanceTimersByTime(300);
    localStorage.setItem("accessToken", makeToken({ exp: Math.floor(Date.now() / 1000) + 60 }));
    vi.advanceTimersByTime(300);

    await expect(promise).resolves.toMatch(/^header\./);
  });

  it("keeps polling malformed or expired tokens and then times out", async () => {
    vi.useFakeTimers();
    localStorage.setItem("accessToken", "bad-token");
    const malformed = waitForToken(500);
    vi.advanceTimersByTime(900);
    await expect(malformed).rejects.toThrow("Token timeout");

    localStorage.setItem("accessToken", makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }));
    const expired = waitForToken(500);
    vi.advanceTimersByTime(900);
    await expect(expired).rejects.toThrow("Token timeout");
  });
});
