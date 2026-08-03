import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type PaymentStatus = {
  amountUsd: string;
  label: string;
  registrationPaid: boolean;
  registrationPaidAt: string | null;
  adminApproved: boolean;
  rejected: boolean;
  studentStatus: "PENDING" | "APPROVED" | "REJECTED";
  paymentsEnabled: boolean;
  canPay: boolean;
  fullyActive: boolean;
  profile: {
    fullName: string;
    programme: string;
    classMode: "PHYSICAL" | "ONLINE";
  };
  latestOrder: {
    id: string;
    status: string;
    amountUsd: string;
    reference: string;
    checkoutId: string | null;
    paidAt: string | null;
    createdAt: string;
  } | null;
};

export function StudentPaymentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [fetching, setFetching] = useState(true);
  const [payBusy, setPayBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setPageMeta({
      title: "Registration payment The Digital 26",
      description: "Pay the one-time student registration fee.",
    });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const data = await apiFetch<PaymentStatus>("/api/student/payments/status");
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin", { replace: true });
      return;
    }
    if (!user.hasProfile) {
      navigate("/apply", { replace: true });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id");
    const paid = params.get("paid");
    const cancelled = params.get("cancelled");

    (async () => {
      setFetching(true);
      setError("");
      try {
        if (checkoutId) {
          await apiFetch("/api/student/payments/sync", {
            method: "POST",
            body: JSON.stringify({ checkout_id: checkoutId }),
          });
          setNotice("Payment confirmed. Updating your account…");
        } else if (paid === "1") {
          setNotice("Returning from checkout — confirming payment…");
          await new Promise((r) => setTimeout(r, 1200));
        } else if (cancelled === "1") {
          setNotice("Checkout cancelled. You can try again whenever you’re ready.");
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load payment status");
      } finally {
        setFetching(false);
        if (checkoutId || paid || cancelled) {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          url.searchParams.delete("paid");
          url.searchParams.delete("cancelled");
          window.history.replaceState({}, "", url.pathname);
        }
      }
    })();
  }, [user, navigate, load]);

  async function startPayment() {
    if (payBusy) return;
    setPayBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch<{
        checkoutUrl?: string;
        alreadyPaid?: boolean;
      }>("/api/student/payments/registration", {
        method: "POST",
        body: "{}",
      });
      if (data.alreadyPaid) {
        await load();
        setNotice("Registration is already paid.");
        setPayBusy(false);
        return;
      }
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment");
      setPayBusy(false);
    }
  }

  if (loading || fetching) {
    return (
      <section className="panel payment-page" aria-busy="true">
        <p className="muted">Loading payment…</p>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel payment-page">
        <h1>Registration payment</h1>
        <p className="status error">{error || "Could not load payment status."}</p>
        <Link className="btn" to="/dashboard">Back to dashboard</Link>
      </section>
    );
  }

  return (
    <section className="panel payment-page">
      <p className="payment-page__eyebrow">Student billing</p>
      <h1>Registration payment</h1>
      <p className="lede">
        One-time fee for {status.profile.fullName}. Amount is fixed in USD; Bachs converts to your
        local currency at secure checkout.
      </p>

      <div className="payment-hero">
        <div>
          <span className="payment-hero__label">Amount due</span>
          <strong className="payment-hero__amount">
            {status.registrationPaid ? "Paid" : `$${status.amountUsd}`}
          </strong>
          <span className="payment-hero__sub">
            {status.registrationPaid
              ? status.registrationPaidAt
                ? `Paid ${new Date(status.registrationPaidAt).toLocaleString()}`
                : "Registration fee settled"
              : "USD · charged in local currency"}
          </span>
        </div>
        <span
          className={`payment-badge ${status.registrationPaid ? "ok" : "due"}`}
        >
          {status.registrationPaid ? "Paid" : "Unpaid"}
        </span>
      </div>

      <ul className="payment-steps">
        <li className={status.adminApproved ? "done" : status.rejected ? "bad" : ""}>
          <strong>Admin review</strong>
          <span>
            {status.rejected
              ? "Application not approved"
              : status.adminApproved
                ? "Approved"
                : "Waiting for admin"}
          </span>
        </li>
        <li className={status.registrationPaid ? "done" : ""}>
          <strong>Registration fee</strong>
          <span>{status.registrationPaid ? "Paid" : `Pay $${status.amountUsd}`}</span>
        </li>
        <li className={status.fullyActive ? "done" : ""}>
          <strong>Class access</strong>
          <span>
            {status.fullyActive
              ? "Attendance & chat unlocked"
              : "Unlocks after both steps above"}
          </span>
        </li>
      </ul>

      {notice && <p className="payment-notice">{notice}</p>}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {!status.paymentsEnabled && !status.registrationPaid && (
        <p className="status error" role="alert">
          Online payments are not configured on the server yet. Contact admin.
        </p>
      )}

      {status.rejected ? (
        <p className="muted">
          Rejected applications cannot pay. <Link to="/contact">Contact us</Link> if this is a mistake.
        </p>
      ) : status.registrationPaid ? (
        <div className="payment-actions">
          {status.fullyActive ? (
            <Link className="btn primary" to="/dashboard">
              Go to class dashboard
            </Link>
          ) : (
            <p className="muted">Payment received. Waiting for admin approval to unlock class.</p>
          )}
          <Link className="btn" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <div className="payment-actions">
          <button
            type="button"
            className="btn primary payment-cta"
            disabled={!status.canPay || payBusy}
            onClick={() => void startPayment()}
          >
            {payBusy ? "Opening secure checkout…" : `Pay $${status.amountUsd} registration`}
          </button>
          <p className="muted payment-secure-note">
            Checkout is hosted by Bachs. We never see your card or bank details. Fee amount is set
            by the server and cannot be changed in the browser.
          </p>
          <Link className="btn" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      )}

      {status.latestOrder && (
        <div className="payment-receipt">
          <h2>Latest order</h2>
          <p><strong>Reference:</strong> {status.latestOrder.reference}</p>
          <p><strong>Status:</strong> {status.latestOrder.status}</p>
          <p><strong>Amount:</strong> ${status.latestOrder.amountUsd} USD</p>
          {status.latestOrder.paidAt && (
            <p><strong>Paid at:</strong> {new Date(status.latestOrder.paidAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </section>
  );
}
