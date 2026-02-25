
# Corrigir Logica de Acrescimo: Somar na Nota Original em vez de Criar Nova Nota

## Problema

Quando o representante registra um acrescimo (joias adicionais), o sistema cria uma nota separada tipo "acrescimo" alem da nota original do kit. A revendedora fica com duas notas na agenda -- uma situacao incorreta. O correto e somar o valor do acrescimo na nota original do kit (campo `valor_previsto`), mantendo um unico pedido.

## Situacao Atual no Banco

Existem **13 notas tipo "acrescimo"** que nao deveriam existir. Em nenhum caso o valor do acrescimo foi somado na nota original (diferenca = 0 em todos).

## Solucao

### 1. Alterar a funcao de banco `registrar_acrescimo_pedido`

A funcao atual (steps 4-5) cria uma nova `cobrancas_agendadas` tipo "acrescimo" e vincula o `cobranca_id` do acrescimo a essa nova nota.

**Nova logica:**
- Em vez de criar nova `cobrancas_agendadas`, buscar a nota original tipo "kit" vinculada ao mesmo `kit_entregue_id`
- Somar `p_valor` ao `valor_previsto` da nota original
- Vincular o `acrescimo_pedido.cobranca_id` a nota original (tipo "kit")
- Remover completamente a criacao de nota tipo "acrescimo"

### 2. Corrigir dados existentes (13 notas)

Para cada nota tipo "acrescimo":
- Somar o `valor_previsto` dela na nota original tipo "kit" do mesmo `kit_entregue_id`
- Atualizar o `cobranca_id` no `acrescimos_pedido` para apontar para a nota original
- Deletar a nota tipo "acrescimo"

### 3. Atualizar `ModalRegistrarAcrescimo.tsx`

O componente nao precisa de mudancas significativas pois ja chama a RPC. Apenas ajustar as queries invalidadas (remover query de acrescimos se nao for mais necessaria).

## Detalhes Tecnicos

### Migration SQL - Alterar funcao `registrar_acrescimo_pedido`

Substituir os steps 4 e 5 da funcao por:

```text
-- 4. Buscar cobranca original tipo 'kit' do mesmo kit_entregue_id
SELECT id INTO v_cobranca_id
FROM cobrancas_agendadas
WHERE kit_entregue_id = p_kit_entregue_id
  AND tipo = 'kit'
LIMIT 1;

-- 5. Somar acrescimo ao valor_previsto da nota original
IF v_cobranca_id IS NOT NULL THEN
  UPDATE cobrancas_agendadas
  SET valor_previsto = valor_previsto + p_valor
  WHERE id = v_cobranca_id;
END IF;

-- 6. Vincular acrescimo a nota original
UPDATE acrescimos_pedido
SET cobranca_id = v_cobranca_id
WHERE id = v_acrescimo_id;
```

### Correcao de dados existentes (via insert tool)

```text
-- 1. Somar acrescimos nas notas originais
UPDATE cobrancas_agendadas orig
SET valor_previsto = orig.valor_previsto + acr.valor_previsto
FROM cobrancas_agendadas acr
WHERE acr.tipo = 'acrescimo'
  AND orig.kit_entregue_id = acr.kit_entregue_id
  AND orig.tipo = 'kit';

-- 2. Atualizar cobranca_id dos acrescimos_pedido para apontar para nota original
UPDATE acrescimos_pedido ap
SET cobranca_id = orig.id
FROM cobrancas_agendadas orig
WHERE orig.kit_entregue_id = ap.kit_entregue_id
  AND orig.tipo = 'kit';

-- 3. Deletar notas tipo acrescimo
DELETE FROM cobrancas_agendadas WHERE tipo = 'acrescimo';
```

## Arquivos alterados

- **Migration SQL**: Alterar funcao `registrar_acrescimo_pedido` para somar na nota original
- **Dados**: Corrigir 13 notas existentes

## O que NAO muda

- A tabela `acrescimos_pedido` continua existindo (registro individual de cada acrescimo)
- O `ModalRegistrarAcrescimo.tsx` continua funcionando igual (chama a mesma RPC)
- Fluxo de cobranca parcial e cancelamento
- Visualizacao na agenda (agora mostra valor correto: kit + acrescimos)
