import { OneTimeTemplateDownload } from "./OneTimeTemplateDownload";
import { DocumentPaywall } from "./DocumentPaywall";
import { useT } from "../i18n/LocaleContext";

type Props = {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  amountUsd: string;
  canDownload: boolean;
  downloadConsumed?: boolean;
  downloadToken?: string | null;
  onUnlocked: () => void;
  onConsumed: () => void;
};

export function LockedDownload({
  kind,
  publicId,
  amountUsd,
  canDownload,
  downloadConsumed,
  downloadToken,
  onUnlocked,
  onConsumed,
}: Props) {
  const t = useT();
  const downloadKind = kind === "CERTIFICATE" ? "certificate" : "agreement";

  if (canDownload && downloadToken) {
    return (
      <div className="locked-dl">
        <OneTimeTemplateDownload
          kind={downloadKind}
          publicId={publicId}
          available
          downloadToken={downloadToken}
          onConsumed={onConsumed}
        />
      </div>
    );
  }

  if (downloadConsumed) {
    return (
      <div className="locked-dl">
        <p className="muted locked-dl__used">{t("record.downloadUsed")}</p>
      </div>
    );
  }

  return (
    <div className="locked-dl">
      <div className="locked-dl__btn" aria-disabled="true">
        <span className="locked-dl__lock" aria-hidden>
          🔒
        </span>
        <span>{t("record.downloadLocked", { amount: amountUsd })}</span>
      </div>
      <DocumentPaywall
        kind={kind}
        publicId={publicId}
        amountUsd={amountUsd}
        compact
        onUnlocked={onUnlocked}
      />
    </div>
  );
}
