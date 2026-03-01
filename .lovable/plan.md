
## Objetivo da correção
Garantir que o admin consiga corrigir casos de **adiantamento + cobrança posterior** sem quebrar saldo, fechamento diário e histórico da nota.

## Diagnóstico (o que está travando hoje)
Pelo fluxo atual, existem 4 pontos que explicam por que “não funciona” nesse tipo de caso:

1. **Cálculo de quitação não usa corretamente o histórico da nota em todos os caminhos**  
   Em alguns handlers, o `valor_pago_acumulado` é sobrescrito com o valor atual, em vez de somar ao acumulado existente.

2. **Adiantamento não é tratado como “saldo já abatido” no modo de cobrança de correção**  
   Mesmo com `valor_adiantado` na cobrança, o fluxo de recebimento pode continuar pedindo valor cheio da prestação.

3. **Fluxo admin de cobrança de KIT depende de inserir prestação, mas o admin não tem INSERT em `prestacoes_contas`**  
   Resultado: o admin não consegue finalizar alguns acertos no fechamento diário.

4. **Inconsistência de rastreabilidade em alguns registros**  
   Há casos onde prestação foi gravada sem a nota correspondente da mesma cobrança/data, o que dificulta correção posterior.

---

## Implementação proposta (imediata)

### 1) Liberar autoridade operacional do admin para corrigir cobrança
**Banco (migração):**
- Adicionar política RLS para admin em `prestacoes_contas`:
  - `INSERT` (admin)
  - `UPDATE` (admin)

Isso é necessário para o admin conseguir registrar/corrigir prestações no fechamento.

---

### 2) Corrigir a lógica de saldo para pagamentos com adiantamento
Aplicar o mesmo cálculo-base em todos os fluxos de pagamento:

- `saldo_aberto = valor_previsto_normalizado - valor_pago_acumulado - valor_adiantado`
- No recebimento:
  - `novo_acumulado = acumulado_atual + valor_recebido_real`
  - `novo_saldo = valor_previsto_normalizado - novo_acumulado - valor_adiantado`
  - status:
    - `pago` se `novo_saldo <= 0`
    - `parcial` caso contrário

**Arquivos:**
- `src/pages/Cobranca.tsx`
- `src/pages/CobrancaDiaria.tsx`
- `src/components/fechamento/AdminDayActions.tsx`

---

### 3) Ajustar o “Receber Cobrança” para modo correção admin
No modal de recebimento:
- Exibir bloco de histórico quando houver **acumulado OU adiantamento** (hoje só aparece com acumulado).
- Em contexto admin, usar saldo remanescente real da cobrança para permitir acerto.
- Garantir que o valor efetivamente recebido seja o valor que entra em nota/prestação/acumulado.
- Manter restrições atuais para representante (sem abrir brecha de permissões).

**Arquivo:**
- `src/components/cobranca/ModalReceberCobranca.tsx`

---

### 4) Fortalecer vínculo de auditoria para correção futura
- Garantir `cobranca_id` nas notas criadas via cobrança diária/admin, para rastrear e reverter corretamente depois.
- Padronizar o mesmo comportamento nos 3 fluxos (Agenda, Cobrança Diária, Fechamento Admin).

**Arquivos:**
- `src/pages/CobrancaDiaria.tsx`
- `src/components/fechamento/AdminDayActions.tsx`

---

## Tratamento do caso que você relatou (RUBIA / Célia)
Depois da correção acima, o admin conseguirá:
1. abrir a cobrança da revendedora,
2. lançar apenas o valor remanescente correto,
3. manter o adiantamento já abatido,
4. registrar no fechamento do dia correto,
5. deixar a cobrança com status coerente (`parcial` ou `pago`) sem distorcer saldo.

---

## Sequência de execução
1. Migração RLS (admin em `prestacoes_contas` para insert/update).  
2. Correção de cálculo de saldo/acumulado nos handlers.  
3. Ajuste do modal para modo correção admin com adiantamento.  
4. Padronização de vínculo `cobranca_id` em nota.  
5. Teste guiado no cenário real (adiantamento anterior + pagamento remanescente posterior).  

---

## Critérios de aceite
- Admin consegue corrigir cobrança com adiantamento prévio sem erro de permissão.
- Saldo remanescente considera `valor_adiantado`.
- Valor lançado no fechamento diário corresponde ao valor realmente recebido no dia.
- Cobrança muda para `pago` quando saldo zerar.
- Nota, prestação e cobrança ficam consistentes e vinculadas.

---

## Risco e mitigação
- **Risco:** alterar cálculo pode impactar cobranças antigas.  
  **Mitigação:** aplicar somente no fluxo de gravação novo; não recalcular histórico automaticamente.
- **Risco:** divergência entre valor digitado e valor efetivo recebido.  
  **Mitigação:** validação explícita no modal e uso do valor recebido real no update.
