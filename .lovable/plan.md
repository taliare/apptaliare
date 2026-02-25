
# Corrigir Dados de Notas Parciais com valor_previsto Errado

## Problema Encontrado

Existem **4 notas de kit com status "parcial"** que foram cobradas ANTES da correção do código, e por isso:
- O `valor_previsto` ainda mostra o valor original do kit (errado)
- O `valor_devido_empresa` na prestação ficou como 0 (era o bug do ModalReceberCobranca)
- Na agenda, essas notas aparecem com valores absurdos (ex: R$5.075 em vez de R$1.056)

| Revendedora | valor_previsto (errado) | Valor correto (venda - comissao) |
|---|---|---|
| BRUNA PEREIRA GONCALVES | R$5.075 | R$1.056 |
| JAQUELINE LIMA DOS SANTOS | R$7.235 | R$437,50 |
| MARIA DE FATIMA FREIRE DA SILVA | R$4.920 | R$472,50 |
| MARIA IRACY VIEIRA DA SILVA | R$5.045 | R$322 |

## Solucao

Executar uma unica migration SQL que:

1. **Atualiza `valor_previsto`** em `cobrancas_agendadas` para `total_venda - comissao_valor` (o valor real devido a empresa)
2. **Atualiza `valor_devido_empresa`** em `prestacoes_contas` para o mesmo valor correto (corrige o campo que ficou zerado pelo bug anterior)

### SQL da correcao

```text
-- Corrigir valor_previsto nas cobrancas
UPDATE cobrancas_agendadas ca
SET valor_previsto = pc.total_venda - pc.comissao_valor
FROM prestacoes_contas pc
WHERE pc.cobranca_id = ca.id
  AND ca.status = 'parcial'
  AND ca.tipo = 'kit'
  AND pc.valor_devido_empresa = 0
  AND ca.valor_pago_acumulado = 0
  AND pc.total_venda > 0;

-- Corrigir valor_devido_empresa nas prestacoes
UPDATE prestacoes_contas pc
SET valor_devido_empresa = pc.total_venda - pc.comissao_valor
FROM cobrancas_agendadas ca
WHERE pc.cobranca_id = ca.id
  AND ca.status = 'parcial'
  AND ca.tipo = 'kit'
  AND pc.valor_devido_empresa = 0
  AND ca.valor_pago_acumulado = 0
  AND pc.total_venda > 0;
```

## O que NAO muda

- Nenhum arquivo de codigo e alterado
- Apenas dados existentes sao corrigidos no banco
- O codigo ja foi corrigido na implementacao anterior para novas cobranças
