import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiPostForm } from "../lib/authApi";
import { compressImage } from "../lib/compressImage";
import { setPageMeta } from "../lib/seo";

type Programme = "THREE_MONTH" | "FOUR_MONTH" | "FIVE_MONTH" | "SIX_MONTH";

export function ApplyPage() {
  const t = useT();
  const { user, loading, markHasProfile, refresh } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [address, setAddress] = useState("");
  const [programme, setProgramme] = useState<Programme>("THREE_MONTH");
  const [classMode, setClassMode] = useState<"PHYSICAL" | "ONLINE">("PHYSICAL");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageMeta({ title: t("apply.metaTitle"), description: t("apply.title") });
  }, [t]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user?.hasProfile) navigate("/dashboard/payment", { replace: true });
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
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!photo) { setError(t("apply.needPhoto")); return; }
    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!phone.trim()) { setError("Phone number is required"); return; }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("fullName", fullName.trim());
      form.append("phone", phone.trim());
      if (parentPhone.trim()) form.append("parentPhone", parentPhone.trim());
      if (address.trim()) form.append("address", address.trim());
      form.append("programme", programme);
      form.append("classMode", classMode);
      form.append("photo", photo);

      await apiPostForm("/api/student/apply", form);
      markHasProfile();
      void refresh();
      navigate("/dashboard/payment", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error");
      if (/already submitted/i.test(msg)) {
        markHasProfile();
        void refresh();
        navigate("/dashboard/payment", { replace: true });
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel" aria-busy="true">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }
  if (!user) return null;

  return (
    <section className="panel apply-page studio-page">
      <p className="home-kicker">{t("apply.kicker")}</p>
      <h1 className="apply-title">{t("apply.title")}</h1>
      <p className="lede">
        {t("apply.lede")}{" "}
        <Link to="/curriculum">{t("curriculum.title")}</Link>
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="apply-form" onSubmit={handleSubmit}>
        <div className="apply-photo">
          <label className="apply-photo__card">
            <input type="file" accept="image/*" onChange={handlePhoto} required />
            {photoPreview ? (
              <img src={photoPreview} alt="" />
            ) : (
              <span className="apply-photo__empty" aria-hidden>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 19.2c1.6-3.2 3.8-4.7 7-4.7s5.4 1.5 7 4.7" />
                </svg>
              </span>
            )}
            <span className="apply-photo__cta">{photoPreview ? t("apply.photoChange") : t("apply.photo")}</span>
          </label>
          <p className="form-hint">{t("apply.photoHint")}</p>
        </div>

        <div className="form-row">
          <label className="form-label">
            {t("apply.email")}
            <input type="email" value={user.email} disabled className="form-input" />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            {t("apply.fullName")} *
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              required minLength={2} maxLength={120} className="form-input" placeholder="Your full legal name" />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            {t("apply.phone")} *
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              required minLength={5} maxLength={32} className="form-input" placeholder="+234..." />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            {t("apply.parentPhone")}
            <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
              maxLength={32} className="form-input" placeholder="+234..." />
          </label>
        </div>

        <div className="form-row">
          <label className="form-label">
            {t("apply.address")}
            <textarea value={address} onChange={(e) => setAddress(e.target.value)}
              maxLength={500} className="form-input form-textarea" placeholder="Your home or office address" rows={3} />
          </label>
        </div>

        <fieldset className="programme-choice">
          <legend>{t("apply.programme")} *</legend>

          <label className={`programme-card ${programme === "THREE_MONTH" ? "selected" : ""}`}>
            <input type="radio" name="programme" value="THREE_MONTH" checked={programme === "THREE_MONTH"}
              onChange={() => setProgramme("THREE_MONTH")} />
            <div className="programme-card__content">
              <h3>{t("apply.prog.3")}</h3>
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
              <h3>{t("apply.prog.4")}</h3>
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
              <h3>{t("apply.prog.5")}</h3>
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
              <h3>{t("apply.prog.6")}</h3>
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
          <legend>{t("apply.classMode")} *</legend>
          <label className={`programme-card ${classMode === "PHYSICAL" ? "selected" : ""}`}>
            <input type="radio" name="classMode" value="PHYSICAL" checked={classMode === "PHYSICAL"}
              onChange={() => setClassMode("PHYSICAL")} />
            <div className="programme-card__content">
              <h3>{t("apply.physical")}</h3>
              <p className="programme-card__price">In-person sessions</p>
            </div>
          </label>
          <label className={`programme-card ${classMode === "ONLINE" ? "selected" : ""}`}>
            <input type="radio" name="classMode" value="ONLINE" checked={classMode === "ONLINE"}
              onChange={() => setClassMode("ONLINE")} />
            <div className="programme-card__content">
              <h3>{t("apply.online")}</h3>
              <p className="programme-card__price">Remote sessions</p>
            </div>
          </label>
        </fieldset>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? t("apply.submitting") : t("apply.submit")}
        </button>
      </form>
    </section>
  );
}
