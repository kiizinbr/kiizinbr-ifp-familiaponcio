import QRCode from "qrcode";

/** QR code como data URL (PNG) — pra embutir num `<Image src={...} />` do PDF. */
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 256 });
}
