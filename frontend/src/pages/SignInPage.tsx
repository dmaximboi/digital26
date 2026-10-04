import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { renderGoogleSignInButton } from "../lib/googleSignIn";
import { setPageMeta } from "../lib/seo";

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
        <div className="google-btn-wrap" ref={btnRef} />
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
    </section>
  );
}
