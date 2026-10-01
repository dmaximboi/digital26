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

const PAGE = 6;

export function NewsPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<NewsItem[]>(() => loadNewsStore());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => loadNewsStore().length === 0);
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
        } else if (!cached.length) {
          setError("");
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
  const related = useMemo(() => rankRelated(items, interest).slice(0, 3), [items, interest?.lastId]);
  const story = id ? items.find((item) => item.id === id) : null;
  const feed = useMemo(() => {
    const rest = story ? items.filter((item) => item.id !== story.id) : items;
    return rankRelated(rest, interest, story?.id);
  }, [items, interest?.lastId, story?.id]);

  const featured = !story ? feed[0] : null;
  const list = !story ? feed.slice(1, 1 + shown) : [];
  const moreLeft = !story ? Math.max(0, feed.length - 1 - shown) : 0;

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

  return (
    <section className="panel news-page">
      <DocBrandHeader title={t("news.title")} />
      <p className="lede">{t("news.lede")}</p>

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
              <h3>{t("news.because", { title: interest?.lastTitle || story.title })}</h3>
              <ul>
                {related.map((item) => (
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

      {!story && featured && (
        <>
          <button type="button" className="news-hero" onClick={() => openStory(featured)}>
            <span className="news-kicker">{t("news.featured")}</span>
            <strong>{featured.title}</strong>
            <p>{featured.summary}</p>
            <span className="news-meta">
              {featured.source}
              {featured.publishedAt ? ` · ${formatNewsTime(featured.publishedAt)}` : ""}
            </span>
          </button>

          <h2 className="news-feed-title">{t("news.latest")}</h2>
          <ol className="news-stack">
            {list.map((item, index) => (
              <li key={item.id}>
                <button type="button" onClick={() => openStory(item)}>
                  <span className="news-stack__n">{String(index + 1).padStart(2, "0")}</span>
                  <span className="news-stack__body">
                    <strong>{item.title}</strong>
                    <em>
                      {item.source}
                      {item.publishedAt ? ` · ${formatNewsTime(item.publishedAt)}` : ""}
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ol>
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
