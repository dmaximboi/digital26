const SITE = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online"
).replace(/\/$/, "");

const DEFAULT_DESC =
  "The Digital 26 is a world-class Vibe Coding studio and classroom. Learn low-code web development on a flexible any-month programme (about 6 months recommended), ship real digital presence, and verify certificates in public.";

export function siteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE}/`;
  return `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function setPageMeta(opts: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
}): void {
  const title = opts.title
    ? `${opts.title} · The Digital 26`
    : "The Digital 26 · Best Vibe Coding Studio";
  const description = opts.description || DEFAULT_DESC;
  const url = siteUrl(opts.path || "/");
  const image = opts.image?.startsWith("http")
    ? opts.image
    : siteUrl(opts.image || "/logo.png");

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "theme-color", "#ff9e00");
  upsertMeta(
    "name",
    "keywords",
    "vibe coding, low code, web development, digital26, Adewuyi Ayuba, Maxim, coding studio, verifiable certificate, Nigeria tech education",
  );
  upsertLink("canonical", url);

  upsertMeta("property", "og:type", opts.type || "website");
  upsertMeta("property", "og:site_name", "The Digital 26");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:locale", "en_NG");

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);
}

export function setJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]): void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string): void {
  document.getElementById(id)?.remove();
}

export function orgWebsiteJsonLd(): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "The Digital 26",
      alternateName: ["Digital 26", "D26 Vibe Coding Studio"],
      url: siteUrl("/"),
      logo: siteUrl("/logo.png"),
      image: siteUrl("/logo.png"),
      description: DEFAULT_DESC,
      foundingDate: "2024",
      founder: {
        "@type": "Person",
        name: "Adewuyi Ayuba",
        alternateName: "Maxim",
        url: "https://dmaximboi.vercel.app",
      },
      sameAs: ["https://dmaximboi.vercel.app", "https://github.com/dmaximboi"],
      areaServed: "Worldwide",
      knowsAbout: [
        "Vibe Coding",
        "Low-code web development",
        "Digital presence",
        "Verifiable credentials",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "The Digital 26",
      url: siteUrl("/"),
      description: DEFAULT_DESC,
      inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl("/verify")}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Vibe Coding Studio & Classroom — Low-code Web Development",
      description:
        "Hands-on Vibe Coding and low-code web development at The Digital 26. Flexible any-month structure with a recommended ~6-month pathway. Learn by shipping websites, apps, and digital presence under mentor guidance.",
      provider: {
        "@type": "Organization",
        name: "The Digital 26",
        url: siteUrl("/"),
      },
      educationalLevel: "Beginner to intermediate",
      teaches: [
        "Vibe Coding",
        "Low-code web development",
        "Shipping products",
        "Digital presence",
      ],
      timeRequired: "P6M",
      coursePrerequisites: "Curiosity and a laptop",
      url: siteUrl("/about"),
      offers: {
        "@type": "Offer",
        category: "Education",
        availability: "https://schema.org/InStock",
        url: siteUrl("/contact"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "EducationalOccupationalProgram",
      name: "The Digital 26 Flexible Vibe Coding Programme",
      description:
        "Any-month programme structure (no longer locked to 3 months). Recommended completion path about 6 months. Studio + classroom delivery with publicly verifiable certificates.",
      timeToComplete: "P6M",
      occupationalCategory: "15-1254.00",
      provider: {
        "@type": "Organization",
        name: "The Digital 26",
      },
      url: siteUrl("/about"),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is The Digital 26?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Digital 26 is a Vibe Coding studio and classroom led by Adewuyi Ayuba (Maxim). We teach low-code web development, ship client digital presence under clear agreements, and issue publicly verifiable certificates.",
          },
        },
        {
          "@type": "Question",
          name: "How long is the programme?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The structure is flexible (any-month). A recommended pathway is about 6 months of low-code web development and Vibe Coding practice.",
          },
        },
        {
          "@type": "Question",
          name: "How do I verify a Digital 26 certificate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Open digital26.online/verify and enter the public certificate ID, or scan the QR code on the certificate PDF/PNG. Only published public IDs are visible — private evidence and contact details are never exposed.",
          },
        },
        {
          "@type": "Question",
          name: "Why choose The Digital 26 for Vibe Coding?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We combine a real studio/classroom with client delivery: low-code web development, shipping digital presence, clear service agreements, and credentials anyone can verify online. Founded by Adewuyi Ayuba (Maxim).",
          },
        },
        {
          "@type": "Question",
          name: "Is digital26.online a legitimate business site?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The Digital 26 operates at digital26.online with public certificate verification, agreement checks, founder profile at dmaximboi.vercel.app, and open GitHub presence. Trust comes from verifiable records and consistent brand identity — not from the TLD alone.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "The Digital 26",
      url: siteUrl("/"),
      image: siteUrl("/logo.png"),
      description: DEFAULT_DESC,
      priceRange: "$$",
      founder: {
        "@type": "Person",
        name: "Adewuyi Ayuba",
        alternateName: "Maxim",
      },
      sameAs: ["https://dmaximboi.vercel.app", "https://github.com/dmaximboi"],
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Vibe Coding Studio & Classroom",
            description: "Low-code web development training on a flexible any-month path (~6 months recommended).",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Digital presence & web delivery",
            description: "Websites and apps under clear service agreements with public verification.",
          },
        },
      ],
    },
  ];
}

export function certificateJsonLd(cert: {
  publicId: string;
  name: string;
  course: string;
  type: string;
  issueDate: string;
  status: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalCredential",
    name:
      String(cert.type).toUpperCase() === "COMPLETION"
        ? "Certificate of Completion"
        : "Certificate of Participation",
    description: `${cert.name} — ${cert.course} (${cert.status})`,
    credentialCategory: cert.type,
    recognizedBy: {
      "@type": "Organization",
      name: "The Digital 26",
      url: siteUrl("/"),
    },
    about: {
      "@type": "Course",
      name: cert.course,
    },
    dateCreated: cert.issueDate,
    identifier: cert.publicId,
    url: siteUrl(`/verify/${encodeURIComponent(cert.publicId)}`),
  };
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}
