/** Local browser calendar date+time for datetime-local inputs (not UTC/server). */
export function browserLocalDateTimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function browserLocalDateValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatCertDate(isoOrLocal: string): string {
  const d = new Date(isoOrLocal.includes("T") ? isoOrLocal : `${isoOrLocal}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoOrLocal;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
