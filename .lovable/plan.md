

# Plano: Feedback visual para acrescimos na Agenda de Cobranca

## Resumo

Adicionar feedback visual claro na Agenda de Cobrancas explicando quando e por que o acrescimo nao pode ser utilizado, sem alterar nenhuma regra de negocio existente.

## O que ja funciona

- Badges de tipo (KIT/REPASSE) ja existem no componente `CobrancaItem` (linhas 1383-1398)
- O menu "Registrar joias adicionais" ja aparece apenas para `tipo === 'kit'` (linha 1492)
- A logica de lookup do kit ja existe em `handleAcrescimoClick` (linhas 638-662)

## O que sera alterado

### Arquivo: `src/pages/Cobranca.tsx`

#### 1. Importar componentes de Tooltip

Adicionar imports de `Tooltip`, `TooltipTrigger`, `TooltipContent` e `TooltipProvider` de `@/components/ui/tooltip`, e o icone `Info` de `lucide-react`.

#### 2. Modificar o menu dropdown no `CobrancaItem`

Atualmente o item "Registrar joias adicionais" so aparece quando `cobranca.tipo === 'kit'`. A mudanca sera:

- **Sempre mostrar** o item no dropdown para todas as cobrancas
- Calcular a razao de bloqueio com base nas regras existentes
- Se permitido: item habilitado, funciona como hoje
- Se bloqueado: item desabilitado + icone de informacao com tooltip explicativo

Logica de determinacao:

```text
Se tipo === 'repasse' ou tipo === 'acrescimo':
  razao = "Acrescimos nao sao permitidos em notas de repasse."
  bloqueado = true

Se tipo nao e 'kit' (null ou outro) e nao tem kit_entregue_id:
  razao = "Esta nota nao esta vinculada a um kit."
  bloqueado = true

Se tipo === 'kit' e status === 'pago': (caso futuro)
  razao = "Este kit ja foi quitado. Acrescimos nao sao permitidos."
  bloqueado = true

Caso contrario:
  bloqueado = false
```

#### 3. Implementacao no dropdown

A opcao "Registrar joias adicionais" passara a ser renderizada assim:

- **Quando permitido**: Mesmo comportamento atual, item clicavel em amber
- **Quando bloqueado**: Item com `disabled` visual (opacity reduzida, cursor not-allowed), acompanhado de um icone (Info) com Tooltip mostrando a mensagem explicativa

Como `DropdownMenuItem` nao suporta Tooltip de forma nativa dentro do menu, a abordagem sera:
- Envolver o conteudo do `DropdownMenuItem` com `TooltipProvider` e `Tooltip`
- Usar `onSelect` com `e.preventDefault()` para itens bloqueados, evitando fechamento do menu
- Aplicar classes visuais de desabilitado (`opacity-50 cursor-not-allowed`)

#### 4. Garantir badges visiveis

Os badges de tipo (KIT/REPASSE) ja estao implementados e visiveis na lista. Nenhuma alteracao necessaria nesta parte, pois as linhas 1383-1398 ja exibem o tipo da nota com cores distintas:
- KIT: borda e fundo primary
- REPASSE: borda e fundo muted
- ACRESCIMO: borda e fundo amber

## Resultado visual esperado

Para uma nota de REPASSE no dropdown:

```text
  Reagendar
  Adiantamento
  Registrar joias adicionais  [i]     (desabilitado, cinza)
     "Acrescimos nao sao permitidos em notas de repasse."
  Encaminhar ao Juridico
```

Para uma nota sem kit vinculado:

```text
  Reagendar
  Adiantamento
  Registrar joias adicionais  [i]     (desabilitado, cinza)
     "Esta nota nao esta vinculada a um kit."
  Encaminhar ao Juridico
```

Para uma nota KIT pendente:

```text
  Reagendar
  Adiantamento
  Registrar joias adicionais          (habilitado, amber)
  Encaminhar ao Juridico
```

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Cobranca.tsx` | Import Tooltip + Info icon, logica de bloqueio no CobrancaItem, dropdown com feedback visual |

## Restricoes respeitadas

- Nenhuma regra de negocio alterada
- Nenhum fluxo novo criado
- Nao impacta fechamento, DRE ou KPIs
- Nenhuma funcionalidade removida
- Apenas adicao de feedback visual

