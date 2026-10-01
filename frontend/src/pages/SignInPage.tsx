import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { loadGoogleClientId, loadGsiScript } from "../lib/googleSignIn";
import { setPageMeta } from "../lib/seo";

export function SignInPage() {
  const t = useT();
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const btnRef = useRef<HTMLDivElement>(null);
  const initedRef = useRef(false);
  const signInRef = useRef(signIn);
  const tRef = useRef(t);
  signInRef.current = signIn;
  tRef.current = t;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

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
    initedRef.current = false;

    async function mountButton() {
      try {
        void loadGsiScript();
        const clientId = await loadGoogleClientId();
        if (cancelled) return;
        if (!clientId) {
          setError(tRef.current("signin.configError"));
          setReady(true);
          return;
        }

        const gsi = await loadGsiScript();
        if (cancelled) return;
        if (!btnRef.current || initedRef.current) {
          setReady(true);
          return;
        }

        initedRef.current = true;
        gsi.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            setError("");
            try {
              await signInRef.current(response.credential);
            } catch (err) {
              setError(err instanceof Error ? err.message : tRef.current("signin.failed"));
            }
          },
          ux_mode: "popup",
        });
        gsi.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          width: 320,
          shape: "pill",
          text: "signin_with",
        });
        setReady(true);
      } catch {
        if (!cancelled) {
          setError(tRef.current("signin.configError"));
          setReady(true);
        }
      }
    }

    void mountButton();
    return () => {
      cancelled = true;
      initedRef.current = false;
      if (btnRef.current) btnRef.current.innerHTML = "";
    };
  }, []);

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
        {!ready && !error && (
          <p className="muted signin-wait" role="status">
            {t("signin.loadingConfig")}
          </p>
        )}
        <div className="google-btn-wrap" ref={btnRef} />
      </div>
    </section>
  );
}
