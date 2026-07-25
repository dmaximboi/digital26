import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { setPageMeta, setJsonLd, siteUrl } from "../lib/seo";

export function PrivacyPage() {
  useEffect(() => {
    setPageMeta({
      title: "Privacy Policy",
      description:
        "Privacy Policy for The Digital 26 how we collect, use, and protect your personal data.",
      path: "/privacy",
    });
    setJsonLd("d26-jsonld-privacy", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Privacy Policy The Digital 26",
      url: siteUrl("/privacy"),
      description: "Privacy Policy for The Digital 26 vibe coding studio.",
    });
  }, []);

  return (
    <section className="panel legal-page">
      <DocBrandHeader title="Privacy Policy" />
      <p className="legal-updated">Last updated: July 2026</p>

      <article className="legal-body">
        <h2>1. Who we are</h2>
        <p>
          The Digital 26 ("we", "us", "our") is a vibe coding studio and classroom operated by
          Adewuyi Ayuba (Maxim). Our website is{" "}
          <a href="https://digital26.online" target="_blank" rel="noreferrer">
            digital26.online
          </a>.
        </p>

        <h2>2. Information we collect</h2>
        <p>We collect information you provide directly when you:</p>
        <ul>
          <li>Sign in with Google (name, email address, profile photo)</li>
          <li>Apply as a student (full name, phone number, parent/guardian phone, address, passport photo, programme choice)</li>
          <li>Submit a contact form (name, email, phone, message)</li>
          <li>Sign an agreement or claim a certificate (name, email, phone, signature, NIN where applicable)</li>
        </ul>
        <p>We also collect limited technical data automatically:</p>
        <ul>
          <li>IP address, browser user-agent, and referrer for site analytics</li>
          <li>Pages visited and timestamps</li>
        </ul>

        <h2>3. How we use your information</h2>
        <ul>
          <li><strong>Authentication:</strong> Google OAuth to verify your identity and manage your account</li>
          <li><strong>Student management:</strong> Processing applications, tracking attendance, and enabling student chat</li>
          <li><strong>Agreements & certificates:</strong> Creating, verifying, and publicly displaying agreement cards and certificates (only non-sensitive data is shown publicly)</li>
          <li><strong>Communication:</strong> Responding to contact form messages</li>
          <li><strong>Security:</strong> Protecting against unauthorised access and abuse</li>
        </ul>

        <h2>4. What we share publicly</h2>
        <p>
          <strong>Public certificate and agreement cards</strong> display only: display name, deal type, course name,
          issue date, and signature name. Phone numbers, emails, NINs, home addresses, and full PDFs
          are <strong>never</strong> shown publicly.
        </p>

        <h2>5. Data protection</h2>
        <ul>
          <li>All data is stored in a PostgreSQL database with Row Level Security (RLS) enabled</li>
          <li>Sensitive fields (NIN) are encrypted at rest</li>
          <li>Authentication uses Google OAuth + server-signed JWT tokens</li>
          <li>Admin access requires dual-layer verification (environment allowlist + database allowlist)</li>
          <li>All API endpoints serving private data require authentication</li>
          <li>HTTPS is enforced with HSTS preload</li>
        </ul>

        <h2>6. Third-party services</h2>
        <ul>
          <li><strong>Google OAuth:</strong> For sign-in (governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google's Privacy Policy</a>)</li>
          <li><strong>ImageKit:</strong> For image hosting and optimisation</li>
          <li><strong>Neon:</strong> For PostgreSQL database hosting</li>
          <li><strong>Render:</strong> For application hosting</li>
        </ul>

        <h2>7. Data retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide our services.
          Agreement and certificate records are retained indefinitely as they serve as verifiable public records.
          Contact messages are retained for up to 2 years.
        </p>

        <h2>8. Your rights</h2>
        <p>You may:</p>
        <ul>
          <li>Request access to the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and associated data (where not required for legal/contractual purposes)</li>
        </ul>
        <p>
          To exercise these rights, contact us at{" "}
          <a href="mailto:dmaximboi@gmail.com">dmaximboi@gmail.com</a>.
        </p>

        <h2>9. Children's privacy</h2>
        <p>
          Students under 18 must provide a parent/guardian phone number during registration.
          We do not knowingly collect data from children under 13.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes will be posted on this page
          with an updated date.
        </p>

        <h2>11. Contact</h2>
        <p>
          For privacy-related questions, contact us at{" "}
          <a href="mailto:dmaximboi@gmail.com">dmaximboi@gmail.com</a> or use our{" "}
          <Link to="/contact">contact form</Link>.
        </p>
      </article>
    </section>
  );
}
