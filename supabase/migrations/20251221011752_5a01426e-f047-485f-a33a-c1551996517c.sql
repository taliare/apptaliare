-- Adicionar coluna avatar_url na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Criar bucket para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política: usuários podem ver todos os avatares (bucket público)
CREATE POLICY "Avatares são públicos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Política: usuários podem fazer upload do próprio avatar
CREATE POLICY "Usuários podem fazer upload do próprio avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: usuários podem atualizar o próprio avatar
CREATE POLICY "Usuários podem atualizar o próprio avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: usuários podem deletar o próprio avatar
CREATE POLICY "Usuários podem deletar o próprio avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: usuários podem atualizar seu próprio perfil
CREATE POLICY "Usuário pode atualizar próprio perfil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);