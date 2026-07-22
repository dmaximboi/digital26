import "./AgreementArt.css";

export type AgreementArtProps = {
  publicId?: string;
  displayName: string;
  dealTag?: string | null;
  signedAt: string;
  signature: string;
  checkUrl?: string;
};

export function AgreementArt({
  publicId,
  displayName,
  dealTag,
  signedAt,
  signature,
  checkUrl,
}: AgreementArtProps) {
  const dateLabel = formatDisplayDate(signedAt);
  const checkDisplay = (checkUrl || "").replace(/^https?:\/\//, "");
  const tag = (dealTag || "Services engagement").slice(0, 50);

  return (
    <div className="d26-agr" id="d26-agr">
      <div className="d26-agr__frame-outer" />
      <div className="d26-agr__frame-inner" />

      <div className="d26-agr__logo">
        <img src="/logo.png" alt="The Digital 26" />
      </div>

      <div className="d26-agr__letter">
        <p className="d26-agr__org">The Digital 26</p>
        <h2 className="d26-agr__title">Service Agreement Letter</h2>
        <p className="d26-agr__meta">
          {dateLabel}
          {publicId ? ` · ${publicId}` : ""}
        </p>

        <p className="d26-agr__salute">
          This letter records that <strong>{displayName}</strong> has, based on our discussion,
          accepted and wants The Digital 26’s services.
        </p>

        <p className="d26-agr__tagline">
          About this engagement: <strong>{tag}</strong>
        </p>

        <div className="d26-agr__body">
          <p>
            By signing, the Client agrees to our consent, working terms, and service process, and
            relies on The Digital 26 to deliver with honesty and care.
          </p>
          <p>
            The Digital 26 upholds utmost truth and loyalty in our work. We condemn any form of
            scam, fraud, or inappropriate conduct. We commit to give our best output and to dedicate
            ourselves as much as we can to satisfy the Client.
          </p>
          <p>
            Both parties believe we will not offend each other, and will manage the relationship with
            respect throughout the whole service process — Inshallah.
          </p>
        </div>

        <div className="d26-agr__sign-block">
          <div>
            <p className="d26-agr__sign-name">{signature}</p>
            <p className="d26-agr__sign-label">Client signature (typed name)</p>
          </div>
          <div>
            <p className="d26-agr__sign-name">Adewuyi Ayuba</p>
            <p className="d26-agr__sign-label">The Digital 26 by Maxim</p>
          </div>
        </div>

        {checkDisplay && (
          <p className="d26-agr__check">Check: {checkDisplay}</p>
        )}
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
