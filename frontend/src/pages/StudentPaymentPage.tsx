import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
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
    chargeId?: string | null;
    paidAt: string | null;
    createdAt: string;
  } | null;
  reconcile?: { checked: number; fulfilled: number } | null;
};

export function StudentPaymentPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [fetching, setFetching] = useState(true);
  const [payBusy, setPayBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setPageMeta({
      title: t("pay.title"),
      description: t("pay.metaDesc"),
    });
  }, [t]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const data = await apiFetch<PaymentStatus>("/api/student/payments/status");
    setStatus(data);
    return data;
  }, []);

  const reconcile = useCallback(async (checkoutId?: string | null) => {
    const body = checkoutId ? { checkout_id: checkoutId } : {};
    return apiFetch<{
      registrationPaid?: boolean;
      fullyActive?: boolean;
      reconcile?: { fulfilled: number };
    }>("/api/student/payments/reconcile", {
      method: "POST",
      body: JSON.stringify(body),
    });
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
    const cancelled = params.get("cancelled");
    const fromCheckout = Boolean(checkoutId || params.get("paid") === "1");
    let stopped = false;
    let timer: number | undefined;

    (async () => {
      setFetching(true);
      setError("");
      try {
        if (cancelled === "1") {
          setNotice(t("pay.notice.cancelled"));
        } else {
          setNotice("Verifying payment with Bachs…");
          const result = await reconcile(checkoutId);
          if (stopped) return;
          if (result.registrationPaid) {
            setNotice(t("pay.notice.verified"));
          } else if (fromCheckout) {
            setNotice(t("pay.notice.confirming"));
          } else {
            setNotice("");
          }
        }
        await load();
      } catch (err) {
        if (!stopped) {
          setError(err instanceof Error ? err.message : t("common.error"));
        }
      } finally {
        if (!stopped) setFetching(false);
        if (checkoutId || cancelled || params.get("paid")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          url.searchParams.delete("paid");
          url.searchParams.delete("cancelled");
          window.history.replaceState({}, "", url.pathname);
        }
      }

      if (!fromCheckout || stopped) return;

      let polls = 0;
      timer = window.setInterval(() => {
        polls += 1;
        void (async () => {
          try {
            const result = await reconcile(checkoutId);
            const data = await load();
            if (stopped) return;
            if (result.registrationPaid || data.registrationPaid || polls >= 8) {
              if (timer) window.clearInterval(timer);
              if (data.registrationPaid) {
                setNotice(t("pay.notice.verified"));
              }
            }
          } catch {
            if (polls >= 8 && timer) window.clearInterval(timer);
          }
        })();
      }, 2500);
    })();

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [user, navigate, load, reconcile, t]);

  async function startPayment() {
    if (payBusy) return;
    setPayBusy(true);
    setError("");
    setNotice("");
    try {
      // Reconcile first in case they already paid.
      const prior = await reconcile();
      if (prior.registrationPaid) {
        await load();
        setNotice(t("pay.notice.already"));
        setPayBusy(false);
        return;
      }

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
      setError(err instanceof Error ? err.message : t("common.error"));
      setPayBusy(false);
    }
  }

  async function refreshVerify() {
    setError("");
    setNotice("Re-checking Bachs…");
    try {
      const result = await reconcile(status?.latestOrder?.checkoutId);
      await load();
      setNotice(
        result.registrationPaid
          ? t("pay.notice.verified")
          : t("pay.notice.stillUnpaid"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setNotice("");
    }
  }

  if (loading || fetching) {
    return (
      <section className="panel payment-page" aria-busy="true">
        <p className="muted">{t("pay.verifying")}</p>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel payment-page">
        <h1>{t("pay.title")}</h1>
        <p className="status error">{error || t("common.error")}</p>
        <Link className="btn" to="/dashboard">{t("pay.backDash")}</Link>
      </section>
    );
  }

  return (
    <section className="panel payment-page">
      <p className="payment-page__eyebrow">{t("pay.eyebrow")}</p>
      <h1>{t("pay.title")}</h1>
      <p className="lede">{t("pay.lede", { name: status.profile.fullName })}</p>

      <div className="payment-hero">
        <div>
          <span className="payment-hero__label">{t("pay.amountDue")}</span>
          <strong className="payment-hero__amount">
            {status.registrationPaid ? t("pay.paid") : `$${status.amountUsd}`}
          </strong>
          <span className="payment-hero__sub">
            {status.registrationPaid
              ? status.registrationPaidAt
                ? `Paid ${new Date(status.registrationPaidAt).toLocaleString()}`
                : "Registration fee settled"
              : t("pay.usdLocal")}
          </span>
        </div>
        <span className={`payment-badge ${status.registrationPaid ? "ok" : "due"}`}>
          {status.registrationPaid ? t("pay.paid") : t("pay.unpaid")}
        </span>
      </div>

      <ul className="payment-steps">
        <li className={status.registrationPaid ? "done" : ""}>
          <strong>{t("pay.step.fee")}</strong>
          <span>
            {status.registrationPaid
              ? t("pay.step.feePaid")
              : t("pay.step.feePay", { amount: status.amountUsd })}
          </span>
        </li>
        <li className={status.adminApproved ? "done" : status.rejected ? "bad" : ""}>
          <strong>{t("pay.step.review")}</strong>
          <span>
            {status.rejected
              ? t("pay.step.rejected")
              : status.adminApproved
                ? t("pay.step.approved")
                : t("pay.step.waiting")}
          </span>
        </li>
        <li className={status.fullyActive ? "done" : ""}>
          <strong>{t("pay.step.access")}</strong>
          <span>
            {status.fullyActive ? t("pay.step.unlocked") : t("pay.step.needsBoth")}
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
          {t("pay.notConfigured")}
        </p>
      )}

      {status.rejected ? (
        <p className="muted">
          {t("pay.rejectedNote")} <Link to="/contact">{t("pay.contactUs")}</Link>
        </p>
      ) : status.registrationPaid ? (
        <div className="payment-actions">
          {status.fullyActive ? (
            <Link className="btn primary" to="/dashboard">
              {t("pay.goDash")}
            </Link>
          ) : (
            <p className="muted">{t("pay.waitingAdmin")}</p>
          )}
          <Link className="btn" to="/dashboard">
            {t("pay.backDash")}
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
            {payBusy ? t("pay.opening") : t("pay.cta", { amount: status.amountUsd })}
          </button>
          <button type="button" className="btn" onClick={() => void refreshVerify()}>
            {t("pay.verifyAgain")}
          </button>
          <p className="muted payment-secure-note">{t("pay.secureNote")}</p>
          <Link className="btn" to="/dashboard">
            {t("pay.backDash")}
          </Link>
        </div>
      )}

      {status.latestOrder && (
        <div className="payment-receipt">
          <h2>{t("pay.latestOrder")}</h2>
          <p>
            <strong>{t("pay.reference")}:</strong> {status.latestOrder.reference}
          </p>
          <p>
            <strong>{t("pay.status")}:</strong> {status.latestOrder.status}
          </p>
          <p>
            <strong>{t("pay.amount")}:</strong> ${status.latestOrder.amountUsd} USD
          </p>
          {status.latestOrder.checkoutId && (
            <p>
              <strong>{t("pay.checkout")}:</strong> {status.latestOrder.checkoutId}
            </p>
          )}
          {status.latestOrder.chargeId && (
            <p>
              <strong>{t("pay.charge")}:</strong> {status.latestOrder.chargeId}
            </p>
          )}
          {status.latestOrder.paidAt && (
            <p>
              <strong>{t("pay.paidAt")}:</strong>{" "}
              {new Date(status.latestOrder.paidAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
