import { LogLevel } from "@azure/msal-browser";

/**
 * MSAL configuration for Azure Entra ID (formerly Azure AD).
 *
 * Replace the placeholder values below with your own
 * Azure App Registration details:
 *
 *  1. Go to https://entra.microsoft.com → App registrations → New registration
 *  2. Set Redirect URI to window.location.origin (SPA platform)
 *  3. Copy the Application (client) ID → paste as VITE_MSAL_CLIENT_ID
 *  4. Copy the Directory (tenant) ID  → paste as VITE_MSAL_TENANT_ID
 *     (or use "common" / "organizations" / "consumers" for multi-tenant)
 *
 * Store them in a .env file at the project root:
 *   VITE_MSAL_CLIENT_ID=<your-client-id>
 *   VITE_MSAL_TENANT_ID=<your-tenant-id>
 */

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID || "REPLACE_WITH_YOUR_CLIENT_ID";
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID || "organizations";

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: globalThis.location.origin, 
    postLogoutRedirectUri: globalThis.location.origin,
    //redirectUri: 'https://salmon-island-0f8625f00.6.azurestaticapps.net',
    //postLogoutRedirectUri: 'https://salmon-island-0f8625f00.6.azurestaticapps.net',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          default:
            break;
        }
      },
    },
  },
};

/** Scopes requested during login — User.Read gives basic profile info */
export const loginRequest = {
  scopes: ["User.Read"],
};
