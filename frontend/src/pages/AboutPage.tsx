import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { setPageMeta, setJsonLd, siteUrl } from "../lib/seo";

export function AboutPage() {
  useEffect(() => {
    setPageMeta({
      title: "About Us",
      description:
        "Who The Digital 26 is: Adewuyi Ayuba (Maxim), a flexible 3-month Vibe Coding masterclass, and client websites and apps under clear agreements.",
      path: "/about",
    });
    setJsonLd("d26-jsonld-about", {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About The Digital 26",
      url: siteUrl("/about"),
      description:
        "The Digital 26 builds learners and ships real products: Vibe Coding education plus websites and apps with structured agreements.",
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
        The Digital 26 is a Vibe Coding studio and classroom. We teach people to build, we ship
        websites and apps for clients, and we put agreements and certificates where anyone can
        verify them.
      </p>

      <div className="about-grid">
        <article className="about-card">
          <p className="about-card__eyebrow">Who we are</p>
          <h2>Maxim and The Digital 26</h2>
          <p>
            Founded and led by <strong>Adewuyi Ayuba (Maxim)</strong>. We are builder-first: loyalty
            over hype, clear deals, and work you can check in the open.
          </p>
          <p>
            Personal profile:{" "}
            <a href="https://dmaximboi.vercel.app" target="_blank" rel="noreferrer">
              dmaximboi.vercel.app
            </a>
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">Masterclass</p>
          <h2>3-month Vibe Coding</h2>
          <p>
            A flexible program of about three months. The structure can bend to suit your goals,
            while you still learn by shipping real projects, not slides alone.
          </p>
          <p>
            Completers can receive a public Certificate of Participation or Completion that Google
            and other systems can read and verify.
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">Client work</p>
          <h2>Websites, apps, agreements</h2>
          <p>
            We design and build websites and apps for people and businesses. Every serious deal sits
            under a service agreement with a deal tag, plan, and structured delivery so both sides
            know what was promised.
          </p>
          <p>
            Signed letters stay publicly checkable by ID. Phone and email stay private. Full PDFs
            stay in the private console only.
          </p>
        </article>

        <article className="about-card">
          <p className="about-card__eyebrow">How it works</p>
          <h2>Links, OTP, verify</h2>
          <ul>
            <li>Invite / claim links expire in 24 hours</li>
            <li>Email OTP confirms the invited address</li>
            <li>Certificates: public verify page + machine-readable API</li>
            <li>Agreements: public card by ID on digital26.online</li>
          </ul>
        </article>
      </div>

      <div className="cta-row about-cta">
        <Link className="btn primary" to="/contact">
          Contact us
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
