import { CATEGORY_LABELS, dictionaryCount, type DictEntry } from "./dictionary";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildStandaloneHtml(entries: DictEntry[]): string {
  const items = entries
    .map(
      (e) =>
        `<article class="e" data-q="${escapeHtml(`${e.term} ${e.aka.join(" ")} ${e.category} ${e.definition}`.toLowerCase())}"><h2>${escapeHtml(e.term)}</h2>${
          e.aka.length ? `<p class="aka">${escapeHtml(e.aka.join(" · "))}</p>` : ""
        }<p class="cat">${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</p><p>${escapeHtml(e.definition)}</p></article>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>The Digital 26 Tech Dictionary</title>
<style>
:root{--bg:#131315;--ink:#e5e1e4;--muted:#d7c3ae;--accent:#f5a623;--surface:#201f21}
*{box-sizing:border-box}
body{margin:0;font:16px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;padding:1rem 1.25rem;background:rgba(19,19,21,.94);border-bottom:1px solid rgba(245,166,35,.2)}
h1{margin:0 0 .35rem;font-size:1.45rem}
.lede{margin:0 0 .75rem;color:var(--muted);font-size:.92rem}
input{width:100%;max-width:28rem;padding:.7rem .85rem;border:0;border-radius:.8rem;background:var(--surface);color:var(--ink);font:inherit}
main{padding:1rem 1.25rem 3rem;display:grid;gap:1rem;max-width:52rem;margin:0 auto}
.e{padding:1rem 0;border-bottom:1px solid rgba(159,142,122,.2)}
h2{margin:0 0 .3rem;font-size:1.15rem}
.aka,.cat{margin:0 0 .4rem;color:var(--accent);font-size:.75rem;letter-spacing:.06em;text-transform:uppercase}
.e p:last-child{margin:0}
.hidden{display:none}
footer{padding:1rem 1.25rem 2rem;color:var(--muted);font-size:.8rem}
</style>
</head>
<body>
<header>
<h1>The Digital 26 Tech Dictionary</h1>
<p class="lede">${dictionaryCount} working terms for GitHub, web, and studio people. Offline copy.</p>
<input id="q" type="search" placeholder="Search terms, acronyms, definitions"/>
</header>
<main id="list">${items}</main>
<footer>The Digital 26 · digital26.online · standalone pack</footer>
<script>
const q=document.getElementById('q');
const nodes=[...document.querySelectorAll('.e')];
q.addEventListener('input',()=>{
  const parts=q.value.toLowerCase().split(/\\s+/).filter(Boolean);
  for(const n of nodes){
    const hay=n.getAttribute('data-q')||'';
    n.classList.toggle('hidden', parts.some(p=>!hay.includes(p)));
  }
});
</script>
</body>
</html>`;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

export function buildDictionaryPdf(entries: DictEntry[]): Uint8Array {
  const lines: string[] = [
    "The Digital 26 Tech Dictionary",
    `${entries.length} terms for GitHub, web, and studio work`,
    "",
  ];
  for (const entry of entries) {
    lines.push(entry.term);
    if (entry.aka.length) lines.push(`Also: ${entry.aka.join(", ")}`);
    lines.push(`Field: ${CATEGORY_LABELS[entry.category] || entry.category}`);
    lines.push(...wrapText(entry.definition, 86));
    lines.push("");
  }

  const contentParts: string[] = ["BT", "/F1 11 Tf", "14 TL", "48 780 Td"];
  let yBudget = 46;
  const pageStarts = [0];
  const all = lines.flatMap((line) => (line.length ? wrapText(line, 92) : [""]));
  for (const line of all) {
    if (yBudget <= 0) {
      contentParts.push("ET");
      pageStarts.push(contentParts.length);
      contentParts.push("BT", "/F1 11 Tf", "14 TL", "48 780 Td");
      yBudget = 46;
    }
    contentParts.push(`(${pdfEscape(line)}) Tj`, "T*");
    yBudget -= 1;
  }
  contentParts.push("ET");
  pageStarts.push(contentParts.length);

  const pageStreams: string[] = [];
  for (let i = 0; i < pageStarts.length - 1; i++) {
    pageStreams.push(contentParts.slice(pageStarts[i], pageStarts[i + 1]).join("\n"));
  }

  const pageIds = pageStreams.map((_, i) => 4 + i * 2);
  const out: string[] = ["%PDF-1.4\n"];
  const off = [0];
  const write = (n: number, raw: string) => {
    off[n] = out.join("").length;
    out.push(`${n} 0 obj\n${raw}\nendobj\n`);
  };
  write(1, "<< /Type /Catalog /Pages 2 0 R >>");
  write(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`);
  write(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageStreams.forEach((stream, i) => {
    const pageId = 4 + i * 2;
    const streamId = pageId + 1;
    write(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    write(streamId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const xrefAt = out.join("").length;
  const max = 3 + pageStreams.length * 2;
  let xref = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= max; i++) {
    xref += `${String(off[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  out.push(xref);
  out.push(`trailer\n<< /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  return new TextEncoder().encode(out.join(""));
}

export function downloadDictionaryPdf(entries: DictEntry[]) {
  const bytes = buildDictionaryPdf(entries);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  downloadBlob(new Blob([copy.buffer], { type: "application/pdf" }), "digital26-tech-dictionary.pdf");
}

export function downloadStandaloneApp(entries: DictEntry[]) {
  const html = buildStandaloneHtml(entries);
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "digital26-tech-dictionary.html");
}
