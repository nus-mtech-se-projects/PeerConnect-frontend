import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: "a008d21a-1ac5-4b96-83a9-1e198b24cc64",
    authority: "https://login.microsoftonline.com/consumers",
    redirectUri: "http://localhost:5173",
    postLogoutRedirectUri: "http://localhost:5173",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",   // persist login across page refreshes
    storeAuthStateInCookie: false,   // set true if you need IE11 support
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
      logLevel: LogLevel.Warning,   // change to LogLevel.Verbose to debug
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Scopes requested when logging in — User.Read gives access to basic profile
export const loginRequest = {
  scopes: ["User.Read"],
};