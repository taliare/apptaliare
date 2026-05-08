ALTER TABLE public.produtos_catalogo 
  ADD COLUMN IF NOT EXISTS preco_custo numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.kits_montagem_itens 
  ADD COLUMN IF NOT EXISTS custo_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foto_snapshot text;

ALTER TABLE public.kits_montagem 
  ADD COLUMN IF NOT EXISTS total_pecas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_varejo numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_custo numeric(10,2) NOT NULL DEFAULT 0;

INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos-fotos', 'produtos-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Fotos de produtos publicamente visiveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos-fotos');

CREATE POLICY "Admin e producao podem inserir fotos de produtos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'produtos-fotos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'producao'::app_role))
);

CREATE POLICY "Admin e producao podem atualizar fotos de produtos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'produtos-fotos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'producao'::app_role))
);

CREATE POLICY "Admin e producao podem remover fotos de produtos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'produtos-fotos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'producao'::app_role))
);