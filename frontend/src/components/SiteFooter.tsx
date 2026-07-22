import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandMark size="sm" showText />
      </div>
      <div className="footer-cols">
        <div>
          <p className="footer-heading">Navigate</p>
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/verify">Certificates</Link>
          <Link to="/check-agreement">Agreements</Link>
          <Link to="/contact">Contact</Link>
          <a href="https://dmaximboi.vercel.app" target="_blank" rel="noreferrer">
            Profile
          </a>
        </div>
        <div>
          <p className="footer-heading">The Digital 26</p>
          <p className="muted">3‑month Vibe Coding masterclass · agreements · certificates</p>
          <p className="muted">digital26.online</p>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} The Digital 26 by Maxim</p>
    </footer>
  );
}
