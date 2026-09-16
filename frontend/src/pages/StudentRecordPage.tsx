import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { publicLookupPath } from "../lib/checkoutProof";
import { CertificateArt } from "../components/CertificateArt";
import { PublicRecordQr } from "../components/PublicRecordQr";
import { LockedDownload } from "../components/LockedDownload";
import { useT } from "../i18n/LocaleContext";
import { formatCertDate } from "../lib/dates";
import {
  certificateJsonLd,
  removeJsonLd,
  setJsonLd,
  setPageMeta,
  siteUrl,
} from "../lib/seo";

type Assessment = {
  id: string;
  title: string;
  score: string | null;
  maxScore: string | null;
  notes: string | null;
  takenAt: string | null;
};

type CertPublic = {
  publicId: string;
  name: string;
  course: string | null;
  type: string;
  issueDate: string | null;
  status: string;
  photoUrl?: string | null;
  accessPaid?: boolean;
  amountUsd?: string;
  canDownloadTemplatePng?: boolean;
  downloadConsumed?: boolean;
  downloadToken?: string | null;
  student?: {
    fullName: string;
    photoUrl: string | null;
    programmeLabel: string;
    classMode: "PHYSICAL" | "ONLINE";
    startDate: string | null;
    headline: string | null;
    directorComment: string | null;
  } | null;
  projects?: Array<{
    id: string;
    title: string;
    url: string;
    description: string | null;
    completedAt: string | null;
  }>;
  credentials?: Array<{
    id: string;
    title: string;
    url: string;
    issuer: string | null;
    earnedAt: string | null;
  }>;
  assessments?: {
    performance: Assessment[];
    tests: Assessment[];
    examinations: Assessment[];
  };
};

type TabId = "performance" | "test" | "exam";

export function StudentRecordPage() {
  const t = useT();
  const { publicId } = useParams();
  const [result, setResult] = useState<CertPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("performance");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CertPublic>(publicLookupPath("CERTIFICATE", id));
      setResult(data);
      setJsonLd(
        "d26-jsonld-cert",
        certificateJsonLd({
          ...data,
          course: data.course || "",
          issueDate: data.issueDate || new Date().toISOString(),
          name: data.name,
        }),
      );
    } catch (err: unknown) {
      setResult(null);
      removeJsonLd("d26-jsonld-cert");
      setError(err instanceof Error ? err.message : t("verify.failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!publicId) return;
    void load(publicId);
    return () => removeJsonLd("d26-jsonld-cert");
  }, [publicId, load]);

  useEffect(() => {
    if (!result) {
      setPageMeta({
        title: t("record.title"),
        description: t("verify.metaDesc"),
        path: publicId ? `/verify/${publicId}` : "/verify",
      });
      return;
    }
    setPageMeta({
      title: `${result.name} · ${result.publicId}`,
      description: t("record.metaDesc", { name: result.name }),
      path: `/verify/${result.publicId}`,
      image: result.photoUrl || undefined,
    });
  }, [result, publicId, t]);

  const assessments = useMemo(() => {
    if (!result?.assessments) return [];
    if (tab === "performance") return result.assessments.performance;
    if (tab === "test") return result.assessments.tests;
    return result.assessments.examinations;
  }, [result, tab]);

  if (loading) {
    return (
      <section className="panel record-page">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }

  if (error || !result) {
    return (
      <section className="panel record-page">
        <p className="status error" role="alert">
          {error || t("verify.failed")}
        </p>
        <Link className="btn" to="/verify">
          {t("record.backToVerify")}
        </Link>
      </section>
    );
  }

  const student = result.student;
  const displayName = student?.fullName || result.name;
  const photo = student?.photoUrl || result.photoUrl;
  const classLabel =
    student?.classMode === "ONLINE" ? t("record.classOnline") : t("record.classPhysical");

  return (
    <section className="panel record-page">
      <header className="record-hero">
        <div className="record-hero__photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span>{displayName.slice(0, 1)}</span>
          )}
        </div>
        <div className="record-hero__copy">
          <p className={`badge ${result.status === "VALID" ? "ok" : "bad"}`}>{result.status}</p>
          <h1>{displayName}</h1>
          {student?.headline && <p className="record-hero__headline">{student.headline}</p>}
          <p className="muted">
            {student?.programmeLabel || result.course} {student ? `· ${classLabel}` : ""}
          </p>
          <p className="record-hero__id">
            {t("verify.id")}: <strong>{result.publicId}</strong>
          </p>
        </div>
      </header>

      {student?.directorComment && (
        <blockquote className="record-quote">
          <p>{student.directorComment}</p>
          <cite>{t("record.director")}</cite>
        </blockquote>
      )}

      <div className="record-cert-wrap">
        <h2>{t("record.certificate")}</h2>
        <div className="verify-cert-wrap">
          <CertificateArt
            publicId={result.publicId}
            displayName={result.name}
            type={result.type}
            course={result.course || ""}
            issueDate={result.issueDate || ""}
            photoUrl={result.photoUrl}
          />
        </div>
        <div className="record-cert-tools">
          <PublicRecordQr url={siteUrl(`/verify/${result.publicId}`)} size={168} />
          <LockedDownload
            kind="CERTIFICATE"
            publicId={result.publicId}
            amountUsd={result.amountUsd || "1.00"}
            canDownload={Boolean(result.canDownloadTemplatePng)}
            downloadConsumed={Boolean(result.downloadConsumed)}
            downloadToken={result.downloadToken}
            onUnlocked={() => void load(result.publicId)}
            onConsumed={() =>
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      canDownloadTemplatePng: false,
                      downloadToken: null,
                      downloadConsumed: true,
                    }
                  : prev,
              )
            }
          />
        </div>
      </div>

      <section className="record-section">
        <h2>{t("record.projects")}</h2>
        {result.projects && result.projects.length > 0 ? (
          <ul className="record-cards">
            {result.projects.map((project) => (
              <li key={project.id}>
                <a href={project.url} target="_blank" rel="noreferrer noopener">
                  <strong>{project.title}</strong>
                  {project.description && <p>{project.description}</p>}
                  <span>
                    {project.completedAt
                      ? formatCertDate(project.completedAt)
                      : t("record.openProject")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("record.noProjects")}</p>
        )}
      </section>

      <section className="record-section">
        <h2>{t("record.certs")}</h2>
        {result.credentials && result.credentials.length > 0 ? (
          <ul className="record-list">
            {result.credentials.map((cred) => (
              <li key={cred.id}>
                <a href={cred.url} target="_blank" rel="noreferrer noopener">
                  <strong>{cred.title}</strong>
                  <span>{cred.issuer || t("record.externalCert")}</span>
                  {cred.earnedAt && <em>{formatCertDate(cred.earnedAt)}</em>}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("record.noCerts")}</p>
        )}
      </section>

      <section className="record-section">
        <div className="record-tabs" role="tablist">
          {(
            [
              ["performance", t("record.tab.performance")],
              ["test", t("record.tab.test")],
              ["exam", t("record.tab.exam")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "is-active" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {assessments.length === 0 ? (
          <p className="muted">{t("record.noAssessments")}</p>
        ) : (
          <ul className="record-assess">
            {assessments.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  {item.notes && <p>{item.notes}</p>}
                </div>
                <div className="record-assess__meta">
                  {(item.score || item.maxScore) && (
                    <span>
                      {item.score || "—"}
                      {item.maxScore ? ` / ${item.maxScore}` : ""}
                    </span>
                  )}
                  {item.takenAt && <em>{formatCertDate(item.takenAt)}</em>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="record-back">
        <Link to="/verify">{t("record.backToVerify")}</Link>
      </p>
    </section>
  );
}
