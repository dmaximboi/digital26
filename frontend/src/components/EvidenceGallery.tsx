type EvidenceItem = {
  id: string;
  kind: string;
  url: string;
  phoneHint?: string | null;
  uploadedBy: string;
  createdAt?: string;
};

const KIND_LABEL: Record<string, string> = {
  AGREEMENT_ADMIN_PROOF: "Admin deal proof",
  AGREEMENT_CLIENT_PROOF: "Client deal proof",
  CERT_ADMIN_SOLO: "Admin only",
  CERT_STUDENT_SOLO: "Student only",
  CERT_ADMIN_STUDENT: "Admin + student",
  CERT_STUDENT_EVIDENCE: "Student evidence",
};

export function EvidenceGallery({
  items,
  emptyHint = "No evidence images yet.",
}: {
  items: EvidenceItem[];
  emptyHint?: string;
}) {
  if (!items.length) {
    return <p className="muted">{emptyHint}</p>;
  }

  return (
    <div className="evidence-gallery">
      {items.map((item) => (
        <figure key={item.id} className="evidence-gallery__card">
          <a href={item.url} target="_blank" rel="noreferrer">
            <img src={item.url} alt={KIND_LABEL[item.kind] || item.kind} />
          </a>
          <figcaption>
            <strong>{KIND_LABEL[item.kind] || item.kind}</strong>
            <span className="muted">
              {item.uploadedBy}
              {item.phoneHint ? ` · ${item.phoneHint}` : ""}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
