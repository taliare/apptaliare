

# Correção urgente: Kit 5708 bloqueado para re-entrega

## Diagnóstico

A desistência do kit 5708 foi executada com o codigo antigo (antes da correção), que apenas marcou a cobrança como "cancelado" sem deletar os registros. Resultado:

- `kits_estoque`: status `com_representante` (correto)
- `kits_entregues`: registro ainda existe (deveria ter sido deletado)
- `cobrancas_agendadas`: registro com status "cancelado" ainda existe (deveria ter sido deletado)

A função `entregar_kit_para_revendedora` verifica se existe registro em `kits_entregues` e bloqueia com "Este kit já foi entregue anteriormente".

## Solução em 2 passos

### 1. Limpeza imediata dos registros órfãos do kit 5708

Migração SQL para deletar os registros que deveriam ter sido removidos pela desistência:

```sql
-- Deletar cobrança cancelada do kit 5708
DELETE FROM cobrancas_agendadas 
WHERE id = 'a33653f2-3042-4075-a184-09375941b3da';

-- Deletar registro de entrega órfão do kit 5708  
DELETE FROM kits_entregues 
WHERE id = '3dc79ad2-b8ff-443a-99cb-83376999b6ab';
```

### 2. Proteção futura na função de entrega

Atualizar a função `entregar_kit_para_revendedora` para que a verificação de duplicidade ignore entregas antigas cujas cobranças foram canceladas. Isso evita que o problema se repita caso alguma desistência futura falhe parcialmente:

```sql
-- Verificação atualizada: só bloquear se existir entrega ATIVA
IF EXISTS (
  SELECT 1 FROM kits_entregues ke
  WHERE ke.codigo_mostruario = v_kit.codigo 
    AND ke.representante_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM cobrancas_agendadas ca
      WHERE ca.kit_entregue_id = ke.id
        AND ca.status = 'cancelado'
    )
) THEN
  RETURN json_build_object(
    'success', false,
    'error', 'Este kit já foi entregue anteriormente'
  );
END IF;
```

## Resultado esperado

Após a migração, o representante BLYNDSON poderá entregar o kit 5708 imediatamente para uma nova revendedora, sem erros.

## Detalhes técnicos

| Alteracao | Tipo |
|---|---|
| Deletar registros orfaos do kit 5708 | Migracao SQL |
| Atualizar verificacao de duplicidade na funcao `entregar_kit_para_revendedora` | Migracao SQL |

Nenhum arquivo de codigo precisa ser alterado.
