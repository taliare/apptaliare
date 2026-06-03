import { useEffect, useState } from 'react';
import { signedFotoUrl } from '@/lib/revendedoraFoto';

/** Resolve URL assinada (ou pública) para uma foto de revendedora. */
export function useFotoUrl(pathOrUrl: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!pathOrUrl) {
      setUrl(null);
      return;
    }
    signedFotoUrl(pathOrUrl).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [pathOrUrl]);

  return url;
}
