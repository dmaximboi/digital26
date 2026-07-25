import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";
import { setPageMeta, setJsonLd, orgWebsiteJsonLd, siteUrl } from "../lib/seo";

export function HomePage() {
  useEffect(() => {
    setPageMeta({
      title: "Best Vibe Coding Studio",
      description:
        "The Digital 26 is a world-class Vibe Coding studio and classroom. Learn low-code web development, apply with Google Sign-In, track attendance, verify certificates, and check agreements — all in one platform.",
      path: "/",
    });
    setJsonLd("d26-jsonld-home", orgWebsiteJsonLd());
  }, []);

  return (
    <>
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
          <Link className="btn primary" to="/apply">
            Apply now
          </Link>
          <Link className="btn" to="/verify">
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

      <section className="home-about">
        <h2>What is The Digital 26?</h2>
        <div className="home-about__grid">
          <article className="home-feature">
            <h3>Vibe Coding Studio & Classroom</h3>
            <p>
              Learn low-code web development by shipping real projects. Choose a 5-month or
              6-month programme structure, attend weekly classes, and graduate with a publicly
              verifiable certificate. Apply using your Google account — no separate password needed.
            </p>
          </article>
          <article className="home-feature">
            <h3>Client Agreements & Digital Presence</h3>
            <p>
              We build websites and apps for clients under clear service agreements. Every deal is
              documented with a unique agreement ID, terms snapshot, and evidence. Clients and
              partners can verify agreements publicly.
            </p>
          </article>
          <article className="home-feature">
            <h3>Verifiable Certificates</h3>
            <p>
              Completers receive a Certificate of Participation or Completion with a public ID and
              QR code. Anyone — employers, schools, clients — can verify it instantly on this site.
              Private details like phone, email, and NIN are never exposed.
            </p>
          </article>
          <article className="home-feature">
            <h3>How Google Sign-In is Used</h3>
            <p>
              Students and administrators sign in securely with their Google account. This lets us
              verify your identity, manage student applications, track weekly attendance, and
              enable communication between students — all without storing passwords.
            </p>
          </article>
        </div>
      </section>

      <section className="home-cta-bottom">
        <h2>Ready to start?</h2>
        <p>
          Sign in with Google to apply for the Vibe Coding programme, or explore our public
          verification tools.
        </p>
        <div className="cta-row">
          <Link className="btn primary" to="/signin">
            Sign in with Google
          </Link>
          <Link className="btn" to="/about">
            Learn more about us
          </Link>
        </div>
      </section>

      <footer className="home-legal-links">
        <Link to="/privacy">Privacy Policy</Link>
        <span className="dot">·</span>
        <Link to="/terms">Terms of Service</Link>
      </footer>
    </>
  );
}
