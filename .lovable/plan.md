
# Corrigir Fluxo Reverso: Restaurar valor_previsto ao Cancelar Cobranca

## Problema

Quando o representante remove uma nota do fechamento do dia (cancela a cobranca), o sistema:
- Reverte o `valor_pago_acumulado` (correto)
- Reverte o `status` para pendente (correto)
- **NAO reverte o `valor_previsto`** para o valor original do kit (BUG)
- **NAO deleta a `prestacao_contas`** associada (dados orfaos ficam no banco)

Exemplo real: nota da TAIANA GISELE M. SOARES (kit 5456)
- Valor original do kit: R$4.460
- Apos cobranca de teste: `valor_previsto` foi atualizado para R$600 (valor devido)
- Apos cancelar a cobranca: `valor_previsto` ficou em R$600 em vez de voltar para R$4.460
- Ha 3 prestacoes orfas no banco vinculadas a essa cobranca

## Solucao

### 1. Corrigir `excluirNotaDaCobrancaMutation` em `src/pages/CobrancaDiaria.tsx` (linhas 652-743)

Ao remover uma nota do fechamento:

- **Buscar o valor original do kit** via `kits_estoque` (atraves de `kit_entregue_id` -> `kits_entregues` -> `kits_estoque`)
- **Restaurar `valor_previsto`** para o valor original do kit quando `novoAcumulado == 0` (ou seja, todo pagamento do dia foi revertido e nao ha pagamentos anteriores)
- **Deletar a `prestacao_contas`** vinculada a essa nota promissoria (mesma `cobranca_id` e `data_execucao`)

Logica detalhada:

```text
// Dentro da excluirNotaDaCobrancaMutation, apos reverter acumulado:

// 1. Deletar a prestacao_contas vinculada a essa cobranca + data
await supabase.from('prestacoes_contas').delete()
  .eq('cobranca_id', cobrancaOriginal.id)
  .eq('data_execucao', dateStr);

// 2. Se novoAcumulado == 0, restaurar valor_previsto original
if (novoAcumulado === 0 && cobrancaOriginal.kit_entregue_id) {
  // Buscar valor original do kit
  const { data: kitEntregue } = await supabase
    .from('kits_entregues').select('kit_estoque_id')
    .eq('id', cobrancaOriginal.kit_entregue_id).single();
  
  if (kitEntregue?.kit_estoque_id) {
    const { data: kitEstoque } = await supabase
      .from('kits_estoque').select('valor')
      .eq('id', kitEntregue.kit_estoque_id).single();
    
    if (kitEstoque?.valor) {
      updateData.valor_previsto = kitEstoque.valor;
    }
  }
}
```

### 2. Corrigir dados da TAIANA GISELE (correcao pontual no banco)

Executar via ferramenta de dados:

- Atualizar `valor_previsto` da cobranca `821d09b8-...` de 600 para 4460 (valor original do kit)
- Deletar as 3 prestacoes orfas vinculadas a essa cobranca (IDs: `ca2960c3`, `affff236`, `378fbd19`)

```text
-- Restaurar valor_previsto original
UPDATE cobrancas_agendadas
SET valor_previsto = 4460
WHERE id = '821d09b8-f3a3-4ae6-877e-a32aa9e32334';

-- Deletar prestacoes orfas de teste
DELETE FROM prestacoes_contas
WHERE cobranca_id = '821d09b8-f3a3-4ae6-877e-a32aa9e32334';
```

### 3. Verificar se ha outros casos similares no banco

Consultar se existem outras cobranacas com `status = 'pendente'` e `valor_pago_acumulado = 0` que tem prestacoes vinculadas (indicando que foram cobradas e canceladas sem restaurar o valor).

## Arquivos alterados

- `src/pages/CobrancaDiaria.tsx` - Corrigir `excluirNotaDaCobrancaMutation` para restaurar `valor_previsto` e deletar prestacoes ao cancelar

## O que NAO muda

- Fluxo de cobranca parcial (ja corrigido anteriormente)
- Logica de pagamento completo
- Nenhuma outra pagina e alterada
