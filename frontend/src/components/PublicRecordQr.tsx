type Props = {
  url: string;
  label?: string;
  size?: number;
};

/** Public QR for verify / check-agreement pages (scan opens the same public URL). */
export function PublicRecordQr({ url, label = "Scan QR to open this public record", size = 200 }: Props) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  return (
    <aside className="verify-qr">
      <p className="verify-qr__title">{label}</p>
      <img
        className="verify-qr__img"
        src={src}
        width={size}
        height={size}
        alt={`QR code linking to ${url}`}
      />
      <p className="muted verify-qr__url">{url}</p>
    </aside>
  );
}
