/* SWA BUILT-IN AUTH — commented out on feature/msal-b2b-auth branch.
   Preserved for reference. See main branch for active SWA implementation. */
/*
export const SWA_LOGIN_URL = "/.auth/login/aad";
export const SWA_LOGOUT_URL = "/.auth/logout";

export async function getSwaUser() {
  try {
    const res = await fetch("/.auth/me");
    const data = await res.json();
    return data.clientPrincipal ?? null;
  } catch {
    return null;
  }
}
*/

/* MSAL B2B AUTH — restored on feature/msal-b2b-auth branch. */
import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

/* FIXED: removed hardcoded fallbacks. A missing env var now fails loudly at
   startup rather than silently using a stale/wrong App Registration. */
const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID;

const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:   console.error(message); break;
          case LogLevel.Warning: console.warn(message);  break;
          case LogLevel.Info:    console.info(message);  break;
          case LogLevel.Verbose: console.debug(message); break;
        }
      },
      logLevel: LogLevel.Verbose,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

/* FIXED: was ["User.Read"] (a Graph scope). Changed to OIDC identity scopes so
   the ID token contains name/email claims without a separate Graph API call.
   "User.Read" is for calling Microsoft's API, not for reading identity claims. */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

/* Backend access token scope — used by acquireTokenSilent in App.jsx.
   This must match a scope exposed in your App Registration under "Expose an API". */
export const backendTokenRequest = {
  scopes: [`api://${clientId}/access_as_user`],
};
