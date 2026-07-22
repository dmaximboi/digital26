const SITE = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online"
).replace(/\/$/, "");

const DEFAULT_DESC =
  "The Digital 26: a Vibe Coding studio and classroom, digital presence for clients under structured agreements, and publicly verifiable certificates.";

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
    : "The Digital 26 · Vibe Coding Studio";
  const description = opts.description || DEFAULT_DESC;
  const url = siteUrl(opts.path || "/");
  const image = opts.image?.startsWith("http")
    ? opts.image
    : siteUrl(opts.image || "/logo.png");

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "theme-color", "#ff9e00");
  upsertLink("canonical", url);

  upsertMeta("property", "og:type", opts.type || "website");
  upsertMeta("property", "og:site_name", "The Digital 26");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:image", image);

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
      url: siteUrl("/"),
      logo: siteUrl("/logo.png"),
      description: DEFAULT_DESC,
      sameAs: ["https://dmaximboi.vercel.app"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "The Digital 26",
      url: siteUrl("/"),
      description: DEFAULT_DESC,
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
        "Hands-on Vibe Coding at The Digital 26: learn in a studio and classroom setting, build real websites and apps, and grow a digital presence.",
      provider: {
        "@type": "Organization",
        name: "The Digital 26",
        url: siteUrl("/"),
      },
      educationalLevel: "Beginner to intermediate",
      teaches: "Vibe Coding, web development, shipping products, digital presence",
      url: siteUrl("/"),
    },
    {
      "@context": "https://schema.org",
      "@type": "EducationalOccupationalProgram",
      name: "The Digital 26 Vibe Coding Program",
      description:
        "Studio and classroom Vibe Coding with The Digital 26. Learn by shipping, build digital presence, and verify credentials in public.",
      provider: {
        "@type": "Organization",
        name: "The Digital 26",
      },
      url: siteUrl("/"),
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

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}
