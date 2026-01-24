
### Diagnóstico (por que “Reabrir Dia” não funciona)
O problema **não está no botão nem no Realtime**. O problema é permissão no backend:

- A tabela `cobrancas_diarias` tem RLS ativo.
- Existe policy de **UPDATE apenas para representante** (`representante_id = auth.uid()`).
- **Não existe policy de UPDATE para admin**.
- Resultado: quando o admin tenta “reabrir”, o `UPDATE cobrancas_diarias SET finalizado=false` é **bloqueado pelo RLS**, então no banco continua `finalizado=true` e o representante continua vendo “Finalizado”.

Eu confirmei isso consultando as policies atuais do banco:
- UPDATE: somente “Representante pode atualizar…”
- SELECT: admin pode ver, mas **não pode atualizar**
- DELETE: admin pode deletar (existe), mas **UPDATE não existe**

---

### Correção necessária (simples e definitiva)
Criar uma policy de **UPDATE para admin** em `public.cobrancas_diarias`, usando a função já existente `has_role(auth.uid(), 'admin'::app_role)` (a mesma usada nas policies de SELECT/DELETE do admin).

Isso vai permitir:
1) Admin atualizar `finalizado` para `false` (reabrir)  
2) O registro realmente mudar no banco  
3) O representante, ao refazer a query, receber `finalizado=false`  
4) O Realtime disparar e a UI do representante atualizar automaticamente (a sua alteração recente no `CobrancaDiaria.tsx` passa a funcionar de verdade)

---

### Passos de implementação (o que vou fazer quando você aprovar)
#### 1) Criar migration no backend (Test)
Adicionar a policy:

```sql
CREATE POLICY "Admin pode atualizar cobranças diárias"
ON public.cobrancas_diarias
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

Observações:
- `USING` permite o UPDATE acontecer.
- `WITH CHECK` garante que o admin também pode salvar o resultado do UPDATE (boas práticas).

#### 2) Validar o fluxo ponta-a-ponta
- Logar como admin, ir em **Fechamento Diário**, selecionar representante e data, clicar **Reabrir Dia**.
- Confirmar que a request de update retorna sucesso (não bloqueada).
- Em outra aba, logado como representante:
  - Confirmar que o dia passa para “Em aberto” sem refresh manual (via Realtime/refetch).
  - Confirmar que o toast “O administrador reabriu o dia XXXX-XX-XX” aparece (se aplicável).

#### 3) (Opcional, mas recomendado) Melhorar feedback no admin
Se atualmente o admin não está vendo erro quando o RLS bloqueia (pode acontecer dependendo do tratamento), vou reforçar a mensagem de erro no `FechamentoDiario.tsx` para ficar bem explícito quando falhar (ex.: “Sem permissão para reabrir. Verifique permissões do admin.”).  
Isso evita gastar crédito “no escuro” caso algo semelhante aconteça no futuro.

---

### Resultado esperado
- O botão **Reabrir Dia** passa a funcionar de forma confiável.
- O representante verá o dia como **aberto** imediatamente (ou no próximo refetch automático via Realtime).
- Você não precisará recarregar página nem ficar repetindo tentativa.

---

### Arquivos/itens afetados
- Backend (migration / policy):
  - `public.cobrancas_diarias` (nova policy de UPDATE para admin)
- Frontend:
  - Nenhuma mudança obrigatória para corrigir (a correção é de permissão).
  - Opcional: reforço de mensagem de erro em `src/pages/FechamentoDiario.tsx`.

---

### Risco/impacto
Baixo. A policy só amplia permissão de UPDATE **para admins**, que já têm SELECT e DELETE nessa mesma tabela. É coerente com a regra de negócio “admin pode reabrir/ajustar”.

