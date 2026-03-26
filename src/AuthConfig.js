import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const clientId =
  import.meta.env.VITE_MSAL_CLIENT_ID || "a008d21a-1ac5-4b96-83a9-1e198b24cc64";
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID || "consumers";
const authority = `https://login.microsoftonline.com/${tenantId}`;

const msalConfig = {
  auth: {
    clientId,
    authority,
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
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
  scopes: ["User.Read"],
  authority,
  prompt: "select_account",
};

export function getMicrosoftLoginErrorMessage(error) {
  const message =
    `${error?.errorCode || ""} ${error?.errorMessage || ""} ${error?.message || ""}`.toLowerCase();

  if (
    message.includes("aadsts50020") ||
    message.includes("aadsts500207") ||
    message.includes("account from identity provider") ||
    message.includes("personal microsoft accounts are not supported")
  ) {
    return "This sign-in is now limited to personal Microsoft accounts only. Use a Hotmail, Outlook, or Live account.";
  }

  return "Microsoft login failed. Please try again.";
}
