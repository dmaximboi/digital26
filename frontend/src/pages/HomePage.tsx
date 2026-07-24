import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";

export function HomePage() {
  useEffect(() => {
    document.title = "The Digital 26 · Best Vibe Coding Studio";
  }, []);

  return (
    <section className="hero">
      <CodingLaptop />
      <div className="hero-brand">
        <BrandMark size="lg" showText />
      </div>
      <h1>The Digital 26</h1>
      <p className="lede">
        World-class Vibe Coding studio and classroom. Low-code web development on a flexible
        any-month path (about 6 months recommended). Digital presence with clear agreements —
        verify certificates in public.
      </p>
      <div className="cta-row">
        <Link className="btn primary" to="/verify">
          Verify a certificate
        </Link>
        <Link className="btn" to="/check-agreement">
          Check an agreement
        </Link>
        <Link className="btn" to="/contact">
          Contact us
        </Link>
      </div>
    </section>
  );
}
