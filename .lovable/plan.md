
# Corrigir Logica de Cobranca Parcial - Atualizar Valor da Nota e Data

## Problema

Quando o representante cobra um kit (valor original R$5.000) e registra a venda (R$1.000), o sistema calcula corretamente a comissao (R$400) e o valor a receber (R$600). Porem:

1. **O `valor_previsto` da nota continua R$5.000** em vez de atualizar para R$600 (o valor_devido_empresa)
2. **A `data_agendada` nao e atualizada** para a nova data de cobranca informada pelo representante
3. O saldo em aberto calcula errado: `5000 - 0 = 5000` em vez de `600 - 0 = 600`
4. Na agenda, a nota aparece com R$5.000 em vez de R$600

## Solucao

### Logica correta (exemplo do usuario)

- Kit = R$5.000
- Venda = R$1.000, comissao = R$400, valor_devido = R$600
- Representante registra pagamento parcial de R$0, proxima data = 30/02
- Sistema atualiza: `valor_previsto = 600`, `data_agendada = 30/02`, `valor_pago_acumulado = 0`, status = `parcial`
- Na agenda aparece: nota de R$600 para dia 30/02
- Dia 30: revendedora paga R$300, proxima data = 15/03
- Sistema atualiza: `valor_pago_acumulado = 300`, `data_agendada = 15/03`, status = `parcial`
- Na agenda aparece: nota com saldo R$300 para dia 15/03
- Dia 15: paga R$300 restante, `valor_pago_acumulado = 600`, status = `pago`

### Arquivos alterados

#### 1. `src/pages/Cobranca.tsx` - handlePagamentoParcial

Na primeira cobranca de um KIT (quando `valor_pago_acumulado == 0` e tipo nao e repasse):
- Atualizar `valor_previsto` para `dados.valor_devido_empresa + dados.valor_recebido` (o total que a revendedora deve a empresa)
- Recalcular saldo usando o novo `valor_previsto`

Em TODOS os pagamentos parciais:
- Atualizar `data_agendada` para `dados.data_repasse` (a nova data informada)

#### 2. `src/pages/CobrancaDiaria.tsx` - handlePagamentoParcial

Aplicar a mesma logica do Cobranca.tsx (esse arquivo tem a mesma funcao duplicada para o fluxo de busca de nota na cobranca diaria).

#### 3. `src/components/cobranca/ModalReceberCobranca.tsx` - Corrigir dados enviados

- Quando e a primeira cobranca de um KIT, o `valor_devido_empresa` enviado ao callback deve ser o `valorAReceber` total (antes do parcial), nao o `valorEfetivoReceber`
- O `valor_recebido` continua sendo o `valorEfetivoReceber` (o que de fato foi pago agora)

#### 4. Corrigir notas existentes com status parcial

- Criar uma query para atualizar notas existentes que ja estao com status `parcial` e tipo `kit`: buscar a prestacao_contas vinculada, pegar o `valor_devido_empresa`, e atualizar o `valor_previsto` da cobranca para esse valor.

### Detalhes tecnicos

**Em `handlePagamentoParcial` (Cobranca.tsx e CobrancaDiaria.tsx):**

```text
// Antes de calcular saldo:
// Se e primeira cobranca de KIT, atualizar valor_previsto para valor_devido_empresa
let valorPrevistoEfetivo = cobranca.valor_previsto;
const acumuladoAtual = cobranca.valor_pago_acumulado || 0;

if (acumuladoAtual === 0 && cobranca.tipo !== 'repasse') {
  // Primeira cobranca: valor_previsto passa a ser o total devido a empresa
  valorPrevistoEfetivo = dados.valor_devido_empresa + dados.valor_recebido;
  updateData.valor_previsto = valorPrevistoEfetivo;
}

// Sempre atualizar data_agendada para a proxima data
updateData.data_agendada = format(dados.data_repasse, 'yyyy-MM-dd');

// Recalcular saldo com o valor correto
const novoAcumulado = acumuladoAtual + dados.valor_recebido;
const saldoAberto = valorPrevistoEfetivo - novoAcumulado - valorAdiantado;
```

**Em `ModalReceberCobranca.tsx`:**

- Garantir que `valor_devido_empresa` no callback parcial seja o `valorAReceber` total (nao o efetivo parcial)

**Correcao de dados existentes (migration SQL):**

```text
UPDATE cobrancas_agendadas ca
SET valor_previsto = pc.valor_devido_empresa
FROM prestacoes_contas pc
WHERE pc.cobranca_id = ca.id
  AND ca.status = 'parcial'
  AND ca.tipo = 'kit'
  AND pc.valor_devido_empresa > 0
  AND ca.valor_previsto != pc.valor_devido_empresa;
```

### O que NAO muda

- Calculo de comissao
- Fluxo de pagamento completo
- Logica de adiantamento
- Notas promissorias
- DRE e Dashboard (usam cobrancas_diarias como fonte oficial)
