import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import "./styles/global.css";

import "./styles/components/AppShell.css";
import "./styles/components/Navbar.css";
import "./styles/components/Carousel.css";
import "./styles/components/Footer.css";

import "./styles/pages/Home.css";
import "./styles/pages/About.css";
import "./styles/pages/Login.css";
import "./styles/pages/Signup.css";
export default function App() {
  return (
    <div className="appShell">
      <Navbar />

      <main className="mainContent">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
