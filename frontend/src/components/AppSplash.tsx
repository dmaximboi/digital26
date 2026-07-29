import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LANDING_MEMES } from "../lib/landingMemes";

const SPLASH_KEY = "d26_splash_seen";
const DURATION_MS = 2800;

type Props = {
  onDone?: () => void;
};

export function AppSplash({ onDone }: Props) {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [pct, setPct] = useState(1);
  const [memeIdx, setMemeIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const started = performance.now();
    let raf = 0;
    let memeTimer = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION_MS);
      const next = Math.max(1, Math.min(100, Math.round(t * 100)));
      setPct(next);
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
    memeTimer = window.setInterval(() => {
      setMemeIdx((i) => (i + 1) % LANDING_MEMES.length);
    }, 220);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(memeTimer);
    };
  }, [visible, onDone]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className={`app-splash${leaving ? " app-splash--out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${pct} percent`}
    >
      <div className="app-splash__glow" aria-hidden />
      <img src="/logo.png" alt="" className="app-splash__logo" />
      <p className="app-splash__brand">The Digital 26</p>
      <p className="app-splash__meme" key={memeIdx}>
        {LANDING_MEMES[memeIdx]}
      </p>
      <div className="app-splash__bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="app-splash__pct">{pct}%</p>
    </div>,
    document.body,
  );
}
