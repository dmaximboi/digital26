import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import {
  fetchNewsPack,
  loadNewsStore,
  saveNewsStore,
} from "../lib/offlinePack";
import {
  formatNewsTime,
  loadInterest,
  rankRelated,
  rememberStory,
  type NewsItem,
} from "../lib/newsInterest";
import { setJsonLd, setPageMeta, siteUrl } from "../lib/seo";

const PAGE = 8;
type NewsTab = "foryou" | "featured";

export function NewsPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<NewsItem[]>(() => loadNewsStore());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => loadNewsStore().length === 0);
  const [tab, setTab] = useState<NewsTab>("featured");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    setPageMeta({
      title: t("news.metaTitle"),
      description: t("news.metaDesc"),
      path: id ? `/news/${id}` : "/news",
    });
  }, [t, id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = loadNewsStore();
      if (cached.length) {
        setItems(cached);
        setLoading(false);
      }
      try {
        const next = await fetchNewsPack();
        if (cancelled) return;
        if (next.length) {
          saveNewsStore(next);
          setItems(next);
        }
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        if (!cached.length) setError(err instanceof Error ? err.message : t("common.error"));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const interest = loadInterest();
  const related = useMemo(
    () => (interest ? rankRelated(items, interest).slice(0, shown) : []),
    [items, interest?.lastId, shown],
  );
  const story = id ? items.find((item) => item.id === id) : null;
  const featuredList = useMemo(() => items.slice(0, shown), [items, shown]);
  const moreLeft = tab === "foryou"
    ? Math.max(0, (interest ? rankRelated(items, interest).length : 0) - shown)
    : Math.max(0, items.length - shown);

  useEffect(() => {
    if (!items.length) return;
    setJsonLd("d26-jsonld-news", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t("news.title"),
      url: siteUrl("/news"),
      description: t("news.metaDesc"),
      hasPart: items.slice(0, 12).map((item) => ({
        "@type": "NewsArticle",
        headline: item.title,
        description: item.summary,
        url: item.url,
        datePublished: item.publishedAt || undefined,
        publisher: { "@type": "Organization", name: item.source },
      })),
    });
  }, [items, t]);

  function openStory(item: NewsItem) {
    rememberStory(item);
    navigate(`/news/${item.id}`);
  }

  function switchTab(next: NewsTab) {
    setTab(next);
    setShown(PAGE);
  }

  if (id && !loading && items.length > 0 && !story) {
    return (
      <section className="panel news-page">
        <DocBrandHeader title={t("news.title")} />
        <p className="muted">{t("news.missing")}</p>
        <Link className="btn" to="/news">
          {t("news.back")}
        </Link>
      </section>
    );
  }

  const list = tab === "foryou" ? related : featuredList;

  return (
    <section className="panel news-page">
      <DocBrandHeader title={t("news.title")} />

      {!story && (
        <div className="news-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "foryou"}
            className={tab === "foryou" ? "is-on" : ""}
            onClick={() => switchTab("foryou")}
          >
            {t("news.forYou")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "featured"}
            className={tab === "featured" ? "is-on" : ""}
            onClick={() => switchTab("featured")}
          >
            {t("news.featured")}
          </button>
        </div>
      )}

      {loading && <p className="muted">{t("common.loading")}</p>}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && <p className="muted">{t("news.empty")}</p>}

      {story && (
        <article className="news-story">
          <Link className="news-back" to="/news">
            {t("news.back")}
          </Link>
          <p className="news-meta">
            <span>{story.source}</span>
            {story.publishedAt ? <span>{formatNewsTime(story.publishedAt)}</span> : null}
          </p>
          <h2>{story.title}</h2>
          <p>{story.summary}</p>
          <a className="btn primary" href={story.url} target="_blank" rel="noopener noreferrer">
            {t("news.readOriginal")}
          </a>
          {related.length > 0 && (
            <div className="news-related">
              <h3>{t("news.forYou")}</h3>
              <ul>
                {related.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => openStory(item)}>
                      {item.title}
                    </button>
                    <span>{item.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}

      {!story && !loading && items.length > 0 && tab === "foryou" && related.length === 0 && (
        <p className="muted news-foryou-empty">
          {interest ? t("news.forYouNone") : t("news.forYouEmpty")}
        </p>
      )}

      {!story && list.length > 0 && (
        <>
          <ul className="news-headlines">
            {list.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openStory(item)}>
                  <strong>{item.title}</strong>
                  <span className="news-meta">
                    {item.source}
                    {item.publishedAt ? ` · ${formatNewsTime(item.publishedAt)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {moreLeft > 0 && (
            <button className="news-more-link" type="button" onClick={() => setShown((n) => n + PAGE)}>
              {t("news.seeMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
