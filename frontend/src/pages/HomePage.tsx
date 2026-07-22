import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";

export function HomePage() {
  useEffect(() => {
    document.title = "The Digital 26 · Vibe Coding Masterclass";
  }, []);

  return (
    <section className="hero">
      <CodingLaptop />
      <div className="hero-brand">
        <BrandMark size="lg" showText />
      </div>
      <h1>The Digital 26</h1>
      <p className="lede">
        Flexible 3-month Vibe Coding. We build websites and apps with clear agreements and plans.
        Verify certificates in public.
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
