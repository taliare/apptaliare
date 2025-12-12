-- Add CHECK constraints for input validation (NOT VALID to not affect existing data)

-- notas_promissorias: positive monetary values (allow zero for existing data)
ALTER TABLE public.notas_promissorias 
ADD CONSTRAINT positive_valor_total CHECK (valor_total >= 0) NOT VALID;

ALTER TABLE public.notas_promissorias 
ADD CONSTRAINT positive_valor_pagamento_1 CHECK (valor_pagamento_1 >= 0) NOT VALID;

ALTER TABLE public.notas_promissorias 
ADD CONSTRAINT positive_valor_pagamento_2 CHECK (valor_pagamento_2 IS NULL OR valor_pagamento_2 >= 0) NOT VALID;

-- cobrancas_diarias: non-negative monetary values
ALTER TABLE public.cobrancas_diarias 
ADD CONSTRAINT non_negative_total_cobrado CHECK (total_cobrado >= 0) NOT VALID;

ALTER TABLE public.cobrancas_diarias 
ADD CONSTRAINT non_negative_total_pix CHECK (total_pix IS NULL OR total_pix >= 0) NOT VALID;

ALTER TABLE public.cobrancas_diarias 
ADD CONSTRAINT non_negative_total_dinheiro CHECK (total_dinheiro IS NULL OR total_dinheiro >= 0) NOT VALID;

ALTER TABLE public.cobrancas_diarias 
ADD CONSTRAINT non_negative_total_cartao CHECK (total_cartao IS NULL OR total_cartao >= 0) NOT VALID;

ALTER TABLE public.cobrancas_diarias 
ADD CONSTRAINT non_negative_despesa CHECK (despesa_cobranca IS NULL OR despesa_cobranca >= 0) NOT VALID;

-- prestacoes_contas: non-negative financial values
ALTER TABLE public.prestacoes_contas 
ADD CONSTRAINT non_negative_total_venda CHECK (total_venda >= 0) NOT VALID;

ALTER TABLE public.prestacoes_contas 
ADD CONSTRAINT non_negative_comissao CHECK (comissao_valor >= 0) NOT VALID;

ALTER TABLE public.prestacoes_contas 
ADD CONSTRAINT non_negative_valor_pago CHECK (valor_pago >= 0) NOT VALID;

ALTER TABLE public.prestacoes_contas 
ADD CONSTRAINT non_negative_valor_devido CHECK (valor_devido_empresa >= 0) NOT VALID;

-- cobrancas_agendadas: non-negative values
ALTER TABLE public.cobrancas_agendadas 
ADD CONSTRAINT non_negative_valor_previsto CHECK (valor_previsto >= 0) NOT VALID;

ALTER TABLE public.cobrancas_agendadas 
ADD CONSTRAINT non_negative_valor_adiantado CHECK (valor_adiantado IS NULL OR valor_adiantado >= 0) NOT VALID;

-- metas_cobranca: positive meta value
ALTER TABLE public.metas_cobranca 
ADD CONSTRAINT positive_meta_valor CHECK (meta_valor > 0) NOT VALID;

-- repasses: positive repasse value
ALTER TABLE public.repasses 
ADD CONSTRAINT positive_valor_repasse CHECK (valor_repasse > 0) NOT VALID;

-- kits_estoque: non-negative valor and text length constraints
ALTER TABLE public.kits_estoque 
ADD CONSTRAINT non_negative_valor CHECK (valor IS NULL OR valor >= 0) NOT VALID;

ALTER TABLE public.kits_estoque 
ADD CONSTRAINT valid_codigo_length CHECK (length(codigo) BETWEEN 1 AND 50) NOT VALID;

ALTER TABLE public.kits_estoque 
ADD CONSTRAINT valid_tipo_length CHECK (length(tipo) BETWEEN 1 AND 50) NOT VALID;

-- profiles: name length constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_nome_length CHECK (length(nome) BETWEEN 2 AND 100) NOT VALID;

-- vendedoras: name length constraint
ALTER TABLE public.vendedoras 
ADD CONSTRAINT valid_nome_length CHECK (length(nome) BETWEEN 2 AND 100) NOT VALID;

-- cobrancas_agendadas: revendedora length constraint
ALTER TABLE public.cobrancas_agendadas 
ADD CONSTRAINT valid_revendedora_length CHECK (length(revendedora) BETWEEN 2 AND 200) NOT VALID;