import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiPostForm } from "../lib/authApi";
import { DocBrandHeader } from "../components/BrandMark";
import { CertificateArt } from "../components/CertificateArt";
import { OneTimeTemplateDownload } from "../components/OneTimeTemplateDownload";
import { PublicRecordQr } from "../components/PublicRecordQr";
import { compressImage } from "../lib/compressImage";
import { programmeLabel, programmeShort, type ProgrammeCode } from "../lib/programme";
import { siteUrl } from "../lib/seo";

type ApprovedStudent = {
  id: string;
  fullName: string;
  email: string;
  programme: ProgrammeCode;
  customMonths?: number | null;
  photoUrl: string | null;
};

type IssueResult = {
  ok: boolean;
  publicId: string;
  type: string;
  course: string;
  studentName: string;
  studentEmail: string;
  photoUrl?: string | null;
  issueDate?: string;
  verifyUrl: string;
  pdfUrl: string | null;
  canDownloadTemplatePng?: boolean;
  downloadToken?: string | null;
};

export function AdminIssueCertificatePage() {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState("COMPLETION");
  const [programme, setProgramme] = useState<ProgrammeCode>("THREE_MONTH");
  const [customMonths, setCustomMonths] = useState("8");
  const [together, setTogether] = useState<File | null>(null);
  const [portrait, setPortrait] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    if (!user?.canWrite) return;
    apiFetch<{ items: ApprovedStudent[] }>("/api/ops/approved-students")
      .then((d) => setStudents(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingStudents(false));
  }, [user?.canWrite]);

  const selected = students.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setProgramme(selected.programme || "THREE_MONTH");
    setCustomMonths(String(selected.customMonths || 8));
    setPortraitPreview(selected.photoUrl);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <p className="muted">Loading...</p>;
  if (!user?.canWrite) return <Navigate to="/admin/certificates" replace />;

  async function pickTogether(file: File | null) {
    if (!file) {
      setTogether(null);
      return;
    }
    setTogether(await compressImage(file));
  }

  async function pickPortrait(file: File | null) {
    if (!file) {
      setPortrait(null);
      setPortraitPreview(selected?.photoUrl ?? null);
      return;
    }
    const compressed = await compressImage(file);
    setPortrait(compressed);
    const reader = new FileReader();
    reader.onload = () => setPortraitPreview(reader.result as string);
    reader.readAsDataURL(compressed);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!selectedId) {
      setError("Select a student");
      return;
    }
    if (!together) {
      setError("Upload a photo of admin and student together");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("studentProfileId", selectedId);
      form.append("type", type);
      form.append("programme", programme);
      if (programme === "CUSTOM") form.append("customMonths", customMonths);
      form.append("issueDate", issueDate);
      form.append("together", together);
      if (portrait) form.append("portrait", portrait);
      const data = await apiPostForm<IssueResult>("/api/ops/certificates", form);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel nested">
      <DocBrandHeader title="Issue Certificate" />
      <p className="lede">
        Select an approved student. You can change their programme duration and passport image
        before issuing. Upload one admin + student together photo for evidence.
      </p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Approved Student
          {loadingStudents ? (
            <p className="muted">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="muted">No approved students found. Approve students first.</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email}) - {programmeShort(s.programme, s.customMonths ?? null)}
                </option>
              ))}
            </select>
          )}
        </label>

        {selected && (
          <div className="selected-student-preview">
            {(portraitPreview || selected.photoUrl) && (
              <img
                src={portraitPreview || selected.photoUrl || ""}
                alt={selected.fullName}
                className="student-thumb"
              />
            )}
            <div>
              <strong>{selected.fullName}</strong>
              <p className="muted">{selected.email}</p>
              <p className="programme-badge">{programmeLabel(programme, Number(customMonths) || null)}</p>
            </div>
          </div>
        )}

        <label>
          Programme duration (editable)
          <select
            value={programme}
            onChange={(e) => setProgramme(e.target.value as ProgrammeCode)}
            disabled={loading || !selected}
          >
            <option value="THREE_MONTH">3-Month Intensive</option>
            <option value="FOUR_MONTH">4-Month Advanced</option>
            <option value="FIVE_MONTH">5-Month Accelerated</option>
            <option value="SIX_MONTH">6-Month Standard</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>

        {programme === "CUSTOM" && (
          <label>
            Custom months
            <input
              type="number"
              min={1}
              max={24}
              value={customMonths}
              onChange={(e) => setCustomMonths(e.target.value)}
              disabled={loading}
            />
          </label>
        )}

        <label>
          Certificate Type
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
            <option value="COMPLETION">Completion</option>
            <option value="PARTICIPATION">Participation</option>
          </select>
        </label>

        <label>
          Issue date
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
            disabled={loading}
          />
        </label>

        <fieldset className="evidence-block" disabled={loading}>
          <legend>Student passport / portrait (optional override)</legend>
          <p className="muted">Leave empty to use the student&apos;s registered photo on the certificate.</p>
          <label className="evidence-field">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void pickPortrait(e.target.files?.[0] ?? null)}
            />
            <span className="muted">{portrait ? portrait.name : "Using registered photo"}</span>
          </label>
        </fieldset>

        <fieldset className="evidence-block" disabled={loading}>
          <legend>Admin + Student photo</legend>
          <p className="muted">Upload 1 photo of you (admin) and the student together.</p>
          <label className="evidence-field">
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void pickTogether(e.target.files?.[0] ?? null)}
            />
            <span className="muted">{together ? together.name : "Not selected"}</span>
          </label>
        </fieldset>

        <button
          className="btn primary"
          type="submit"
          disabled={loading || !selectedId || !together}
        >
          {loading ? "Issuing..." : "Issue Certificate"}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {result && (
        <article className="result-card">
          <p>Certificate issued successfully. The student has been emailed.</p>
          <dl>
            <div>
              <dt>Student</dt>
              <dd>
                {result.studentName} ({result.studentEmail})
              </dd>
            </div>
            <div>
              <dt>Public ID</dt>
              <dd>
                <Link to={`/verify/${result.publicId}`}>{result.publicId}</Link>
              </dd>
            </div>
            <div>
              <dt>Course</dt>
              <dd>{result.course}</dd>
            </div>
          </dl>

          <div className="verify-cert-wrap" style={{ marginTop: "1.25rem" }}>
            <CertificateArt
              publicId={result.publicId}
              displayName={result.studentName}
              type={result.type}
              course={result.course}
              issueDate={result.issueDate || new Date().toISOString()}
              photoUrl={result.photoUrl}
              verifyUrl={result.verifyUrl || siteUrl(`/verify/${result.publicId}`)}
            />
          </div>
          <PublicRecordQr url={result.verifyUrl || siteUrl(`/verify/${result.publicId}`)} />
          <OneTimeTemplateDownload
            kind="certificate"
            publicId={result.publicId}
            available={Boolean(result.canDownloadTemplatePng)}
            downloadToken={result.downloadToken}
            onConsumed={() =>
              setResult((prev) =>
                prev ? { ...prev, canDownloadTemplatePng: false, downloadToken: null } : prev,
              )
            }
          />
        </article>
      )}
    </section>
  );
}
