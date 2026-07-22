import { useCallback, useEffect, useState } from "react";
import "./CodingLaptop.css";

type Scene = "code" | "execute" | "logo";

const SNIPPETS: string[][] = [
  [
    'const digital26 = "vibe";',
    'await build("web");',
    "ship(loyal);",
  ],
  [
    "fn craft() {",
    '  design("site");',
    "  deploy();",
    "}",
  ],
  [
    "agree -> build -> ship",
    'trust = "true";',
    "output.best();",
  ],
  [
    "client.wants(web);",
    "we.deliver(loyal);",
    "verify(publicId);",
  ],
  [
    "npm run build",
    "git push origin main",
    "live.on(digital26);",
  ],
  [
    "learn.vibe();",
    "code.with(heart);",
    "graduate.proud();",
  ],
];

function colorize(line: string) {
  // Simple highlight: strings, keywords, punctuation left as text spans
  const parts: { t: string; c?: string }[] = [];
  const re =
    /(\bconst\b|\bawait\b|\bfn\b|\breturn\b)|("[^"]*")|(\b\w+(?=\())|([{}();=→])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push({ t: line.slice(last, m.index) });
    if (m[1]) parts.push({ t: m[1], c: "kw" });
    else if (m[2]) parts.push({ t: m[2], c: "str" });
    else if (m[3]) parts.push({ t: m[3], c: "fn" });
    else parts.push({ t: m[0] });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ t: line.slice(last) });
  return parts;
}

/** Interactive coding laptop — click keyboard to change screen content */
export function CodingLaptop() {
  const [snippet, setSnippet] = useState(0);
  const [scene, setScene] = useState<Scene>("code");
  const [pressed, setPressed] = useState(false);
  const [typingKey, setTypingKey] = useState(0);

  const lines = SNIPPETS[snippet] ?? SNIPPETS[0]!;

  const runCycle = useCallback(() => {
    setScene("code");
    setTypingKey((k) => k + 1);
  }, []);

  // Auto: after code types → execute → logo → next snippet
  useEffect(() => {
    if (scene !== "code") return;
    const toExec = window.setTimeout(() => setScene("execute"), 3200);
    return () => window.clearTimeout(toExec);
  }, [scene, typingKey]);

  useEffect(() => {
    if (scene !== "execute") return;
    const toLogo = window.setTimeout(() => setScene("logo"), 1100);
    return () => window.clearTimeout(toLogo);
  }, [scene]);

  useEffect(() => {
    if (scene !== "logo") return;
    const toNext = window.setTimeout(() => {
      setSnippet((s) => (s + 1) % SNIPPETS.length);
      runCycle();
    }, 2200);
    return () => window.clearTimeout(toNext);
  }, [scene, runCycle]);

  function onKeyboardClick() {
    setPressed(true);
    window.setTimeout(() => setPressed(false), 160);
    setSnippet((s) => (s + 1) % SNIPPETS.length);
    runCycle();
  }

  return (
    <div className="cl-scene">
      <div className="cl-glow" aria-hidden="true" />
      <div className={`cl-laptop${pressed ? " cl-laptop--tap" : ""}`}>
        <div className="cl-screen">
          <div className="cl-bezel">
            <div className="cl-chrome" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            {scene === "code" && (
              <div className="cl-editor" key={typingKey}>
                <div className="cl-gutter" aria-hidden="true">
                  {lines.map((_, i) => (
                    <i key={i}>{i + 1}</i>
                  ))}
                </div>
                <div className="cl-code">
                  {lines.map((line, i) => (
                    <p
                      key={`${typingKey}-${i}`}
                      style={{ animationDelay: `${i * 0.35}s` }}
                    >
                      {colorize(line).map((p, j) =>
                        p.c ? (
                          <span key={j} className={p.c}>
                            {p.t}
                          </span>
                        ) : (
                          <span key={j}>{p.t}</span>
                        ),
                      )}
                      {i === lines.length - 1 && <span className="cursor" />}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {scene === "execute" && (
              <div className="cl-execute" role="status">
                <span className="cl-execute__prompt">&gt;</span>
                <span className="cl-execute__text">(execute)</span>
                <span className="cursor" />
              </div>
            )}

            {scene === "logo" && (
              <div className="cl-logo-screen" role="img" aria-label="Digital 26">
                <img src="/logo.png" alt="" className="cl-logo-screen__img" />
                <p className="cl-logo-screen__name">Digital26</p>
              </div>
            )}
          </div>
        </div>

        <div className="cl-hinge" aria-hidden="true" />

        <button
          type="button"
          className={`cl-base${pressed ? " cl-base--pressed" : ""}`}
          onClick={onKeyboardClick}
          aria-label="Press keyboard to change code on screen"
        >
          <div className="cl-keys" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="cl-key" />
            ))}
          </div>
          <div className="cl-track" aria-hidden="true" />
          <span className="cl-hint">tap keyboard</span>
        </button>
      </div>
      <p className="cl-caption">The Digital 26</p>
    </div>
  );
}
