

# Permitir Admin Finalizar Dia por Representante em Dias Anteriores

## Problema Identificado
A tabela `cobrancas_diarias` nao possui politica RLS de INSERT para admins. Quando o admin tenta finalizar um dia que ainda nao tem registro (o representante esqueceu), o sistema tenta fazer um INSERT com `representante_id` diferente de `auth.uid()`, e o RLS bloqueia a operacao.

Politicas atuais:
- Admin pode SELECT, UPDATE, DELETE -- OK
- Admin **NAO pode INSERT** -- PROBLEMA

## Solucao

### 1. Migracao de banco de dados
Adicionar politica RLS de INSERT para admin na tabela `cobrancas_diarias`:

```sql
CREATE POLICY "Admin pode inserir cobranças diárias"
ON public.cobrancas_diarias
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### 2. Nenhuma alteracao de codigo necessaria
O botao "Finalizar Dia pelo Representante" ja existe no `FechamentoDiario.tsx` (linha 844) e funciona para qualquer data selecionada. A mutation `finalizarDiaMutation` (linha 308) ja faz INSERT ou UPDATE conforme necessario. O unico bloqueio era a falta da politica RLS de INSERT para admin.

## Resumo
- 1 migracao SQL (adicionar politica INSERT para admin em `cobrancas_diarias`)
- 0 arquivos de codigo alterados

