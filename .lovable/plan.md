

# Correção do bug "Pendente apuração" na aba Ativas

## Problema
A query de prestações busca todas do representante mas o `prestacaoMap` usa `cobranca_id` como chave. Como a query não filtra pelos IDs das cobranças ativas, o match com `c.id` falha.

## Alteração em `src/pages/RevendedorasInativas.tsx` (linhas 106-111)

Substituir o bloco de busca de prestações por uma versão que filtra pelos `cobranca_id` das cobranças ativas:

```typescript
// Buscar prestações APENAS das cobranças ativas
const cobrancaIds = cobrancas?.map(c => c.id) || [];
let prestacaoMap = new Map<string, boolean>();

if (cobrancaIds.length > 0) {
  const { data: prestacoes } = await supabase
    .from('prestacoes_contas')
    .select('cobranca_id')
    .in('cobranca_id', cobrancaIds);
  
  prestacoes?.forEach(p => {
    if (p.cobranca_id) prestacaoMap.set(p.cobranca_id, true);
  });
}
```

O resto do agrupamento (linhas 113-137) permanece inalterado — a chamada `prestacaoMap.has(c.id)` agora vai funcionar corretamente porque o map contém exatamente os IDs das cobranças que têm prestação vinculada.

### Arquivo afetado
- `src/pages/RevendedorasInativas.tsx` — 1 bloco substituído (linhas 106-111)

