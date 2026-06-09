
CREATE POLICY "Representante ve apenas seus ajustes"
ON public.ajustes_representantes
FOR SELECT
TO authenticated
USING (representante_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Autenticados podem ver catalogo" ON public.produtos_catalogo;

CREATE POLICY "Admin e producao veem catalogo completo"
ON public.produtos_catalogo
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'producao'::app_role)
);

CREATE OR REPLACE VIEW public.produtos_catalogo_publico
WITH (security_invoker = true) AS
SELECT
  id, codigo_barras, referencia, descricao, categoria, subcategoria,
  cor, tamanho, preco_varejo, foto_url, ativo, criado_em, atualizado_em,
  fotos_adicionais
FROM public.produtos_catalogo
WHERE ativo IS NOT FALSE;

GRANT SELECT ON public.produtos_catalogo_publico TO authenticated;
