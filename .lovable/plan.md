

# Desistência como inverso exato da entrega

## Problema atual

A desistência atual apenas marca a cobrança como "cancelado" e tenta reverter o status do kit. Isso deixa registros órfãos em `kits_entregues` e `cobrancas_agendadas`, que bloqueiam a re-entrega do kit (a função `entregar_kit_para_revendedora` verifica se já existe registro em `kits_entregues`).

## Solução

Usar a função `reverter_entrega_kit_atomico` que já existe no banco e faz exatamente o inverso da entrega em uma única transação:

1. Reverte o status do kit em `kits_estoque` para `com_representante`
2. Deleta os `acrescimos_pedido` vinculados
3. Deleta a `cobrancas_agendadas` associada
4. Deleta o registro em `kits_entregues`

Resultado: o kit fica como se nunca tivesse sido entregue, disponível para nova entrega.

## Alteração

### `src/pages/Cobranca.tsx` - Simplificar `desistenciaMutation`

Substituir toda a lógica manual (update status cancelado + reverter kit) por uma única chamada RPC:

```typescript
const desistenciaMutation = useMutation({
  mutationFn: async (cobrancaId: string) => {
    const cobranca = cobrancas.find(c => c.id === cobrancaId);
    if (!cobranca) throw new Error('Cobrança não encontrada');
    if (!cobranca.kit_entregue_id) throw new Error('Kit entregue não encontrado');

    // Usar função atômica que faz o inverso completo da entrega
    const { data: resultado, error } = await supabase.rpc('reverter_entrega_kit_atomico', {
      p_kit_entregue_id: cobranca.kit_entregue_id,
      p_user_id: userId,
    });

    if (error) throw error;
    const res = resultado as { success: boolean; error?: string };
    if (!res.success) throw new Error(res.error || 'Erro ao reverter entrega');
  },
  // ... invalidate queries on success
});
```

Nenhuma alteração no banco de dados é necessária - a função `reverter_entrega_kit_atomico` já existe e faz tudo que é preciso.

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/pages/Cobranca.tsx` | Substituir lógica da `desistenciaMutation` por chamada a `reverter_entrega_kit_atomico` |

## O que muda no comportamento

- Antes: cobrança ficava com status "cancelado", registros mantidos, kit bloqueado para re-entrega
- Depois: todos os registros são deletados, kit volta ao estoque limpo, disponível para nova entrega imediata
