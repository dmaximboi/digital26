import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { renderGoogleSignInButton } from "../lib/googleSignIn";
import { setPageMeta } from "../lib/seo";

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l6.3 5.3C37.4 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SignInPage() {
  const t = useT();
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const btnRef = useRef<HTMLDivElement>(null);
  const signInRef = useRef(signIn);
  const tRef = useRef(t);
  signInRef.current = signIn;
  tRef.current = t;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retryVisible, setRetryVisible] = useState(false);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    setPageMeta({ title: t("signin.title"), description: t("signin.lede") });
  }, [t]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin", { replace: true });
    } else if (user.hasProfile) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/apply", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function mountButton() {
      setReady(false);
      setRetryVisible(false);
      setError("");

      const waits = [0, 600, 1400, 2800, 4500];
      for (const wait of waits) {
        if (cancelled) return;
        if (wait) await sleep(wait);
        try {
          const ok = await renderGoogleSignInButton(btnRef.current, async (credential) => {
            setError("");
            try {
              await signInRef.current(credential);
            } catch (err) {
              setError(err instanceof Error ? err.message : tRef.current("signin.failed"));
            }
          });
          if (cancelled) return;
          if (ok) {
            setReady(true);
            return;
          }
        } catch {
          // Keep waiting. Ads traffic should not see a config error flash.
        }
      }

      if (!cancelled) {
        setReady(true);
        setRetryVisible(true);
      }
    }

    void mountButton();
    return () => {
      cancelled = true;
    };
  }, [mountKey]);

  return (
    <section className="panel signin-page studio-page">
      <div className="signin-card">
        <p className="home-kicker">{t("signin.kicker")}</p>
        <h1 className="signin-title">{t("signin.title")}</h1>
        <p className="lede">{t("signin.lede")}</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="google-btn-slot">
          {!ready && (
            <p className="muted signin-wait" role="status">
              {t("signin.loadingConfig")}
            </p>
          )}
          <div className="google-signin">
            <div className="google-face" aria-hidden="true">
              <GoogleMark />
              <span>{t("signin.google")}</span>
            </div>
            <div className="google-btn-wrap" ref={btnRef} />
          </div>
          {retryVisible && (
            <div className="signin-retry">
              <p className="muted">{t("signin.retryHint")}</p>
              <button
                type="button"
                className="btn"
                onClick={() => setMountKey((n) => n + 1)}
              >
                {t("signin.retry")}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
