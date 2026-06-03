import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'revendedoras-fotos';

/** Faz upload da foto (Blob ou File) no bucket privado. Retorna o path interno. */
export async function uploadRevendedoraFoto(
  file: Blob,
  revendedoraId: string | null | undefined
): Promise<string> {
  const folder = revendedoraId || `novo-${crypto.randomUUID()}`;
  const ext = file.type.includes('webp') ? 'webp' : file.type.includes('png') ? 'png' : 'jpg';
  const path = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Gera URL assinada (1h) para um path do bucket. Aceita também URLs completas (retorna direto). */
export async function signedFotoUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathOrUrl, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
