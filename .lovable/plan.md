

# Corrigir layout dos cards de ranking

## Resumo
Substituir o bloco de rankings (linhas 208-254) por uma versão com melhor espaçamento, truncation nos nomes e alinhamento correto entre nome e valor.

## Alteração em `src/pages/T2RepresentantesPerformance.tsx`

### Bloco único: linhas 208-254
Substituir os 3 cards de ranking por versão com:
- `CardHeader` com `pb-3` e `CardTitle` usando `flex items-center gap-2`
- `CardContent` com `space-y-3`
- Cada item: `flex items-center justify-between gap-2` com inner div `min-w-0` para truncation
- Números de posição com `w-4 shrink-0`
- Nomes com `truncate`
- Valores com `shrink-0`

Nenhuma lógica, query ou cálculo alterado.

### Arquivo afetado
- `src/pages/T2RepresentantesPerformance.tsx` — 1 bloco (linhas 208-254)

