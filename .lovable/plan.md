

# Liberar Alteracao de Data na Cobranca para Admin

## Problema
No `ModalReceberCobranca`, o calendario de "Data da Cobranca" restringe a selecao de datas para todos os usuarios igualmente: so permite o dia atual ou dias passados nao finalizados. O admin precisa ter liberdade total para selecionar qualquer data.

## Solucao

### Alteracao no `ModalReceberCobranca.tsx`
1. Adicionar prop opcional `isAdmin?: boolean` na interface `ModalReceberCobrancaProps`
2. Quando `isAdmin` for `true`, remover a restricao do calendario (a funcao `disabled` do Calendar nao bloqueia nenhuma data)
3. Quando `isAdmin` for `false` ou ausente, manter o comportamento atual

Trecho afetado (linhas 522-531):
```typescript
disabled={(date) => {
  if (isAdmin) return false; // Admin pode selecionar qualquer data
  // ... logica existente para representante
}}
```

### Alteracao no `AdminDayActions.tsx` (linha 676)
Passar `isAdmin={true}` ao renderizar `ModalReceberCobranca`.

### Arquivos que NAO mudam
- `CobrancaDiaria.tsx` e `Cobranca.tsx` continuam sem passar `isAdmin`, mantendo a restricao para representantes.

## Resumo de alteracoes
- `src/components/cobranca/ModalReceberCobranca.tsx`: adicionar prop `isAdmin` e condicional no `disabled` do Calendar
- `src/components/fechamento/AdminDayActions.tsx`: passar `isAdmin={true}`

