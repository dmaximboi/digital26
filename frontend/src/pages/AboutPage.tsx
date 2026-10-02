import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { setPageMeta, setJsonLd, siteUrl } from "../lib/seo";

export function AboutPage() {
  useEffect(() => {
    setPageMeta({
      title: "About Us",
      description:
        "The Digital 26 is a vibe coding studio. We build websites and apps, train students, and issue public certificates. Available worldwide. RC - 9710046.",
      path: "/about",
    });
    setJsonLd("d26-jsonld-about", {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About The Digital 26",
      url: siteUrl("/about"),
      description:
        "The Digital 26 is a vibe coding studio. We build websites and apps, train students, and deliver worldwide.",
      mainEntity: {
        "@type": "Organization",
        name: "The Digital 26",
        founder: {
          "@type": "Person",
          name: "Adewuyi Ayuba",
          alternateName: "Maxim",
          url: "https://dmaximboi.vercel.app",
        },
        url: siteUrl("/"),
      },
    });
  }, []);

  return (
    <section className="panel about-page">
      <DocBrandHeader title="About Us" />

      <p className="about-lead">
        The Digital 26 is a vibe coding studio. We build websites and apps, train students
        on a flexible schedule, and take client work worldwide.
      </p>

      <div className="about-grid">
        <article className="about-card">
          <p className="about-card__eyebrow">Who we are</p>
          <h2>Maxim and The Digital 26</h2>
          <p>
            Founded and led by <strong>Adewuyi Ayuba (Maxim)</strong>. We are vast vibe coders
            with strong engineering knowledge. Builder-first: loyalty over hype, clear deals, and
            work you can check in the open. Registered business <strong>RC - 9710046</strong>.
          </p>
          <p>
            We have senior web and app engineers who review every codebase for security and
            quality. Our team is always available and ready to deliver.
          </p>
          <p>
            <a href="https://dmaximboi.vercel.app" target="_blank" rel="noreferrer">
              dmaximboi.vercel.app
            </a>
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">What we build</p>
          <h2>Any system, fast and secure</h2>
          <p>
            There is no system we cannot build. We deliver secure, production-ready solutions in
            days: payment systems, tracking dashboards, order management, mapping platforms,
            booking systems, e-commerce stores, portfolios, admin panels, inventory systems, CRM
            tools, and 50+ more.
          </p>
          <p>
            We build faster and cheaper than any freelancing platform and every project is
            reviewed by senior engineers for security and performance.
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">Studio & classroom</p>
          <h2>Student Training Programme</h2>
          <p>
            Learn vibe coding, prompt engineering, web development, and deployment. Tracks are 3,
            4, 5, or 6 months (or custom), physical or online.
          </p>
          <p>
            Your studio certificate is public (QR + ID). In class you also work toward extra
            certificates from tracks like Anthropic and freeCodeCamp.
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">Client work</p>
          <h2>Agreements & verification</h2>
          <p>
            Every client deal sits under a service agreement letter with a deal tag, plan, and
            structured delivery so both sides know what was promised. Signed letters stay publicly
            checkable by ID. Phone and email stay private.
          </p>
        </article>
      </div>

      <div className="cta-row about-cta">
        <Link className="btn primary" to="/contact">
          Hire us or apply
        </Link>
        <Link className="btn" to="/verify">
          Verify a certificate
        </Link>
        <Link className="btn" to="/check-agreement">
          Check an agreement
        </Link>
      </div>
    </section>
  );
}
