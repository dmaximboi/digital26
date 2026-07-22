import "./CertificateArt.css";

export type CertificateArtProps = {
  publicId?: string;
  displayName: string;
  type: "PARTICIPATION" | "COMPLETION" | string;
  course?: string;
  issueDate: string;
  photoUrl?: string | null;
  verifyUrl?: string;
};

export function CertificateArt({
  publicId,
  displayName,
  type,
  course = "6-Day Vibe Coding Masterclass",
  issueDate,
  photoUrl,
  verifyUrl,
}: CertificateArtProps) {
  const isCompletion =
    String(type).toUpperCase() === "COMPLETION" || type === "completion";
  const title = isCompletion ? "Certificate of Completion" : "Certificate of Participation";
  const body = isCompletion
    ? `Congratulations on successfully finishing the ${course} with The Digital 26. We celebrate your dedication, your wins, and the bright craft ahead. Keep building with heart.`
    : `with a warm welcome into the ${course}. You are part of The Digital 26, arriving with curiosity, good energy, and an open mind to learn, vibe, and grow. We're glad you're here.`;

  const dateLabel = formatDisplayDate(issueDate);
  const verifyDisplay = (verifyUrl || "").replace(/^https?:\/\//, "");

  return (
    <div className="d26-cert" id="d26-cert">
      <div className="d26-cert__frame-outer" />
      <div className="d26-cert__frame-inner" />
      <div className="d26-cert__glow" />
      <div className="d26-cert__grid" />
      <div className="d26-cert__watermark">D26</div>
      <div className="d26-cert__side left" />
      <div className="d26-cert__side right" />

      <div className="d26-cert__logo">
        <img src="/logo.png" alt="The Digital 26" />
      </div>

      <div className="d26-cert__photo">
        {photoUrl ? (
          <img src={photoUrl} alt="" />
        ) : (
          <div className="d26-cert__photo-ph">Student</div>
        )}
      </div>

      <div className="d26-cert__content">
        <div className="d26-cert__brand-row">
          <span className="line" />
          <span className="brand">The Digital 26</span>
          <span className="line right" />
        </div>

        <p className="d26-cert__presents">hereby proudly presents this</p>
        <h2 className="d26-cert__type">{title}</h2>
        <p className="d26-cert__awarded">awarded to</p>
        <p className="d26-cert__name">{displayName || "Recipient"}</p>
        <p className="d26-cert__body">
          {body.split(course).map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <strong>{course}</strong>
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </p>

        <div className="d26-cert__skills">
          <span>Vibe Coding</span>
          <span>Prompt Engineering</span>
          <span>Web Development</span>
          <span>Deployment</span>
        </div>

        <div className="d26-cert__footer">
          <div className="sig">
            <p className="sig-name">Adewuyi Ayuba</p>
            <div className="bar" />
            <p className="sig-title">
              Instructor &amp; Founder
              <br />
              The Digital 26 by Maxim
            </p>
          </div>

          <div className="seal">
            <div className="seal-circle">
              <span className="d26">D26</span>
              <span className="year">2026</span>
            </div>
            {publicId && <p className="seal-id">{publicId}</p>}
          </div>

          <div className="meta">
            <p className="meta-value">{dateLabel}</p>
            <div className="bar" />
            <p className="meta-label">
              {isCompletion ? "Date of Completion" : "Date of Participation"}
            </p>
            {verifyDisplay && <p className="meta-verify">Verify: {verifyDisplay}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDisplayDate(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
