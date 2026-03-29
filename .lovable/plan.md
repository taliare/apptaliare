

# Formatação monetária nos inputs

## Resumo
Adicionar funções `formatarInputMoeda` e `parseInputMoeda` em `utils.ts` e aplicá-las em todos os inputs monetários de `ModalReceberCobranca.tsx`.

## Alterações

### 1. `src/lib/utils.ts` — Adicionar duas funções ao final
- `formatarInputMoeda(valor)`: formata string digitada como "1.234,56" (máscara automática)
- `parseInputMoeda(valor)`: converte string formatada para number

### 2. `src/components/cobranca/ModalReceberCobranca.tsx`

**Import** (linha 13): adicionar `formatarInputMoeda, parseInputMoeda`

**`handleValorDevolvidoChange`** (linhas 152-166): usar `formatarInputMoeda` para formatar e `parseInputMoeda` para converter

**`handleDescontoChange`** (linhas 168-182): mesma abordagem — `formatarInputMoeda` + `parseInputMoeda`

**Input valorParcial** (linhas 598-605): onChange usa `formatarInputMoeda`

**Input pagamento1.valor** (linha 710): onChange usa `formatarInputMoeda`

**Input pagamento2.valor** (linha 764): onChange usa `formatarInputMoeda`

**Todos os `parseFloat(...replace(',', '.'))` restantes** — substituir por `parseInputMoeda(...)`:
- Linha 224: `parseFloat(pagamento1.valor.replace(',', '.'))` → `parseInputMoeda(pagamento1.valor)`
- Linha 225: `parseFloat(pagamento2.valor.replace(',', '.'))` → `parseInputMoeda(pagamento2.valor)`
- Linha 231: `parseFloat(valorParcial.replace(',', '.'))` → `parseInputMoeda(valorParcial)`
- Linha 271: `parseFloat(pagamento1.valor.replace(',', '.'))` → `parseInputMoeda(pagamento1.valor)`
- Linha 277: `parseFloat(pagamento2.valor.replace(',', '.'))` → `parseInputMoeda(pagamento2.valor)`
- Linha 282: `parseFloat(valorDevolvido.replace(',', '.'))` → `parseInputMoeda(valorDevolvido)`
- Linha 324: `parseFloat(pagamento1.valor.replace(',', '.'))` → `parseInputMoeda(pagamento1.valor)`
- Linha 330: `parseFloat(pagamento2.valor.replace(',', '.'))` → `parseInputMoeda(pagamento2.valor)`
- Linha 336: `parseFloat(valorDevolvido.replace(',', '.'))` → `parseInputMoeda(valorDevolvido)`
- Linha 434: `parseFloat(valorDevolvido.replace(',', '.'))` → `parseInputMoeda(valorDevolvido)`
- Linha 436: `parseFloat(valorDevolvido.replace(',', '.'))` → `parseInputMoeda(valorDevolvido)`
- Linha 543: `parseFloat(desconto.replace(',', '.'))` (x2) → `parseInputMoeda(desconto)`
- Linha 553: `parseFloat(valorDevolvido.replace(',', '.'))` → `parseInputMoeda(valorDevolvido)`

### Arquivos afetados
- `src/lib/utils.ts` — 2 funções adicionadas
- `src/components/cobranca/ModalReceberCobranca.tsx` — import + handlers + ~15 substituições de parseFloat

