import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { setPageMeta } from "../lib/seo";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

export function SignInPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const initedRef = useRef(false);

  useEffect(() => {
    setPageMeta({ title: "Sign In", description: "Sign in with Google to access The Digital 26." });
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "ADMIN" || user.role === "READONLY") {
        navigate("/admin", { replace: true });
      } else if (user.hasProfile) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/apply", { replace: true });
      }
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/google-client-id`)
      .then((r) => r.json())
      .then((d: { clientId: string | null }) => setClientId(d.clientId))
      .catch(() => setError("Could not load sign-in configuration"));
  }, []);

  useEffect(() => {
    if (!clientId || !btnRef.current || initedRef.current) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as {
        google: {
          accounts: {
            id: {
              initialize: (opts: Record<string, unknown>) => void;
              renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
            };
          };
        };
      }).google;

      if (!g) return;
      initedRef.current = true;

      g.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          setError("");
          try {
            await signIn(response.credential);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed");
          }
        },
        ux_mode: "popup",
        use_fedcm_for_prompt: true,
      });

      g.accounts.id.renderButton(btnRef.current!, {
        theme: "filled_black",
        size: "large",
        width: 320,
        shape: "pill",
        text: "signin_with",
      });
    };
    document.head.appendChild(script);

    return () => { script.remove(); };
  }, [clientId, signIn]);

  if (loading) {
    return (
      <section className="panel" aria-busy="true">
        <p className="muted">Loading...</p>
      </section>
    );
  }

  return (
    <section className="panel signin-page">
      <h1 className="signin-title">Sign In</h1>
      <p className="lede">Sign in with your Google account to access The Digital 26.</p>

      {error && <p className="form-error" role="alert">{error}</p>}

      {!clientId && !error && <p className="muted">Loading Google Sign-In...</p>}

      <div className="google-btn-wrap" ref={btnRef} />
    </section>
  );
}
