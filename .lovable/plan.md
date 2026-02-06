

# Plano: Mostrar valor original + acrescimos na Agenda de Cobranca

## O que sera feito

Na Agenda de Cobrancas, cada cobranca do tipo "kit" passara a exibir:

1. O **valor original** do kit
2. A lista de **joias adicionais** (acrescimos) vinculadas, cada uma com descricao e valor
3. O **valor total** (original + acrescimos) em destaque

A opcao "Registrar joias adicionais" no menu "Mais opcoes" ja existe e continuara funcionando normalmente.

## Alteracoes em `src/pages/Cobranca.tsx`

### 1. Nova query para buscar acrescimos de todos os kits da agenda

Adicionar uma query `useQuery` que busca todos os registros de `acrescimos_pedido` vinculados aos `kit_entregue_id` das cobrancas visíveis na agenda. Isso permite saber quais kits tem joias adicionais e seus valores.

### 2. Criar mapa de acrescimos agrupados por kit_entregue_id

Um `useMemo` que agrupa os acrescimos por `kit_entregue_id`, permitindo acesso rapido no componente `CobrancaItem`.

### 3. Passar acrescimos para o componente `CobrancaItem`

O componente `CobrancaItem` recebera uma nova prop `acrescimos` (array de acrescimos daquele kit, ou array vazio se nao houver).

### 4. Atualizar exibicao no `CobrancaItem`

Para cobrancas do tipo "kit" que possuam acrescimos:

```text
Revendedora          [badges]
Kit ABC-123
Valor Kit: R$ 350,00
  + brincos extras: R$ 50,00
  + colar adicional: R$ 80,00
Total: R$ 480,00        [Cobrar] [Mais opcoes]
```

- O valor original continua exibido normalmente
- Abaixo, cada acrescimo aparece com badge amber e valor individual
- Uma linha "Total" mostra a soma (valor original + todos os acrescimos) em destaque
- Se nao houver acrescimos, a exibicao permanece como esta hoje (so o valor original)

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Cobranca.tsx` | Nova query de acrescimos, mapa por kit, prop no CobrancaItem, exibicao de acrescimos individuais e total |

## Detalhes Tecnicos

### Query de acrescimos

```text
// Extrair kit_entregue_ids unicos das cobrancas
const kitEntregueIds = cobrancas
  .filter(c => c.kit_entregue_id)
  .map(c => c.kit_entregue_id)

// Query
supabase
  .from('acrescimos_pedido')
  .select('id, kit_entregue_id, valor, descricao, status')
  .in('kit_entregue_id', kitEntregueIds)
```

### Mapa de acrescimos

```text
acrescimosMap: Record<string, Array<{id, valor, descricao, status}>>
// Chave: kit_entregue_id
// Valor: array de acrescimos
```

### CobrancaItem - nova prop e render

Nova prop:
```text
acrescimos: Array<{id: string, valor: number, descricao: string | null, status: string}>
```

Logica de render:
- Se `acrescimos.length > 0`, mostrar lista de acrescimos abaixo do valor original
- Calcular `totalComAcrescimos = cobranca.valor_previsto + soma(acrescimos.valor)`
- Exibir linha "Total com acrescimos: R$ X,XX" em verde/destaque
- Se nao houver acrescimos, exibir apenas `valor_previsto` como hoje

