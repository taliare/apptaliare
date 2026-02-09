
# Plano: Correcao do Modelo de Cobranca - Pagamento Parcial sem Gerar Novas Notas

## Problema Atual

Quando ocorre um pagamento parcial, o sistema cria uma nova cobranca (tipo "repasse") com o valor restante e marca a original como "pago". Isso:
- Distorce o ticket medio (mais notas = valor medio menor)
- Quebra o conceito de "uma nota = uma obrigacao"
- Gera volume artificial de notas no sistema

## Nova Logica

- Uma cobranca e criada apenas uma vez, com `valor_previsto` fixo
- Pagamentos parciais abatem o saldo na MESMA cobranca
- Nenhuma nota de repasse e criada automaticamente por pagamento parcial
- Status "parcial" indica que ha saldo pendente
- Status "pago" indica quitacao total

## Alteracoes

### 1. Migracao de Banco de Dados

Adicionar 2 novas colunas a tabela `cobrancas_agendadas`:

```text
valor_pago_acumulado  NUMERIC  DEFAULT 0    -- soma de todos os pagamentos
data_quitacao         DATE     NULLABLE     -- preenchido quando saldo = 0
```

O `saldo_aberto` sera calculado no frontend: `valor_previsto - valor_pago_acumulado - valor_adiantado`

Dados historicos NAO serao alterados. As novas colunas recebem valores default (0 e null).

### 2. Cobranca.tsx (Agenda de Cobranca do Representante)

**Funcao `handlePagamentoParcial`** (linhas ~334-451):
- REMOVER a logica que cria nova `cobrancas_agendadas` com tipo "repasse"
- REMOVER a marcacao da cobranca original como "pago"
- SUBSTITUIR por:
  1. Criar nota promissoria (para o fechamento diario) - mantido igual
  2. Criar prestacao de contas (para KIT) - mantido igual
  3. Atualizar a cobranca original:
     - `valor_pago_acumulado += valor_recebido`
     - `status = 'parcial'`
  4. Se `valor_pago_acumulado >= valor_previsto`:
     - `status = 'pago'`
     - `data_quitacao = data_atual`

**Funcao `handlePagamentoCompleto`** (linhas ~266-331):
- Atualizar para tambem preencher `valor_pago_acumulado = valor_devido_empresa` e `data_quitacao`

**Exibicao dos cards na agenda**:
- Para cobranças com status "parcial", mostrar:
  - Valor total da nota
  - Valor ja pago
  - Saldo em aberto
- Permitir continuar cobrando enquanto status != "pago"

### 3. ModalReceberCobranca.tsx

- Receber nova prop `valor_pago_acumulado` (default 0)
- Calcular e exibir o saldo aberto: `valor_previsto - valor_pago_acumulado - valor_adiantado`
- O "valor a receber" maximo no pagamento parcial deve ser limitado ao saldo aberto
- Exibir informacoes de pagamentos anteriores quando houver (`valor_pago_acumulado > 0`)
- Atualizar texto do toast de sucesso para refletir abatimento e nao criacao de nova nota

### 4. CobrancaDiaria.tsx (Fechamento do Dia)

- Na funcao de busca de nota e cobranca via agenda (handleBuscarNota e fluxo de cobrar):
  - Quando uma nota parcial e cobrada novamente, o fluxo deve seguir a mesma logica nova (abater saldo, nao criar nova cobranca)
- O modal de receber cobranca ja sera atualizado (item 3), entao o comportamento flui naturalmente

### 5. Exibicao na Agenda (Cobranca.tsx - renderizacao dos cards)

- Para cobranças com `valor_pago_acumulado > 0`:
  - Mostrar badge "Parcial" (ja existe no statusConfig)
  - Exibir subtexto: "Pago: R$ X | Saldo: R$ Y"
- Cobranças com status "parcial" continuam aparecendo na lista (ja filtradas por status pendente/parcial/reagendado)

### 6. GerenciarAgenda.tsx (Admin)

- Exibir as novas colunas na tabela administrativa
- Mostrar valor_pago_acumulado e saldo aberto para cada cobranca

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar colunas `valor_pago_acumulado` e `data_quitacao` |
| `src/pages/Cobranca.tsx` | Reescrever `handlePagamentoParcial` e `handlePagamentoCompleto`, atualizar renderizacao dos cards |
| `src/components/cobranca/ModalReceberCobranca.tsx` | Nova prop, exibir saldo aberto, limitar valor parcial ao saldo |
| `src/pages/CobrancaDiaria.tsx` | Atualizar fluxo de cobranca parcial para usar nova logica |
| `src/pages/GerenciarAgenda.tsx` | Exibir colunas novas na tabela admin |

## O que NAO muda

- Dados historicos (notas antigas, repasses existentes permanecem intactos)
- Tabelas `notas_promissorias`, `prestacoes_contas`, `cobrancas_diarias` (estrutura mantida)
- Fluxo de pagamento completo (apenas adiciona preenchimento das novas colunas)
- Fluxo de devolucao total
- Fluxo de adiantamento (continua funcionando com `valor_adiantado`)
- RLS policies existentes
- Dashboard e KPIs (continuam lendo de `cobrancas_diarias`)

## Restricoes respeitadas

- Dados historicos nao sao alterados
- Notas existentes nao sao apagadas
- Nenhum recalculo automatico de notas antigas
- Nova logica aplica-se apenas a novos pagamentos
