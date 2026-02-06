

# Plano: Corrigir registro de joias adicionais na Agenda de Cobranca

## Problemas identificados

### 1. Query de acrescimos nao atualiza apos registro
O `ModalRegistrarAcrescimo` invalida as queries `cobrancas-agendadas`, `kits-entregues-representante` e `acrescimos-kits-dia`, mas **NAO invalida** a query `acrescimos-kits-agenda` usada pela pagina de Agenda de Cobranca. Resultado: mesmo que o registro funcione, os acrescimos nao aparecem na tela ate recarregar manualmente.

### 2. Lookup pode falhar silenciosamente
A funcao `handleAcrescimoClick` faz lookup pela coluna `codigo_mostruario` na tabela `kits_entregues`, mas muitas cobrancas podem nao ter `kit_entregue_id` nem `codigo_nota` compativel, impedindo a abertura do modal.

## Correcoes

### Arquivo 1: `src/components/cobranca/ModalRegistrarAcrescimo.tsx`

Adicionar invalidacao da query `acrescimos-kits-agenda` no `onSuccess` da mutation, para que a Agenda de Cobranca atualize imediatamente apos registrar um acrescimo.

```text
// Adicionar esta linha ao onSuccess:
queryClient.invalidateQueries({ queryKey: ['acrescimos-kits-agenda'] });
```

### Arquivo 2: `src/pages/Cobranca.tsx`

Nenhuma alteracao estrutural necessaria - o fluxo de `handleAcrescimoClick`, o dropdown menu e o `ModalRegistrarAcrescimo` ja estao corretamente conectados. O unico problema era a falta de invalidacao da query no modal.

## Resumo

| Arquivo | Alteracao |
|---|---|
| `src/components/cobranca/ModalRegistrarAcrescimo.tsx` | Adicionar invalidacao de `acrescimos-kits-agenda` no onSuccess |

## Impacto

Apos essa correcao, ao registrar joias adicionais pelo menu "Mais opcoes" > "Registrar joias adicionais", o acrescimo sera salvo E a lista da agenda atualizara imediatamente mostrando o valor original + acrescimos individuais + total.

