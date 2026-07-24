import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPostForm } from "../lib/api";
import { DocBrandHeader } from "../components/BrandMark";
import { AgreementArt } from "../components/AgreementArt";
import { compressImage } from "../lib/compressImage";

type StatusResponse =
  | { status: "invalid"; error?: string }
  | { status: "consumed" }
  | { status: "expired" }
  | { status: "locked"; lockedUntil?: string }
  | {
      status: "pending_passkey";
      expiresAt: string;
    };

type UnlockResponse = {
  status: "unlocked";
  sessionId: string;
  terms: string;
  person: { name: string };
  emailLocked?: boolean;
  expiresAt: string;
};

const SITE =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online";

export function SignPage() {
  const { sessionId = "" } = useParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [passkey, setPasskey] = useState("");
  const [unlocked, setUnlocked] = useState<UnlockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dealTag, setDealTag] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [clientProofs, setClientProofs] = useState<File[]>([]);
  const [done, setDone] = useState<{ publicId: string; publicUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<StatusResponse>(`/api/sign/${encodeURIComponent(sessionId)}/status`)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({
            status: "invalid",
            error: err instanceof Error ? err.message : "Error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (unlockBusy) return;
    setError(null);
    setUnlockBusy(true);
    try {
      const data = await apiPost<UnlockResponse>(
        `/api/sign/${encodeURIComponent(sessionId)}/unlock`,
        { passkey },
      );
      setUnlocked(data);
      setFullName(data.person.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setUnlockBusy(false);
    }
  }

  async function onSendOtp() {
    if (otpBusy) return;
    setError(null);
    setOtpBusy(true);
    try {
      await apiPost(`/api/sign/${encodeURIComponent(sessionId)}/otp/request`, {
        email,
        passkey,
      });
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setOtpBusy(false);
    }
  }

  async function onClientProofs(list: FileList | null) {
    if (!list) {
      setClientProofs([]);
      return;
    }
    const files = Array.from(list).slice(0, 2);
    const out: File[] = [];
    for (const f of files) out.push(await compressImage(f));
    setClientProofs(out);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitBusy) return;
    setError(null);
    const tag = dealTag.trim();
    if (tag.length < 2 || tag.length > 50) {
      setError("Deal tag must be 2–50 characters.");
      return;
    }
    if (clientProofs.length !== 2) {
      setError("Upload exactly 2 proof images (chat, proposal, or payment screenshot).");
      return;
    }
    setSubmitBusy(true);
    try {
      const form = new FormData();
      form.append("passkey", passkey);
      form.append("fullName", fullName);
      form.append("dealTag", tag);
      form.append("phone", phone);
      form.append("phoneCountry", "NG");
      form.append("email", email);
      form.append("otpCode", otpCode);
      form.append("signatureName", signatureName);
      for (const f of clientProofs) form.append("clientProofs", f);
      const data = await apiPostForm<{ publicId: string; publicUrl: string }>(
        `/api/sign/${encodeURIComponent(sessionId)}/submit`,
        form,
      );
      setDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p>Checking link…</p>
      </section>
    );
  }

  if (!status || status.status === "invalid") {
    return (
      <section className="panel">
        <h1>Invalid link</h1>
        <p className="lede">This agreement letter link is not valid.</p>
      </section>
    );
  }

  if (status.status === "expired") {
    return (
      <section className="panel">
        <h1>Link expired</h1>
        <p className="lede">This agreement letter link has expired (24-hour limit).</p>
      </section>
    );
  }

  if (status.status === "consumed") {
    return (
      <section className="panel">
        <h1>Already used</h1>
        <p className="lede">
          This agreement letter was already signed. The link is closed and the public letter is
          permanent.
        </p>
      </section>
    );
  }

  if (status.status === "locked") {
    return (
      <section className="panel">
        <h1>Temporarily locked</h1>
        <p className="lede">Too many passkey attempts. Try again later.</p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="panel">
        <h1>Agreement letter confirmed</h1>
        <p className="lede">Your signing link has expired. Your public letter is ready.</p>
        <article className="result-card">
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{done.publicId}</dd>
            </div>
          </dl>
          <p>
            <Link className="btn primary" to={`/a/${done.publicId}`}>
              View agreement letter
            </Link>
          </p>
        </article>
      </section>
    );
  }

  if (!unlocked) {
    return (
      <section className="panel">
        <DocBrandHeader title="Unlock agreement letter" />
        <p className="lede">
          Enter the one-time passkey emailed to you. Valid for 24 hours — expires{" "}
          {new Date(status.expiresAt).toLocaleString()}.
        </p>
        <p className="muted">
          Cannot find the email? Check Spam / Junk / Promotions. In Gmail, mark Not spam and add the
          sender to Contacts.
        </p>
        <form className="lookup-form" onSubmit={onUnlock}>
          <label htmlFor="passkey">Passkey</label>
          <div className="lookup-row">
            <input
              id="passkey"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              autoComplete="one-time-code"
              required
              disabled={unlockBusy}
            />
            <button className="btn primary" type="submit" disabled={unlockBusy}>
              {unlockBusy ? "Checking…" : "Continue"}
            </button>
          </div>
        </form>
        {error && (
          <p className="status error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  const previewSig = signatureName || fullName || "Your signature";

  return (
    <section className="panel claim-layout">
      <DocBrandHeader title="Sign service agreement" />
      <p className="lede">
        Use the same email you were invited with. Tag the deal (max 50 characters), confirm details, and
        sign.
      </p>

      <pre className="terms-box">{unlocked.terms}</pre>

      <div className="claim-grid">
        <form className="sign-form claim-form" onSubmit={onSubmit}>
          <label>
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={submitBusy}
            />
          </label>

          <label>
            What is this about? (tag, max 50 characters)
            <input
              value={dealTag}
              onChange={(e) => setDealTag(e.target.value.slice(0, 50))}
              placeholder="e.g. Company website build"
              maxLength={50}
              required
              disabled={submitBusy}
            />
            <span className="muted">{dealTag.length}/50</span>
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

          <div className="otp-block">
            <button
              className="btn"
              type="button"
              disabled={otpBusy || submitBusy || !email}
              onClick={() => void onSendOtp()}
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

          <label>
            Sign your full name
            <input
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              required
              disabled={submitBusy}
            />
          </label>

          <label className="evidence-field">
            Your proofs (exactly 2 images — chat, proposal, or payment)
            <input
              type="file"
              accept="image/*"
              multiple
              required
              disabled={submitBusy}
              onChange={(e) => void onClientProofs(e.target.files)}
            />
            <span className="muted">{clientProofs.length}/2 selected</span>
          </label>

          <button className="btn primary" type="submit" disabled={submitBusy}>
            {submitBusy ? "Submitting…" : "Agree & submit"}
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
            <AgreementArt
              displayName={fullName || "Your name"}
              dealTag={dealTag || "Your engagement tag"}
              signedAt={new Date().toISOString()}
              signature={previewSig}
              checkUrl={`${SITE}/check-agreement/D26…agr`}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
