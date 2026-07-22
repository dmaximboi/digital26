import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../../lib/auth";
import { useAdminAuth } from "../../auth/AdminAuthContext";
import { DocBrandHeader } from "../../components/BrandMark";
import { useConsolePath } from "../../lib/adminPath";

export function AdminLoginPage() {
  const { path: consolePath } = useConsolePath();
  const { user, loading, refresh } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!consolePath) {
    return <Navigate to="/" replace />;
  }

  if (!loading && user) {
    return <Navigate to={`/${consolePath}`} replace />;
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
        setInfo(
          "If that account exists, a reset link was sent. Check inbox and Spam / Junk. In Gmail, mark Not spam and add the sender to Contacts.",
        );
        setBusy(false);
        return;
      }

      const result = await authClient.signIn.email({
        email: normalized,
        password,
      });

      if (result.error) {
        setError(result.error.message);
        setBusy(false);
        return;
      }

      await refresh();
      navigate(`/${consolePath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <DocBrandHeader title="Console" />
      <p className="lede">Sign in to continue.</p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
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
              autoComplete="current-password"
            />
          </label>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "reset" ? "Send reset link" : "Sign in"}
        </button>
      </form>

      <p className="lede">
        {mode === "signin" ? (
          <button type="button" className="linkish" onClick={() => setMode("reset")}>
            Forgot password
          </button>
        ) : (
          <button type="button" className="linkish" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
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
