import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";
import { setPageMeta, setJsonLd, orgWebsiteJsonLd } from "../lib/seo";

export function HomePage() {
  useEffect(() => {
    setPageMeta({
      title: "Best Vibe Coding Studio",
      description:
        "The Digital 26 is the first and best Vibe Coding studio in the world. We build secure websites and apps in days, train students in 5 or 6 months, and deliver faster and cheaper than any freelancing platform. Available worldwide.",
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
          The first and best Vibe Coding studio in the world. We build secure websites and apps
          in days, train students in vibe coding, and deliver faster and cheaper than any
          freelancing platform. Available worldwide.
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
              Learn vibe coding and low-code web development by shipping real projects. Choose a
              5-month, 6-month, or any-month programme depending on your availability. Classes
              are both physical and online, your choice. Students learn at their own pace with
              convenience and ease, and our prices are affordable.
            </p>
          </article>
          <article className="home-feature">
            <h3>We Build Anything, Fast</h3>
            <p>
              We are vast vibe coders with strong engineering knowledge. We build secure websites
              and apps in just days: payment systems, tracking dashboards, order management,
              mapping platforms, booking systems, e-commerce, portfolios, and 50+ more. There is
              no system we cannot build.
            </p>
          </article>
          <article className="home-feature">
            <h3>Faster & Cheaper Than Freelancers</h3>
            <p>
              We deliver faster and cheaper than any freelancing platform. We have senior web and
              app engineers who review every codebase for security, performance, and quality. Our
              work is secure, scalable, and production-ready. We are always available for work
              worldwide.
            </p>
          </article>
          <article className="home-feature">
            <h3>Verified Certificates & Agreements</h3>
            <p>
              Students who complete the programme receive a verified Certificate of Participation
              or Completion with a public ID and QR code anyone can verify. Every client deal is
              backed by a service agreement letter with public verification. We are open,
              transparent, and accountable.
            </p>
          </article>
          <article className="home-feature">
            <h3>Student Training Programme</h3>
            <p>
              We train students in vibe coding, prompt engineering, web development, and
              deployment. The programme is flexible: 5 months, 6 months, or any duration that
              works for you. Classes run both online and in-person. After completing your project,
              you get a publicly verifiable certificate.
            </p>
          </article>
          <article className="home-feature">
            <h3>How Google Sign-In is Used</h3>
            <p>
              Students and administrators sign in securely with their Google account. This lets us
              verify your identity, manage student applications, track weekly attendance, and
              enable communication between students, all without storing passwords.
            </p>
          </article>
        </div>
      </section>

      <section className="home-cta-bottom">
        <h2>Ready to start?</h2>
        <p>
          Apply for the Vibe Coding programme, hire us to build your system, or explore our
          public verification tools.
        </p>
        <div className="cta-row">
          <Link className="btn primary" to="/signin">
            Sign in with Google
          </Link>
          <Link className="btn" to="/contact">
            Hire us
          </Link>
          <Link className="btn" to="/about">
            Learn more
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
