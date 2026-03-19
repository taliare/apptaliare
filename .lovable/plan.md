

# Correção: Kit entregue continua "disponível"

## Problema

A tabela `t2_pedidos` não possui política RLS de UPDATE para representantes. Quando o representante entrega um kit, o código tenta atualizar o status do pedido para `em_ciclo`, mas o banco rejeita silenciosamente a operação. O pedido permanece com status `disponivel`.

## Solução

### 1. Migração SQL — Adicionar política de UPDATE

Criar uma RLS policy que permita representantes atualizarem seus próprios pedidos:

```sql
CREATE POLICY "Representante pode atualizar seus t2_pedidos"
  ON public.t2_pedidos FOR UPDATE TO authenticated
  USING (representante_id = auth.uid())
  WITH CHECK (representante_id = auth.uid());
```

### 2. Frontend — Tratar erros no update de status

Em `T2MeusKits.tsx`, adicionar verificação de erro no loop de update (linhas 103-105) para que falhas não passem despercebidas:

```typescript
for (const pid of selectedPedidoIds) {
  const { error: updateError } = await supabase
    .from('t2_pedidos')
    .update({ status: 'em_ciclo' })
    .eq('id', pid);
  if (updateError) throw updateError;
}
```

Aplicar a mesma correção em `T2Ciclos.tsx` (linhas 189-191) que tem o mesmo padrão sem tratamento de erro.

