import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";
import { orgWebsiteJsonLd, setJsonLd, setPageMeta } from "../lib/seo";

export function HomePage() {
  useEffect(() => {
    setPageMeta({
      title: undefined,
      description:
        "The Digital 26: a flexible 3-month Vibe Coding masterclass, client websites and apps under structured agreements, and publicly verifiable certificates.",
      path: "/",
    });
    setJsonLd("d26-jsonld-home", orgWebsiteJsonLd());
  }, []);

  return (
    <section className="hero">
      <CodingLaptop />
      <div className="hero-brand">
        <BrandMark size="lg" showText />
      </div>
      <h1>The Digital 26</h1>
      <p className="lede">
        Flexible 3‑month Vibe Coding. We build websites and apps with clear agreements
        and plans. Verify certificates in public.
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
