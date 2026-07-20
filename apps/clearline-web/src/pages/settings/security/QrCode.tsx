import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  /** The `otpauth://` URI to encode. */
  value: string;
  size?: number;
}

/**
 * Renders a QR code as an inline SVG entirely client-side (US-CW-035 AC-03): the `qrcode` library
 * produces the SVG markup in the browser, so the TOTP secret in the URI never travels to a third-party
 * QR image service. The SVG is injected as markup because the library returns a complete `<svg>` string.
 */
export function QrCode({ value, size = 160 }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toString(value, { type: 'svg', margin: 0, width: size })
      .then((markup) => {
        if (active) setSvg(markup);
      })
      .catch(() => {
        if (active) setSvg(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svg) {
    return (
      <div aria-hidden className="bg-cl-inset rounded-lg" style={{ width: size, height: size }} />
    );
  }

  return (
    <div
      role="img"
      aria-label="Authenticator app QR code"
      data-testid="totp-qr"
      style={{ width: size, height: size }}
      // Safe: markup is generated locally by the qrcode library from a same-origin otpauth URI,
      // never from user-controlled HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
