import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Gera um QR code (data URL) para o texto informado. */
export function QRCodeView({ text, size = 180 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(text, { width: size, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [text, size]);

  if (!dataUrl) return null;
  return <img src={dataUrl} alt="QR code para entrar" width={size} height={size} className="rounded-lg bg-white p-2" />;
}
