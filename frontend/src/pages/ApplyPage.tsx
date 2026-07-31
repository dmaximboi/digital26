import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiPostForm } from "../lib/authApi";
import { compressImage } from "../lib/compressImage";
import { setPageMeta } from "../lib/seo";

type Programme = "THREE_MONTH" | "FOUR_MONTH" | "FIVE_MONTH" | "SIX_MONTH";

export function ApplyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [address, setAddress] = useState("");
  const [programme, setProgramme] = useState<Programme>("THREE_MONTH");
  const [classMode, setClassMode] = useState<"PHYSICAL" | "ONLINE">("PHYSICAL");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageMeta({ title: "Apply The Digital 26", description: "Apply to join The Digital 26 Vibe Coding programme." });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user?.hasProfile) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user?.email) setFullName(user.name || "");
  }, [user]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    setError("");
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      setPhoto(null);
      setPhotoPreview(null);
      setError(err instanceof Error ? err.message : "Could not process photo");
    }
  }

  async function sendOtp() {
    if (otpBusy) return;
    setError("");
    setOtpBusy(true);
    try {
      await apiFetch("/api/student/apply/otp", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!photo) { setError("Please upload your passport photo"); return; }
    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!phone.trim()) { setError("Phone number is required"); return; }
    if (!otpCode || otpCode.length !== 6) { setError("Enter the 6-digit verification code"); return; }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("fullName", fullName.trim());
      form.append("phone", phone.trim());
      form.append("parentPhone", parentPhone.trim());
      form.append("address", address.trim());
      form.append("programme", programme);
      form.append("classMode", classMode);
      form.append("otpCode", otpCode);
      form.append("photo", photo);

      await apiPostForm("/api/student/apply", form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <section className="panel" aria-busy="true"><p className="muted">Loading...</p></section>;
  if (!user) return null;

  return (
    <section className="panel apply-page">
      <h1 className="apply-title">Apply to The Digital 26</h1>
      <p className="lede">Fill in your details to join our Vibe Coding programme. Your account will be reviewed by an admin.</p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="apply-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">
            Email (from Google)
            <input type="email" value={user.email} disabled className="form-input" />
          </label>
        </div>

        <div className="form-row otp-verify-row">
          <p className="form-label">Verify your email</p>
          <div className="otp-block">
            <button
              className="btn"
              type="button"
              disabled={otpBusy || busy}
              onClick={() => void sendOtp()}
            >
              {otpBusy ? "Sending..." : otpSent ? "Resend code" : "Send verification code"}
            </button>
            {otpSent && (
              <p className="muted">
                Code sent to {user.email}. Check inbox and spam folder.
              </p>
            )}
            <label className="otp-code-label">
              6-digit code
              <input
                className="otp-code-input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                disabled={busy}
              />
            </label>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Full Name *
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              required minLength={2} maxLength={120} className="form-input" placeholder="Your full legal name" />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            Phone Number *
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              required minLength={5} maxLength={32} className="form-input" placeholder="+234..." />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            Parent/Guardian Phone
            <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
              maxLength={32} className="form-input" placeholder="+234..." />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            Address
            <textarea value={address} onChange={(e) => setAddress(e.target.value)}
              maxLength={500} className="form-input form-textarea" placeholder="Your home or office address" rows={3} />
          </label>
        </div>

        <fieldset className="programme-choice">
          <legend>Choose Your Programme *</legend>

          <label className={`programme-card ${programme === "THREE_MONTH" ? "selected" : ""}`}>
            <input type="radio" name="programme" value="THREE_MONTH" checked={programme === "THREE_MONTH"}
              onChange={() => setProgramme("THREE_MONTH")} />
            <div className="programme-card__content">
              <h3>3-Month Intensive</h3>
              <p className="programme-card__price">Constant &amp; very much class</p>
              <ul className="programme-card__features">
                <li>3-year mentorship support</li>
                <li>High-frequency live classes</li>
                <li>Hands-on project shipping</li>
                <li>Priority mentor access</li>
                <li>Certificate of completion</li>
              </ul>
            </div>
          </label>

          <label className={`programme-card ${programme === "FOUR_MONTH" ? "selected" : ""}`}>
            <input type="radio" name="programme" value="FOUR_MONTH" checked={programme === "FOUR_MONTH"}
              onChange={() => setProgramme("FOUR_MONTH")} />
            <div className="programme-card__content">
              <h3>4-Month Advanced</h3>
              <p className="programme-card__price">Impressive learning &amp; vast schedule</p>
              <ul className="programme-card__features">
                <li>2-year mentorship support</li>
                <li>Richer curriculum than 3-month</li>
                <li>Broader weekly schedule</li>
                <li>1-on-1 project reviews</li>
                <li>Certificate of completion</li>
              </ul>
            </div>
          </label>

          <label className={`programme-card ${programme === "FIVE_MONTH" ? "selected" : ""}`}>
            <input type="radio" name="programme" value="FIVE_MONTH" checked={programme === "FIVE_MONTH"}
              onChange={() => setProgramme("FIVE_MONTH")} />
            <div className="programme-card__content">
              <h3>5-Month Accelerated</h3>
              <p className="programme-card__price">Intensive Vibe Coding</p>
              <ul className="programme-card__features">
                <li>1-year mentorship support</li>
                <li>Priority 1-on-1 project reviews</li>
                <li>Weekly live Q&A with mentor</li>
                <li>Premium templates &amp; resources</li>
                <li>Fast-track career support</li>
              </ul>
            </div>
          </label>

          <label className={`programme-card ${programme === "SIX_MONTH" ? "selected" : ""}`}>
            <input type="radio" name="programme" value="SIX_MONTH" checked={programme === "SIX_MONTH"}
              onChange={() => setProgramme("SIX_MONTH")} />
            <div className="programme-card__content">
              <h3>6-Month Standard</h3>
              <p className="programme-card__price">Complete Vibe Coding</p>
              <ul className="programme-card__features">
                <li>6-month mentorship support</li>
                <li>Self-paced project reviews</li>
                <li>Recorded session access</li>
                <li>Standard templates &amp; resources</li>
                <li>Certificate of completion</li>
              </ul>
            </div>
          </label>
        </fieldset>

        <fieldset className="programme-choice class-mode-choice">
          <legend>Class Mode *</legend>
          <label className={`programme-card ${classMode === "PHYSICAL" ? "selected" : ""}`}>
            <input type="radio" name="classMode" value="PHYSICAL" checked={classMode === "PHYSICAL"}
              onChange={() => setClassMode("PHYSICAL")} />
            <div className="programme-card__content">
              <h3>Physical Class</h3>
              <p className="programme-card__price">In-person sessions</p>
            </div>
          </label>
          <label className={`programme-card ${classMode === "ONLINE" ? "selected" : ""}`}>
            <input type="radio" name="classMode" value="ONLINE" checked={classMode === "ONLINE"}
              onChange={() => setClassMode("ONLINE")} />
            <div className="programme-card__content">
              <h3>Online Class</h3>
              <p className="programme-card__price">Remote sessions</p>
            </div>
          </label>
        </fieldset>

        <div className="form-row">
          <label className="form-label">
            Passport/Portrait Photo *
            <p className="form-hint">This image will be used on your certificate</p>
            <input type="file" accept="image/*" onChange={handlePhoto} className="form-input" required />
          </label>
          {photoPreview && (
            <div className="photo-preview">
              <img src={photoPreview} alt="Preview" />
            </div>
          )}
        </div>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </section>
  );
}
