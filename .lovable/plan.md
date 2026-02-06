

# Plano: Mostrar valor original + acrescimos individuais por kit na lista de entregas

## O que sera feito

Na secao "Entregas de Kits" do Fechamento do Dia, cada kit listado passara a mostrar:

1. O **valor original** do kit (ja existente como `valor_previsto`)
2. Cada **acrescimo** registrado para aquele kit, listado individualmente abaixo do valor original, com descricao e valor
3. O total geral no rodape mostrara apenas a **contagem de entregas** (sem somar valores, conforme solicitado)

## Alteracoes em `src/pages/CobrancaDiaria.tsx`

### 1. Nova query para buscar acrescimos dos kits do dia

Adicionar uma query que busca todos os registros de `acrescimos_pedido` vinculados aos kits entregues no dia selecionado:

```text
Query: acrescimos_pedido
Filtro: kit_entregue_id IN (ids dos kits entregues do dia)
Campos: id, kit_entregue_id, valor, descricao, status
```

### 2. Agrupar acrescimos por kit_entregue_id

Criar um mapa (Record) que agrupa os acrescimos por `kit_entregue_id`, para facilitar o acesso no render de cada kit.

### 3. Atualizar a exibicao de cada kit na lista

Cada kit na lista passara de:

```text
[codigo]  [revendedora]  [+ acrescimo] [x excluir]
```

Para:

```text
[codigo]                   [+ acrescimo] [x excluir]
[revendedora]
Kit: R$ 350,00
  Acrescimo: brincos extras - R$ 50,00
  Acrescimo: colar adicional - R$ 80,00
```

Detalhes visuais:
- O valor original do kit aparece com icone DollarSign e cor padrao
- Cada acrescimo aparece com Badge amber "ACRESCIMO" + descricao + valor
- Se nao houver acrescimos, mostra apenas o valor do kit

### 4. Remover total de valores no rodape

No rodape da secao, manter apenas a contagem de entregas (ex: "3 entregas") sem mostrar o total somado dos valores.

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/CobrancaDiaria.tsx` | Nova query de acrescimos, mapa por kit, exibicao individual de valor + acrescimos, remover total de valores do rodape |

## Detalhes Tecnicos

### Nova query de acrescimos

```text
const kitIds = kitsEntreguesDoDia.map(k => k.id)

supabase
  .from('acrescimos_pedido')
  .select('id, kit_entregue_id, valor, descricao, status')
  .in('kit_entregue_id', kitIds)
```

### Mapa de acrescimos

```text
acrescimosMap: Record<string, Array<{id, valor, descricao, status}>>
```

### Render atualizado por kit

Dentro de cada item `entrega` na lista, apos a linha da revendedora:
- Linha com valor do kit: `Kit: R$ X,XX`
- Para cada acrescimo do kit (via `acrescimosMap[entrega.id]`):
  - Badge amber + descricao (ou "Joias adicionais") + valor

### Rodape simplificado

Remover a linha `formatarValor(entregasDoDia.reduce(...))` e manter apenas `{entregasDoDia.length} entregas`.

