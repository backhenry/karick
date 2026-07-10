import { useEffect, useState } from 'react';
import { type Brand, brandName } from '@karick/shared';

/** Mostra o logo da marca; se ausente ou quebrado, cai no nome (evita espaço em branco). */
export function BrandMark({ brand, imgClass, nameClass }: { brand?: Brand; imgClass?: string; nameClass?: string }) {
  const [err, setErr] = useState(false);
  const logo = brand?.logo;

  // URL nova merece nova tentativa — sem isso, um erro antigo esconde o logo para sempre.
  useEffect(() => setErr(false), [logo]);
  if (logo && /^https?:\/\//i.test(logo) && !err) {
    return <img src={logo} alt={brandName(brand)} className={imgClass} onError={() => setErr(true)} />;
  }
  return (
    <h1 className={nameClass} style={{ color: brand?.primary }}>
      {brandName(brand)}
    </h1>
  );
}
