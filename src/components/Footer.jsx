import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footerPro">
      <div className="footerContainer">
        <div className="footerGrid">
          <div className="footerBrand">
            <div className="footerLogo" aria-hidden />
            <div>
              <div className="footerBrandName">PeerConnect</div>
              <div className="footerTagline">
                Peer tutoring, study groups, and AI help—built for better learning.
              </div>
            </div>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Product</div>
            <Link className="footerLink" to="/">Features</Link>
            <Link className="footerLink" to="/how-it-works">How it works</Link>
            <Link className="footerLink" to="/pricing">Pricing</Link>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Company</div>
            <Link className="footerLink" to="/contact">About</Link>
            <Link className="footerLink" to="/contact">Contact</Link>
            <Link className="footerLink" to="/careers">Careers</Link>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Support</div>
            <Link className="footerLink" to="/help-center">Help Center</Link>
            <Link className="footerLink" to="/terms">Terms</Link>
            <Link className="footerLink" to="/privacy">Privacy</Link>
          </div>

          <div className="footerCol">
            <div className="footerColTitle">Get updates</div>
            <div className="footerSmall" style={{ fontSize: "14px" }}>
              Monthly tips, new features, and study resources.
            </div>

            <form
              className="footerNewsletter"
              onSubmit={(e) => {
                e.preventDefault();
                alert("Subscribed (placeholder)");
              }}
            >
              <input className="footerInput" placeholder="Email address" type="email" />
              <button className="footerBtn" type="submit">
                Subscribe
              </button>
            </form>

            <div className="footerSocial">
              <button className="iconBtn" type="button" aria-label="Twitter">𝕏</button>
              <button className="iconBtn" type="button" aria-label="Instagram">⌁</button>
              <button className="iconBtn" type="button" aria-label="LinkedIn">in</button>
            </div>
          </div>
        </div>

        <div className="footerBottom">
          <div>© {new Date().getFullYear()} PeerConnect. All rights reserved.</div>
          <div className="footerBottomLinks">
            <Link className="footerLink" to="/security">Security</Link>
            <Link className="footerLink" to="/status">Status</Link>
            <Link className="footerLink" to="/sitemap">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
