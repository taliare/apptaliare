

# Plano: Adicionar opcao de acrescimo no Fechamento do Dia e corrigir na Agenda de Cobranca

## Problema Identificado

Existem **dois problemas** distintos:

1. **Fechamento do Dia (CobrancaDiaria.tsx)**: A pagina nao possui NENHUMA funcionalidade de acrescimo. Nao existe o modal, nem botoes, nem imports relacionados.

2. **Agenda de Cobranca (Cobranca.tsx)**: A opcao "Registrar joias adicionais" existe no codigo, mas so aparece quando `cobranca.tipo === 'kit' AND cobranca.kit_entregue_id != null`. Existem 41 cobrancas do tipo kit sem `kit_entregue_id` preenchido (registros mais antigos, antes da implementacao), para as quais a opcao nao aparece.

---

## Etapa 1: Adicionar funcionalidade de acrescimo no Fechamento do Dia (CobrancaDiaria.tsx)

### 1a. Importar o modal e adicionar estados

- Importar `ModalRegistrarAcrescimo` de `@/components/cobranca/ModalRegistrarAcrescimo`
- Importar icone `Plus` do lucide-react
- Adicionar estados: `modalAcrescimoOpen` e `cobrancaParaAcrescimo`

### 1b. Botao de acrescimo na busca de nota

No dialog "Buscar Nota", quando uma nota e encontrada e e do tipo `kit`, adicionar um botao "Registrar joias adicionais" ao lado do botao "Cobrar". Ao clicar:
- Fecha o dialog de busca
- Abre o modal de acrescimo com os dados da cobranca encontrada

### 1c. Botao de acrescimo na entrega de kit

No dialog "Registrar Entrega de Kit", apos selecionar o kit e preencher os dados, adicionar uma secao opcional (identica a que foi feita em Kits.tsx):
- Botao `[ + Adicionar valor adicional ]`
- Campos: Valor (R$) e Observacao
- Lista dinamica (multiplos acrescimos)
- No submit, apos a entrega via RPC, chamar `registrar_acrescimo_pedido` para cada acrescimo

### 1d. Renderizar o modal de acrescimo

Adicionar o componente `ModalRegistrarAcrescimo` no final do JSX, conectado aos estados criados.

---

## Etapa 2: Melhorar a condicao na Agenda de Cobranca (Cobranca.tsx)

### Situacao atual

A opcao "Registrar joias adicionais" so aparece quando:
```text
cobranca.tipo === 'kit' && cobranca.kit_entregue_id
```

Isso exclui 41 cobrancas tipo `kit` que nao possuem `kit_entregue_id` (registros anteriores a implementacao).

### Solucao

Relaxar a condicao para mostrar a opcao para TODOS os kits. Para kits sem `kit_entregue_id`, buscar o ID correspondente na tabela `kits_entregues` usando o `codigo_nota` antes de abrir o modal.

Alterar a funcao `handleAcrescimoClick` para:
1. Se a cobranca ja tem `kit_entregue_id`, abrir o modal diretamente
2. Se nao tem, fazer um lookup rapido: buscar em `kits_entregues` pelo `codigo_mostruario` = `cobranca.codigo_nota`
3. Se encontrar, abrir o modal com o `kit_entregue_id` encontrado
4. Se nao encontrar, exibir um toast de erro informando que o kit nao foi encontrado

Alterar a condicao no `DropdownMenu` de:
```text
cobranca.tipo === 'kit' && cobranca.kit_entregue_id
```
Para:
```text
cobranca.tipo === 'kit'
```

---

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/CobrancaDiaria.tsx` | Adicionar import do modal, estados, botao de acrescimo na busca de nota, secao de acrescimos na entrega de kit, renderizar modal |
| `src/pages/Cobranca.tsx` | Relaxar condicao do menu para kits sem kit_entregue_id, adicionar lookup automatico |

---

## Detalhes Tecnicos

### CobrancaDiaria.tsx - Novos estados
```text
- modalAcrescimoOpen: boolean
- cobrancaParaAcrescimo: Cobranca | null
```

### CobrancaDiaria.tsx - Botao no dialog "Buscar Nota"
Ao lado do botao "Cobrar", adicionar botao "Joias adicionais" (visivel apenas para tipo kit com kit_entregue_id). Ao clicar:
1. Fechar dialog de busca
2. Setar cobrancaParaAcrescimo
3. Abrir modalAcrescimoOpen

### CobrancaDiaria.tsx - Secao de acrescimos na entrega de kit
Reutilizar o mesmo padrao do Kits.tsx:
- Array local de acrescimos [{valor, observacao}]
- Botao para adicionar/remover itens
- Apos entregaKitMutation.onSuccess, chamar registrar_acrescimo_pedido para cada acrescimo

### Cobranca.tsx - Lookup de kit_entregue_id
Nova funcao handleAcrescimoClick que faz lookup quando necessario:
```text
1. Se cobranca.kit_entregue_id existe -> abrir modal direto
2. Se nao existe -> buscar kit_entregue_id via supabase query
3. Se encontrar -> setar no state e abrir modal
4. Se nao encontrar -> toast.error("Kit nao encontrado")
```

