import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SPLASH_KEY = "d26_splash_seen";
const DURATION_MS = 3200;
const HEADLINE = "The Digital 26";

const PHASES = [
  { until: 22, label: "Sketching the frame" },
  { until: 48, label: "Writing the headline" },
  { until: 72, label: "Laying out modules" },
  { until: 90, label: "Placing cards" },
  { until: 101, label: "Polishing layout" },
] as const;

function shouldShowSplash(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("compose") === "1") return true;
    return sessionStorage.getItem(SPLASH_KEY) !== "1";
  } catch {
    return true;
  }
}

function phaseLabel(pct: number): string {
  return PHASES.find((p) => pct < p.until)?.label ?? "Polishing layout";
}

type Props = {
  onDone?: () => void;
};

export function AppSplash({ onDone }: Props) {
  const [visible, setVisible] = useState(shouldShowSplash);
  const [pct, setPct] = useState(1);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* ignore */
      }
      setVisible(false);
      onDone?.();
      return;
    }

    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION_MS);
      setPct(Math.max(1, Math.min(100, Math.round(t * 100))));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
        } catch {
          /* ignore */
        }
        setLeaving(true);
        window.setTimeout(() => {
          setVisible(false);
          onDone?.();
        }, 420);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [visible, onDone]);

  if (!visible) return null;

  const typedLen = Math.min(HEADLINE.length, Math.max(0, Math.round(((pct - 16) / 38) * HEADLINE.length)));
  const typed = pct >= 16 ? HEADLINE.slice(0, typedLen) : "";

  return createPortal(
    <div
      className={`app-splash${leaving ? " app-splash--out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Composing page ${pct} percent`}
    >
      <div className="app-splash__glow" aria-hidden />
      <p className="stitch-chip">
        <span className="stitch-chip__dot" aria-hidden />
        Agent composing
      </p>
      <div className="stitch-frame" aria-hidden>
        <div className={`stitch-bar${pct >= 8 ? " is-on" : ""}`}>
          <span />
          <span />
          <span />
        </div>
        <p className={`stitch-title${pct >= 16 ? " is-on" : ""}`}>
          {typed}
          {pct >= 16 && pct < 92 ? <span className="stitch-caret" /> : null}
        </p>
        <div className={`stitch-line${pct >= 40 ? " is-on" : ""}`} />
        <div className={`stitch-line stitch-line--short${pct >= 48 ? " is-on" : ""}`} />
        <div className="stitch-cards">
          <div className={`stitch-card${pct >= 58 ? " is-on" : ""}`} />
          <div className={`stitch-card${pct >= 70 ? " is-on" : ""}`} />
          <div className={`stitch-card${pct >= 82 ? " is-on" : ""}`} />
        </div>
      </div>
      <p className="stitch-status">{phaseLabel(pct)}</p>
      <div className="app-splash__bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>,
    document.body,
  );
}
