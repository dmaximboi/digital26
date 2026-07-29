import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiPostForm } from "../lib/authApi";
import { DocBrandHeader } from "../components/BrandMark";
import { compressImage } from "../lib/compressImage";

type ApprovedStudent = {
  id: string;
  fullName: string;
  email: string;
  programme: "FIVE_MONTH" | "SIX_MONTH";
  photoUrl: string | null;
};

type IssueResult = {
  ok: boolean;
  publicId: string;
  type: string;
  course: string;
  studentName: string;
  studentEmail: string;
  verifyUrl: string;
  pdfUrl: string | null;
};

export function AdminIssueCertificatePage() {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState("COMPLETION");
  const [together, setTogether] = useState<File | null>(null);
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

  if (authLoading) return <p className="muted">Loading...</p>;
  if (!user?.canWrite) return <Navigate to="/admin/certificates" replace />;

  const selected = students.find((s) => s.id === selectedId) ?? null;

  async function pick(file: File | null) {
    if (!file) { setTogether(null); return; }
    setTogether(await compressImage(file));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!selectedId) { setError("Select a student"); return; }
    if (!together) { setError("Upload a photo of admin and student together"); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("studentProfileId", selectedId);
      form.append("type", type);
      form.append("together", together);
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
        Select an approved student to issue their certificate. The student's registered name,
        photo, and programme are used automatically. Upload one photo of admin + student together.
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
                  {s.fullName} ({s.email}) - {s.programme === "FIVE_MONTH" ? "5M" : "6M"}
                </option>
              ))}
            </select>
          )}
        </label>

        {selected && (
          <div className="selected-student-preview">
            {selected.photoUrl && (
              <img src={selected.photoUrl} alt={selected.fullName} className="student-thumb" />
            )}
            <div>
              <strong>{selected.fullName}</strong>
              <p className="muted">{selected.email}</p>
              <p className="programme-badge">
                {selected.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard"}
              </p>
            </div>
          </div>
        )}

        <label>
          Certificate Type
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
            <option value="COMPLETION">Completion</option>
            <option value="PARTICIPATION">Participation</option>
          </select>
        </label>

        <fieldset className="evidence-block" disabled={loading}>
          <legend>Admin + Student photo</legend>
          <p className="muted">Upload 1 photo of you (admin) and the student together.</p>
          <label className="evidence-field">
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void pick(e.target.files?.[0] ?? null)}
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
              <dd>{result.studentName} ({result.studentEmail})</dd>
            </div>
            <div>
              <dt>Public ID</dt>
              <dd>
                <a href={`/verify/${result.publicId}`}>{result.publicId}</a>
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>Certificate of {result.type === "COMPLETION" ? "Completion" : "Participation"}</dd>
            </div>
            <div>
              <dt>Course</dt>
              <dd>{result.course}</dd>
            </div>
          </dl>
        </article>
      )}
    </section>
  );
}
