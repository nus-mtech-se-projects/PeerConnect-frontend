import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./AuthConfig";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";

import "./styles/components/AppShell.css";
import "./styles/components/Navbar.css";
import "./styles/components/Carousel.css";
import "./styles/components/Footer.css";

import "./styles/pages/Home.css";
import "./styles/pages/About.css";
import "./styles/pages/Auth.css";

async function bootstrap() {
  await msalInstance.initialize();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap();