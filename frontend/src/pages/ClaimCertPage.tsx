import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { CertificateArt } from "../components/CertificateArt";
import { apiGet, apiPost, apiPostForm } from "../lib/api";
import { compressImage } from "../lib/compressImage";

type Status =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "consumed"; publicId?: string | null; publicUrl?: string | null }
  | {
      status: "pending_claim";
      type: string;
      course: string;
      issueDate: string;
      expiresAt: string;
      emailLocked?: boolean;
    };

const SITE =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online";

export function ClaimCertPage() {
  const { sessionId = "" } = useParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ publicId: string; publicUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpBusy, setOtpBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Status>(`/api/claim-cert/${encodeURIComponent(sessionId)}/status`)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ status: "invalid" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function onPhoto(file: File | null) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (!file) {
      setPhoto(null);
      setPhotoUrl(null);
      return;
    }
    setError(null);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPhotoUrl(URL.createObjectURL(compressed));
    } catch (err) {
      setPhoto(null);
      setPhotoUrl(null);
      setError(err instanceof Error ? err.message : "Could not process image");
    }
  }

  async function sendOtp() {
    if (otpBusy) return;
    setError(null);
    setOtpBusy(true);
    try {
      await apiPost(`/api/claim-cert/${encodeURIComponent(sessionId)}/otp/request`, {
        email,
      });
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setOtpBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitBusy) return;
    setError(null);
    if (!photo) {
      setError("Upload your student passport/portrait photo.");
      return;
    }
    if (!evidence) {
      setError("Upload 1 evidence image (chat, receipt, or classroom proof).");
      return;
    }
    setSubmitBusy(true);
    try {
      const form = new FormData();
      form.append("fullName", fullName);
      form.append("email", email);
      form.append("phone", phone);
      form.append("otpCode", otpCode);
      form.append("photo", photo);
      form.append("evidence", evidence);

      const data = await apiPostForm<{ publicId: string; publicUrl: string }>(
        `/api/claim-cert/${encodeURIComponent(sessionId)}/submit`,
        form,
      );
      setDone({ publicId: data.publicId, publicUrl: data.publicUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p>Checking claim link…</p>
      </section>
    );
  }

  if (!status || status.status === "invalid") {
    return (
      <section className="panel">
        <DocBrandHeader title="Invalid claim link" />
        <p className="lede">This certificate claim link is not valid.</p>
      </section>
    );
  }

  if (status.status === "expired") {
    return (
      <section className="panel">
        <DocBrandHeader title="Link expired" />
        <p className="lede">This claim link was valid for 24 hours and has expired.</p>
      </section>
    );
  }

  if (status.status === "consumed" || done) {
    const publicId =
      done?.publicId || (status.status === "consumed" ? status.publicId : null);
    const rawUrl =
      done?.publicUrl ||
      (status.status === "consumed" ? status.publicUrl : null) ||
      (publicId ? `/verify/${publicId}` : null);
    const path =
      rawUrl && rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
    return (
      <section className="panel">
        <DocBrandHeader title="Certificate confirmed" />
        <p className="lede">
          Your acknowledgement is complete. This link can no longer be edited.
        </p>
        {path && (
          <p>
            <Link className="btn primary" to={path}>
              View public certificate
            </Link>
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="panel claim-layout">
      <DocBrandHeader title="Acknowledge certificate" />
      <p className="lede">
        Use the same email you were invited with. Link expires{" "}
        {new Date(status.expiresAt).toLocaleString()}.
      </p>
      <p className="muted">
        {status.type} · {status.course} ·{" "}
        {new Date(status.issueDate).toLocaleDateString()}
      </p>

      <div className="claim-grid">
        <form className="sign-form claim-form" onSubmit={onSubmit}>
          <label>
            Full name (on certificate)
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={submitBusy}
            />
          </label>

          <label>
            Email (must match invite)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitBusy}
            />
          </label>

          <label>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803…"
              required
              disabled={submitBusy}
            />
          </label>

          <div className="otp-block">
            <button
              className="btn"
              type="button"
              disabled={otpBusy || submitBusy || !email}
              onClick={() => void sendOtp()}
            >
              {otpBusy ? "Sending…" : otpSent ? "Resend code" : "Send email code"}
            </button>
            {otpSent && (
              <p className="muted">
                Code sent. Check inbox and Spam / Junk. In Gmail, mark Not spam and add the sender
                to Contacts.
              </p>
            )}
            <label className="otp-code-label">
              6-digit code
              <input
                className="otp-code-input"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                disabled={submitBusy}
              />
            </label>
          </div>

          <div className="photo-field">
            <p className="photo-field__label">Passport / portrait (on certificate)</p>
            <label className="photo-drop">
              {photoUrl ? (
                <img src={photoUrl} alt="Your upload" />
              ) : (
                <span>
                  <strong>Upload portrait</strong>
                  <em>Tap or drop an image · max 3MB</em>
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                required={!photo}
                disabled={submitBusy}
              />
            </label>
          </div>

          <label className="evidence-field">
            Evidence image (1) — separate from passport
            <input
              type="file"
              accept="image/*"
              required
              disabled={submitBusy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) {
                  setEvidence(null);
                  return;
                }
                void compressImage(f).then(setEvidence).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Could not process evidence");
                });
              }}
            />
          </label>

          <label className="check-row">
            <input type="checkbox" required disabled={submitBusy} />
            <span>I confirm my details are correct and acknowledge this certificate.</span>
          </label>

          <button className="btn primary" type="submit" disabled={submitBusy}>
            {submitBusy ? "Publishing…" : "Submit & publish"}
          </button>

          {error && (
            <p className="status error" role="alert">
              {error}
            </p>
          )}
        </form>

        <aside className="claim-preview">
          <p className="claim-preview__title">Live preview</p>
          <div className="claim-preview__frame">
            <CertificateArt
              displayName={fullName || "Your name"}
              type={status.type}
              course={status.course}
              issueDate={status.issueDate}
              photoUrl={photoUrl}
              verifyUrl={`${SITE}/verify/D26…cert`}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
