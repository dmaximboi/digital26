import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type Person = {
  id: string;
  name: string;
  createdAt?: string;
  agreements: Array<{
    id: string;
    publicId: string | null;
    dealType: string;
    signedAt: string | null;
  }>;
  certificates: Array<{
    id: string;
    publicId: string | null;
    type: string;
    issueDate: string;
    status: string;
  }>;
};

type Contact = { email: string | null; phone: string | null };

export function AdminClientsPage() {
  const [items, setItems] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, Contact>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ items: Person[] }>("/api/admin/clients")
      .then((d) => setItems(d.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
  }, []);

  async function reveal(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const c = await adminFetch<Contact & { id: string }>(
        `/api/admin/people/${encodeURIComponent(id)}/reveal-contact`,
        { method: "POST", body: "{}" },
      );
      setRevealed((prev) => ({ ...prev, [id]: { email: c.email, phone: c.phone } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__head">
        <div>
          <h2>Clients</h2>
          <p className="muted">Email and phone stay hidden until you reveal them</p>
        </div>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="client-list">
        {items.map((p) => (
          <article key={p.id} className="result-card">
            <h2>{p.name}</h2>
            <p className="muted">
              {revealed[p.id] ? (
                <>
                  {revealed[p.id]?.email ?? "n/a"} · {revealed[p.id]?.phone ?? "no phone"}
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === p.id}
                  onClick={() => void reveal(p.id)}
                >
                  {busyId === p.id ? "Revealing…" : "Reveal contact"}
                </button>
              )}
            </p>
            <p>
              <strong>Agreements:</strong>{" "}
              {p.agreements.length
                ? p.agreements.map((a) => a.publicId || a.id).join(", ")
                : "none"}
            </p>
            <p>
              <strong>Certs:</strong>{" "}
              {p.certificates.length
                ? p.certificates
                    .map((c) => `${c.publicId ?? "pending"} (${c.type})`)
                    .join(", ")
                : "none"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
