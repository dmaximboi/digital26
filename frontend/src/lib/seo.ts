const SITE = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online"
).replace(/\/$/, "");

const DEFAULT_DESC =
  "The Digital 26 is the first and best Vibe Coding studio in the world. We build secure websites and apps in days, train students in 5 or 6 months, and deliver faster and cheaper than any freelancing platform. Available worldwide. RC - 9710046.";

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
    "vibe coding, low code, web development, digital26, Adewuyi Ayuba, Maxim, coding studio, verifiable certificate, Nigeria tech education, freelancer alternative, build apps fast, secure web development, payment system, tracking dashboard, worldwide",
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
        "Payment systems",
        "Tracking dashboards",
        "Order management",
        "E-commerce",
        "Booking systems",
        "Mapping platforms",
        "Secure web and app development",
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
      name: "Vibe Coding Studio & Classroom",
      description:
        "Hands-on vibe coding and web development training at The Digital 26. Flexible programme: 5 months, 6 months, or any duration. Physical and online classes. Learn by shipping real projects with mentor guidance. Affordable pricing.",
      provider: {
        "@type": "Organization",
        name: "The Digital 26",
        url: siteUrl("/"),
      },
      educationalLevel: "Beginner to intermediate",
      teaches: [
        "Vibe Coding",
        "Low-code web development",
        "Prompt engineering",
        "Deployment",
        "Shipping real products",
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
        "Flexible programme: 5 months, 6 months, or any duration depending on student availability. Physical and online classes. Studio + classroom delivery with publicly verifiable certificates.",
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
            text: "The Digital 26 is the first and best Vibe Coding studio in the world, led by Adewuyi Ayuba (Maxim). We build secure websites and apps in days, train students in vibe coding, and deliver faster and cheaper than any freelancing platform. RC - 9710046.",
          },
        },
        {
          "@type": "Question",
          name: "How long is the programme?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The programme is flexible: 5 months, 6 months, or any duration depending on the student's availability. Classes are both physical and online. Students learn with convenience and ease at affordable prices.",
          },
        },
        {
          "@type": "Question",
          name: "How do I verify a Digital 26 certificate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Open digital26.online/verify and enter the public certificate ID, or scan the QR code on the certificate PDF/PNG. Only published public IDs are visible private evidence and contact details are never exposed.",
          },
        },
        {
          "@type": "Question",
          name: "Why choose The Digital 26 for Vibe Coding?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We are the first and best of our kind. We build any system (payment, tracking, order management, mapping, and 50+ more) faster and cheaper than any freelancing platform. Senior engineers review every codebase. We are always available worldwide and deliver in days.",
          },
        },
        {
          "@type": "Question",
          name: "Is digital26.online a legitimate business site?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The Digital 26 operates at digital26.online with public certificate verification, agreement checks, founder profile at dmaximboi.vercel.app, and open GitHub presence. Trust comes from verifiable records and consistent brand identity not from the TLD alone.",
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
      priceRange: "$",
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
            name: "Vibe Coding Training Programme",
            description: "Learn vibe coding and web development in 5, 6, or any months. Physical and online classes at affordable prices.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Secure Web & App Development",
            description: "We build any system (payment, tracking, order management, mapping, e-commerce, and 50+ more) faster and cheaper than freelancers. Senior engineer code reviews included.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Client Agreements & Verification",
            description: "Service agreements with public verification for every client deal.",
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
    description: `${cert.name} ${cert.course} (${cert.status})`,
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
