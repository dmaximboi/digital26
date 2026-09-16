import { OneTimeTemplateDownload } from "./OneTimeTemplateDownload";
import { DocumentPaywall } from "./DocumentPaywall";
import { useT } from "../i18n/LocaleContext";

type Props = {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  accessPaid: boolean;
  amountUsd: string;
  canDownload: boolean;
  downloadToken?: string | null;
  onUnlocked: () => void;
  onConsumed: () => void;
};

export function LockedDownload({
  kind,
  publicId,
  accessPaid,
  amountUsd,
  canDownload,
  downloadToken,
  onUnlocked,
  onConsumed,
}: Props) {
  const t = useT();
  const downloadKind = kind === "CERTIFICATE" ? "certificate" : "agreement";

  return (
    <div className="locked-dl">
      {accessPaid ? (
        canDownload && downloadToken ? (
          <OneTimeTemplateDownload
            kind={downloadKind}
            publicId={publicId}
            available
            downloadToken={downloadToken}
            onConsumed={onConsumed}
          />
        ) : (
          <p className="muted locked-dl__used">{t("record.downloadUsed")}</p>
        )
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
