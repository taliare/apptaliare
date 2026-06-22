
UPDATE public.prestacoes_contas p
SET valor_devolvido = GREATEST(0, c.valor_kit_original - p.total_venda)
FROM public.cobrancas_agendadas c
WHERE c.id = p.cobranca_id
  AND p.comissao_percentual > 0
  AND p.total_venda > 0
  AND c.valor_kit_original > 0
  AND COALESCE(p.valor_devolvido, 0) = 0;
