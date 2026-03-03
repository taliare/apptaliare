

# Unificar Notas de Repasse com o Fluxo de Parcial

## Situação Atual

Notas de tipo `repasse` têm um código separado no modal e nos handlers de pagamento. Na prática, um repasse é uma nota onde a primeira prestação de contas já foi feita - o `valor_previsto` já representa o saldo devedor real. Mas o modal trata `isRepasse` como um fluxo diferente de `isSubsequente`, com inicialização e cálculo de comissão distintos.

## O que Funciona Hoje

- O acúmulo de pagamentos (`valor_pago_acumulado`) já funciona para repasses
- A quitação (status → `pago`) já funciona quando saldo chega a zero
- Os handlers já não criam prestação de contas duplicada para repasses (check `!== 'repasse'`)

## O que Precisa Mudar

### 1. `ModalReceberCobranca.tsx` - Tratar repasse como subsequente

Alterar a condição `isSubsequente` para incluir repasses:
```typescript
const isSubsequente = valor_pago_acumulado > 0 || cobranca.status === 'parcial' || isRepasse;
```

Isso garante que repasses:
- Não pedem "Valor da Venda" e comissão (já calculados na primeira prestação)
- Usam `saldoAberto` como valor a receber (que para repasse fresco = `valor_previsto`)
- Seguem exatamente o mesmo fluxo visual das notas parciais

### 2. `ModalReceberCobranca.tsx` - Simplificar inicialização

Remover o branch separado para `isRepasse` no `useEffect` (linhas 116-118), pois agora repasses caem no branch `isSubsequente`.

### 3. `ModalReceberCobranca.tsx` - Simplificar `calcularComissao`

Remover o tratamento especial de `isRepasse` (linhas 139-144), pois repasses nunca mais entrarão nessa função (o campo de venda fica escondido no modo subsequente).

### 4. Manter handlers de pagamento como estão

Os checks `!== 'repasse'` em `Cobranca.tsx` e `CobrancaDiaria.tsx` continuam necessários para evitar:
- Criação de prestação de contas duplicada
- Sobrescrita do `valor_previsto` (que já está correto para repasses)

### Arquivos alterados
- `src/components/cobranca/ModalReceberCobranca.tsx` (3 alterações pontuais)

Nenhuma alteração de banco de dados necessária.

