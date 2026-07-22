import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../../lib/auth";
import { useAdminAuth } from "../../auth/AdminAuthContext";
import { DocBrandHeader } from "../../components/BrandMark";
import { getAdminPath } from "../../lib/adminPath";

export function AdminLoginPage() {
  const adminPath = getAdminPath();
  const { user, loading, refresh } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!adminPath) {
    return <Navigate to="/" replace />;
  }

  if (!loading && user) {
    return <Navigate to={`/${adminPath}`} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email.");
      setBusy(false);
      return;
    }

    try {
      if (mode === "reset") {
        const result = await authClient.requestPasswordReset(normalized);
        if (result.error) {
          setError(result.error.message);
          setBusy(false);
          return;
        }
        setInfo("If that account exists, a reset link was sent. Check your inbox.");
        setBusy(false);
        return;
      }

      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              name: normalized.split("@")[0] || "Admin",
              email: normalized,
              password,
            })
          : await authClient.signIn.email({
              email: normalized,
              password,
            });

      if (result.error) {
        setError(result.error.message);
        if (result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          setMode("signin");
        }
        setBusy(false);
        return;
      }

      await refresh();
      navigate(`/${adminPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <DocBrandHeader title="Admin login" />
      <p className="lede">
        Sign in with Neon Auth. Access is enforced on the server. Passwords are never stored in
        this app.
      </p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            placeholder="you@example.com"
          />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>

      <p className="lede">
        {mode === "signin" && (
          <>
            First time?{" "}
            <button type="button" className="linkish" onClick={() => setMode("signup")}>
              Sign up
            </button>
            {" · "}
            <button type="button" className="linkish" onClick={() => setMode("reset")}>
              Forgot password
            </button>
          </>
        )}
        {mode === "signup" && (
          <>
            Already registered?{" "}
            <button type="button" className="linkish" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
        {mode === "reset" && (
          <>
            Remembered it?{" "}
            <button type="button" className="linkish" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
      </p>

      {info && (
        <p className="status ok" role="status">
          {info}
        </p>
      )}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
