

# Correção de Notas Parciais com `valor_previsto` Inflado

## Diagnóstico

Analisei todas as 20 notas com `status = 'parcial'`. Cruzando com `prestacoes_contas`, identifiquei 7 notas afetadas pelo bug antigo (que somava `valor_recebido` ao `valor_previsto` em vez de usar `valor_devido_empresa`):

### Notas que continuam parciais (corrigir `valor_previsto`):

| Nota | Revendedora | Previsto Atual | Previsto Correto | Saldo Correto |
|------|-------------|---------------|-----------------|--------------|
| 5429 | SIGRID MOREIRA | 738 | 588 | 438 |
| 5456 | TAIANA GISELE | 1015 | 678 | 341 |
| 5500 | MARIA GUADALUPE | 884 | 684 | 484 |
| 5504 | VERA LÚCIA | 1965 | 1065 | 165 |

### Notas quitadas que devem sair da agenda (corrigir `valor_previsto` + marcar como `pago`):

| Nota | Revendedora | Previsto Atual | Previsto Correto | Saldo |
|------|-------------|---------------|-----------------|-------|
| 5490 | CRISTIANE LOPES | 5280 | 112 | 0 |
| 5551 | ESTEFANE GOMES | 7070 | 924 | 0 |

### Caso especial - Nota 5450 (RUBIA MIRANDA):
- `valor_previsto` = 7360 (completamente inflado)
- Primeira prestação: `valor_devido_empresa` = 511, pagou 511
- Segunda prestação (bug): registrou novo valor_venda, pagou 100
- `valor_adiantado` = 500
- **Correção**: `valor_previsto` = 511, `valor_pago_acumulado` = 611, saldo = 511 - 611 - 500 = -600 → **PAGO**

### 13 notas sem problemas:
- 4 notas com prestações mas `valor_previsto` já correto (5314, 5349, 5440, 5513)
- 9 notas sem prestações registradas (dados anteriores ao sistema de prestação), mantêm valores atuais

## Implementação

Executar via SQL (insert tool) as seguintes correções:

```sql
-- 1. Corrigir valor_previsto das 4 notas que continuam parciais
UPDATE cobrancas_agendadas SET valor_previsto = 588 WHERE id = 'dd44945b-846f-4a31-9042-a015e8beac39';
UPDATE cobrancas_agendadas SET valor_previsto = 678 WHERE id = '821d09b8-f3a3-4ae6-877e-a32aa9e32334';
UPDATE cobrancas_agendadas SET valor_previsto = 684 WHERE id = 'a7af38fa-89df-4654-a9a2-c6253730c696';
UPDATE cobrancas_agendadas SET valor_previsto = 1065 WHERE id = 'b886d00d-7560-40a1-933c-9a4c8de25352';

-- 2. Corrigir e quitar as 2 notas com saldo zero
UPDATE cobrancas_agendadas SET valor_previsto = 112, status = 'pago', data_quitacao = CURRENT_DATE
WHERE id = 'b828ba41-b086-41ba-98a8-d2e0850eb3ef';
UPDATE cobrancas_agendadas SET valor_previsto = 924, status = 'pago', data_quitacao = CURRENT_DATE
WHERE id = 'febff632-6562-4956-a6e1-0fd86075cc06';

-- 3. Caso especial 5450: corrigir valor_previsto, acumulado, e quitar
UPDATE cobrancas_agendadas SET valor_previsto = 511, valor_pago_acumulado = 611, status = 'pago', data_quitacao = CURRENT_DATE
WHERE id = 'feecc217-17dc-4e64-9662-df1cb5f37b8d';
```

**Total: 7 notas corrigidas, sendo 3 que saem da agenda (quitadas).**

Nenhuma alteração de código necessária - apenas correção de dados.

