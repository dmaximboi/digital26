import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import { apiGet } from "../lib/api";
import {
  formatNewsTime,
  loadInterest,
  rankRelated,
  rememberStory,
  type NewsItem,
} from "../lib/newsInterest";
import { setJsonLd, setPageMeta, siteUrl } from "../lib/seo";

const PAGE = 5;

type NewsPayload = {
  ready?: boolean;
  newsDate?: string;
  items?: NewsItem[];
};

export function NewsPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
      try {
        const data = await apiGet<NewsPayload>("/api/public/news/today");
        if (cancelled) return;
        const next = data.items ? [...data.items] : [];
        for (let i = next.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [next[i], next[j]] = [next[j]!, next[i]!];
        }
        setItems(next);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("common.error"));
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
    const ranked = rankRelated(rest, interest, story?.id);
    return ranked;
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
          {interest && related.filter((item) => item.id !== featured.id).length > 0 && (
            <section className="news-foryou" aria-label={t("news.forYou")}>
              <h2>{t("news.forYou")}</h2>
              <p className="muted">{t("news.because", { title: interest.lastTitle })}</p>
              <div className="news-foryou__row">
                {related
                  .filter((item) => item.id !== featured.id)
                  .slice(0, 3)
                  .map((item) => (
                  <button key={item.id} type="button" className="news-mini" onClick={() => openStory(item)}>
                    <strong>{item.title}</strong>
                    <span>{item.source}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <button type="button" className="news-feature" onClick={() => openStory(featured)}>
            <span className="news-kicker">{t("news.featured")}</span>
            <strong>{featured.title}</strong>
            <p>{featured.summary}</p>
            <span className="news-meta">
              {featured.source}
              {featured.publishedAt ? ` · ${formatNewsTime(featured.publishedAt)}` : ""}
            </span>
          </button>

          <h2 className="news-feed-title">{t("news.latest")}</h2>
          <ul className="news-feed">
            {list.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openStory(item)}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <span className="news-meta">
                    {item.source}
                    {item.publishedAt ? ` · ${formatNewsTime(item.publishedAt)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {moreLeft > 0 && (
            <button className="btn" type="button" onClick={() => setShown((n) => n + PAGE)}>
              {t("news.seeMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
