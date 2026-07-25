import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { setPageMeta, setJsonLd, siteUrl } from "../lib/seo";

export function TermsPage() {
  useEffect(() => {
    setPageMeta({
      title: "Terms of Service",
      description:
        "Terms of Service for The Digital 26 — rules and conditions for using our platform.",
      path: "/terms",
    });
    setJsonLd("d26-jsonld-terms", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Terms of Service — The Digital 26",
      url: siteUrl("/terms"),
      description: "Terms of Service for The Digital 26 vibe coding studio.",
    });
  }, []);

  return (
    <section className="panel legal-page">
      <DocBrandHeader title="Terms of Service" />
      <p className="legal-updated">Last updated: July 2026</p>

      <article className="legal-body">
        <h2>1. Acceptance of terms</h2>
        <p>
          By accessing or using The Digital 26 website at{" "}
          <a href="https://digital26.online" target="_blank" rel="noreferrer">
            digital26.online
          </a>{" "}
          ("the Service"), you agree to be bound by these Terms of Service. If you do not agree,
          do not use the Service.
        </p>

        <h2>2. Description of service</h2>
        <p>The Digital 26 provides:</p>
        <ul>
          <li>A vibe coding studio and classroom for learning low-code web development</li>
          <li>Student registration, attendance tracking, and communication tools</li>
          <li>Digital service agreements with public verification</li>
          <li>Digital certificates with public verification and QR codes</li>
          <li>Website and application development services for clients</li>
        </ul>

        <h2>3. User accounts</h2>
        <ul>
          <li>You must sign in with a valid Google account to access student and admin features</li>
          <li>You are responsible for all activity under your account</li>
          <li>You must provide accurate information during registration</li>
          <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
        </ul>

        <h2>4. Student programme</h2>
        <ul>
          <li>Student applications are subject to admin review and approval</li>
          <li>Programme structures (5-month or 6-month) are described at the time of application</li>
          <li>Weekly attendance is tracked and recorded</li>
          <li>Students must maintain respectful communication in the group chat (limit: 10 messages per 24 hours)</li>
          <li>Completion certificates are issued at the discretion of The Digital 26 administration</li>
        </ul>

        <h2>5. Agreements and certificates</h2>
        <ul>
          <li>Digital agreements are legally binding between the parties named in them</li>
          <li>Public agreement cards display limited, non-sensitive information for verification</li>
          <li>Certificates represent completion or participation as determined by The Digital 26</li>
          <li>We reserve the right to revoke certificates in cases of fraud or misrepresentation</li>
          <li>Evidence images uploaded for agreements and certificates are stored privately and accessible only to authorised administrators</li>
        </ul>

        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>Attempt to access another user's account or personal data</li>
          <li>Upload malicious content, spam, or harmful files</li>
          <li>Interfere with or disrupt the Service infrastructure</li>
          <li>Scrape, crawl, or harvest data from the Service without permission</li>
          <li>Misrepresent your identity or affiliation with The Digital 26</li>
        </ul>

        <h2>7. Intellectual property</h2>
        <p>
          All content, design, branding, and code on the Service are owned by The Digital 26
          unless otherwise stated. Students retain ownership of projects they build during the
          programme.
        </p>

        <h2>8. Privacy</h2>
        <p>
          Your use of the Service is also governed by our{" "}
          <Link to="/privacy">Privacy Policy</Link>, which describes how we collect, use, and
          protect your data.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          The Service is provided "as is" without warranties of any kind. The Digital 26 shall not
          be liable for any indirect, incidental, or consequential damages arising from your use of
          the Service.
        </p>

        <h2>10. Modifications</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes
          constitutes acceptance of the new Terms.
        </p>

        <h2>11. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria.
        </p>

        <h2>12. Contact</h2>
        <p>
          For questions about these Terms, contact us at{" "}
          <a href="mailto:dmaximboi@gmail.com">dmaximboi@gmail.com</a> or use our{" "}
          <Link to="/contact">contact form</Link>.
        </p>
      </article>
    </section>
  );
}
