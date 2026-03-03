

# Correção: Nota parcial pedindo valor da venda

## Problema

A condição `isSubsequente` no `ModalReceberCobranca.tsx` usa apenas `valor_pago_acumulado > 0`. Porém, existem 4 notas com `status = 'parcial'` onde `valor_pago_acumulado = 0` (a prestação registrou a venda/comissão mas o pagamento foi zero). Nesses casos, o modal pede valor da venda novamente, o que é incorreto.

**Notas afetadas**: 5349 (Maria de Fátima), 5314 (Jaqueline Lima), 5440 (Bruna Pereira), 5513 (Adriane Xavier).

## Solução

### 1. Passar `status` da cobrança para o modal

Em `src/pages/Cobranca.tsx`, incluir o campo `status` no objeto `cobranca` passado ao `ModalReceberCobranca`.

### 2. Atualizar a condição `isSubsequente`

Em `src/components/cobranca/ModalReceberCobranca.tsx` (linha 76), mudar:

```typescript
// De:
const isSubsequente = valor_pago_acumulado > 0;

// Para:
const isSubsequente = valor_pago_acumulado > 0 || cobranca.status === 'parcial';
```

Isso garante que qualquer nota já marcada como parcial (já teve prestação registrada) entre no modo subsequente, independentemente do valor acumulado.

### 3. Atualizar a interface `ModalReceberCobrancaProps`

Adicionar `status?: string` ao tipo do objeto `cobranca` na interface do componente.

Nenhuma alteração de banco de dados necessária.

