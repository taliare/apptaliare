

# Correção: Reversão de Nota no Fechamento Não Restaura Valor Original

## Diagnóstico

Quando o representante remove uma nota do fechamento (`excluirNotaDaCobrancaMutation` em `CobrancaDiaria.tsx`, linhas 651-773), o código tenta restaurar `valor_previsto` ao valor original do kit consultando `kits_estoque` diretamente. **Porém, a política RLS de `kits_estoque` filtra por `status = 'com_representante'`**, e após a entrega o kit está como `'com_revendedora'`. A query retorna `null` silenciosamente e o `valor_previsto` fica com o valor da venda (2500) em vez do valor do kit (4630).

Além disso, a deleção de `prestacoes_contas` usa `data_execucao = dateStr`, o que pode deletar múltiplas prestações do mesmo dia indevidamente. O correto é usar `codigo_nota_referencia` da nota sendo removida.

## Solução

### 1. Criar função SECURITY DEFINER para obter valor original do kit

Migração SQL:

```sql
CREATE OR REPLACE FUNCTION public.get_valor_original_kit(p_kit_entregue_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ks.valor
  FROM kits_entregues ke
  JOIN kits_estoque ks ON ks.id = ke.kit_estoque_id
  WHERE ke.id = p_kit_entregue_id
$$;
```

### 2. Atualizar `excluirNotaDaCobrancaMutation` em `CobrancaDiaria.tsx`

Substituir o bloco de restauração (linhas 699-718) por:

```typescript
// Se novoAcumulado == 0, restaurar valor_previsto para o valor original do kit
if (novoAcumulado === 0 && cobrancaOriginal.kit_entregue_id) {
  const { data: valorOriginal } = await supabase
    .rpc('get_valor_original_kit', { p_kit_entregue_id: cobrancaOriginal.kit_entregue_id });
  
  if (valorOriginal) {
    updateData.valor_previsto = valorOriginal;
  }
}
```

E substituir a deleção de prestações (linhas 728-732) para usar `codigo_nota_referencia` em vez de `data_execucao`:

```typescript
// Deletar prestação vinculada a esta nota específica
if (nota.codigo_nota) {
  await supabase
    .from('prestacoes_contas')
    .delete()
    .eq('cobranca_id', cobrancaOriginal.id)
    .eq('codigo_nota_referencia', nota.codigo_nota);
}

// Fallback: se não achou por codigo_nota_referencia, deletar por data
if (!nota.codigo_nota) {
  await supabase
    .from('prestacoes_contas')
    .delete()
    .eq('cobranca_id', cobrancaOriginal.id)
    .eq('data_execucao', dateStr);
}
```

### Resumo do comportamento após correção

- **Primeira prestação revertida** (acumulado → 0): `valor_previsto` volta ao valor original do kit via função SECURITY DEFINER. Prestação deletada.
- **Pagamento parcial/subsequente revertido** (acumulado > 0): Apenas subtrai do acumulado, `valor_previsto` não muda. Prestação específica deletada.

### Arquivos alterados
- `CobrancaDiaria.tsx` — lógica de reversão
- Nova migração SQL — função `get_valor_original_kit`

