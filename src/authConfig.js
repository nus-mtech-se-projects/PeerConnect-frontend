import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: "57cf3921-0d5b-4c96-9277-10a54818b823",
    authority: "https://login.microsoftonline.com/e7fd6993-e646-4b0e-a981-d38362d2d061",
    redirectUri: "http://localhost:5173",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
