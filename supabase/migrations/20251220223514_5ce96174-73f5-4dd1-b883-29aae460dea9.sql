-- Etapa 4: Adicionar colunas de referência para melhorar integridade sem quebrar dados históricos

-- 1. Adicionar coluna kit_estoque_id em kits_entregues (referência ao kit original)
ALTER TABLE kits_entregues 
ADD COLUMN IF NOT EXISTS kit_estoque_id UUID REFERENCES kits_estoque(id) ON DELETE SET NULL;

-- 2. Adicionar coluna kit_entregue_id em cobrancas_agendadas (referência ao registro de entrega)
ALTER TABLE cobrancas_agendadas 
ADD COLUMN IF NOT EXISTS kit_entregue_id UUID REFERENCES kits_entregues(id) ON DELETE SET NULL;

-- 3. Criar índices para performance nas novas colunas
CREATE INDEX IF NOT EXISTS idx_kits_entregues_kit_estoque_id ON kits_entregues(kit_estoque_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_agendadas_kit_entregue_id ON cobrancas_agendadas(kit_entregue_id);

-- 4. Preencher kit_estoque_id onde possível (usando código e representante)
UPDATE kits_entregues ke
SET kit_estoque_id = ks.id
FROM kits_estoque ks
WHERE ks.codigo = ke.codigo_mostruario
  AND ks.representante_id = ke.representante_id
  AND ke.kit_estoque_id IS NULL;

-- 5. Preencher kit_entregue_id nas cobranças de kits onde possível
UPDATE cobrancas_agendadas ca
SET kit_entregue_id = ke.id
FROM kits_entregues ke
WHERE ca.codigo_nota = ke.codigo_mostruario
  AND ca.representante_id = ke.representante_id
  AND ca.tipo = 'kit'
  AND ca.kit_entregue_id IS NULL;

-- 6. Atualizar função entregar_kit_para_revendedora para usar as novas colunas FK
CREATE OR REPLACE FUNCTION public.entregar_kit_para_revendedora(
  p_kit_id UUID,
  p_user_id UUID,
  p_revendedora TEXT,
  p_data_vencimento DATE,
  p_vendedora_id UUID DEFAULT NULL,
  p_vendedora_nome TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit RECORD;
  v_cobranca_id UUID;
  v_kit_entregue_id UUID;
  v_data_entrega DATE := CURRENT_DATE;
BEGIN
  -- 1. Buscar e validar o kit
  SELECT id, codigo, tipo, valor, status, representante_id
  INTO v_kit
  FROM kits_estoque
  WHERE id = p_kit_id
    AND representante_id = p_user_id
    AND status = 'com_representante'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Kit não encontrado, já entregue ou não pertence a você'
    );
  END IF;

  -- 2. Verificar se já existe entrega deste kit para este representante
  IF EXISTS (
    SELECT 1 FROM kits_entregues 
    WHERE codigo_mostruario = v_kit.codigo 
      AND representante_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue anteriormente'
    );
  END IF;

  -- 3. Atualizar status do kit para "com_revendedora"
  UPDATE kits_estoque
  SET status = 'com_revendedora'
  WHERE id = p_kit_id;

  -- 4. Registrar kit entregue COM referência ao kit_estoque
  INSERT INTO kits_entregues (
    representante_id,
    codigo_mostruario,
    tipo,
    data_entrega,
    data_vencimento,
    kit_estoque_id
  ) VALUES (
    p_user_id,
    v_kit.codigo,
    v_kit.tipo,
    v_data_entrega,
    p_data_vencimento,
    p_kit_id
  )
  RETURNING id INTO v_kit_entregue_id;

  -- 5. Criar cobrança agendada COM referência ao kit_entregue
  INSERT INTO cobrancas_agendadas (
    representante_id,
    revendedora,
    codigo_nota,
    tipo,
    valor_previsto,
    data_agendada,
    status,
    vendedora_id,
    vendedora,
    observacoes,
    kit_entregue_id
  ) VALUES (
    p_user_id,
    p_revendedora,
    v_kit.codigo,
    'kit',
    COALESCE(v_kit.valor, 0),
    p_data_vencimento,
    'pendente',
    p_vendedora_id,
    p_vendedora_nome,
    'Entrega de kit ' || COALESCE(v_kit.tipo, 'padrão') || ' - Código: ' || v_kit.codigo,
    v_kit_entregue_id
  )
  RETURNING id INTO v_cobranca_id;

  -- 6. Retornar sucesso com IDs criados
  RETURN json_build_object(
    'success', true,
    'kit_codigo', v_kit.codigo,
    'kit_tipo', v_kit.tipo,
    'kit_valor', COALESCE(v_kit.valor, 0),
    'cobranca_id', v_cobranca_id,
    'kit_entregue_id', v_kit_entregue_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este kit já foi entregue (registro duplicado)'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 7. Atualizar função de reversão para limpar as referências corretamente
CREATE OR REPLACE FUNCTION public.reverter_entrega_kit_atomico(
  p_kit_entregue_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit_entregue RECORD;
BEGIN
  -- 1. Buscar o kit entregue com kit_estoque_id
  SELECT id, codigo_mostruario, representante_id, kit_estoque_id
  INTO v_kit_entregue
  FROM kits_entregues
  WHERE id = p_kit_entregue_id
    AND representante_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registro de entrega não encontrado ou não pertence a você'
    );
  END IF;

  -- 2. Reverter status do kit no estoque (usando kit_estoque_id se disponível)
  IF v_kit_entregue.kit_estoque_id IS NOT NULL THEN
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE id = v_kit_entregue.kit_estoque_id
      AND status = 'com_revendedora';
  ELSE
    -- Fallback para busca por código (dados históricos)
    UPDATE kits_estoque
    SET status = 'com_representante'
    WHERE codigo = v_kit_entregue.codigo_mostruario
      AND representante_id = p_user_id
      AND status = 'com_revendedora';
  END IF;

  -- 3. Deletar cobrança agendada associada (usando kit_entregue_id se possível)
  DELETE FROM cobrancas_agendadas
  WHERE kit_entregue_id = p_kit_entregue_id
     OR (representante_id = p_user_id
         AND codigo_nota = v_kit_entregue.codigo_mostruario
         AND tipo = 'kit'
         AND kit_entregue_id IS NULL);

  -- 4. Deletar registro de kit entregue
  DELETE FROM kits_entregues
  WHERE id = p_kit_entregue_id;

  RETURN json_build_object(
    'success', true,
    'codigo_kit', v_kit_entregue.codigo_mostruario
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;