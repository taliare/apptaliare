
# Plano: Corrigir legibilidade do grafico "Estoque por Tipo" no tema escuro

## Problema

No grafico de pizza "Estoque por Tipo" do Painel Admin, os rotulos (labels) dos segmentos usam cor preta por padrao, tornando-os invisiveis no fundo escuro do tema dark.

A causa esta na linha 644 do arquivo `src/pages/DashboardAdmin.tsx`:

```text
label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
```

Os labels sao renderizados como texto SVG sem cor definida, resultando em preto (`#000`).

## Solucao

Trocar o label de uma funcao que retorna string para uma funcao que retorna um elemento SVG `<text>` com a cor `hsl(var(--foreground))`, que se adapta automaticamente ao tema ativo (branco no escuro, escuro no claro).

### Arquivo: `src/pages/DashboardAdmin.tsx`

Substituir a prop `label` do componente `Pie` (linha 644) de:

```text
label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
```

Para uma render function que retorna um elemento `<text>` SVG:

```text
label={({ name, percent, x, y }) => (
  <text
    x={x}
    y={y}
    fill="hsl(var(--foreground))"
    textAnchor="middle"
    dominantBaseline="central"
    fontSize={12}
  >
    {`${name} ${(percent * 100).toFixed(0)}%`}
  </text>
)}
```

Tambem sera adicionada a prop `itemStyle` no Tooltip para garantir que o texto dentro do tooltip use a cor correta:

```text
itemStyle={{ color: 'hsl(var(--foreground))' }}
```

## Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/DashboardAdmin.tsx` | Label do PieChart com cor adaptavel ao tema + tooltip legivel |

## O que NAO muda

- Dados exibidos no grafico
- Layout ou posicao do grafico
- Nenhuma logica de negocio
- Nenhum outro componente
