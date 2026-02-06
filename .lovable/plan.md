

# Plano: Acrescimo de Pedido (Joias Adicionais)

## Resumo

Implementar a funcionalidade de "Acrescimo de Pedido" que permite representantes registrarem valores extras (joias adicionais) vinculados a um kit entregue, sem alterar o valor base do kit. Os acrescimos impactam o valor total a cobrar, comissoes, receita e inadimplencia.

---

## Etapa 1: Criar tabela no banco de dados

Nova tabela `acrescimos_pedido` com os campos:

```text
acrescimos_pedido
  - id (uuid, PK, default gen_random_uuid())
  - kit_entregue_id (uuid, NOT NULL) -- referencia kits_entregues
  - cobranca_id (uuid) -- referencia cobrancas_agendadas (a cobranca gerada pelo acrescimo)
  - representante_id (uuid, NOT NULL)
  - revendedora (text, NOT NULL)
  - valor (numeric, NOT NULL)
  - descricao (text)
  - data_lancamento (date, NOT NULL, default CURRENT_DATE)
  - status (text, NOT NULL, default 'pendente') -- pendente, cobrado, pago
  - criado_em (timestamptz, default now())
```

Politicas RLS (RESTRICTIVE):
- Admin: ALL
- Representante: SELECT, INSERT, UPDATE onde `representante_id = auth.uid()`

---

## Etapa 2: Criar funcao RPC atomica

Funcao `registrar_acrescimo_pedido` que em uma unica transacao:

1. Valida que o kit_entregue pertence ao representante
2. Insere o acrescimo na tabela `acrescimos_pedido`
3. Cria uma nova `cobranca_agendada` do tipo `'acrescimo'` com o valor do acrescimo, vinculada a mesma revendedora
4. Atualiza o `cobranca_id` no acrescimo com o ID da cobranca criada
5. Retorna JSON de sucesso com IDs

Essa cobranca entra automaticamente na agenda do representante (pendente), e sera cobrada normalmente pelo fluxo existente de pagamento (completo, parcial, repasse).

---

## Etapa 3: Interface -- Tela de Entrega do Kit (Kits.tsx)

Apos selecionar o kit e preencher os dados da entrega, adicionar uma secao **opcional** de acrescimo:

- Exibir valor base do kit (somente leitura, ja existe)
- Botao `[ + Adicionar valor adicional ]` que expande campos:
  - Valor do acrescimo (R$)
  - Observacao (texto livre, ex: "brincos extras")
- Permitir adicionar multiplos acrescimos (lista dinamica)
- No submit, apos a entrega do kit via RPC, chamar `registrar_acrescimo_pedido` para cada acrescimo

---

## Etapa 4: Interface -- Agenda de Cobranca (Cobranca.tsx)

### 4a. Exibir acrescimos no card da cobranca

Quando uma cobranca for do tipo `kit`, buscar acrescimos vinculados ao mesmo `kit_entregue_id` e exibir:
- Badge `ACRESCIMO` ao lado de cobrancas do tipo `acrescimo`
- Na listagem, os acrescimos aparecem como cobrancas separadas (pois sao registros independentes em `cobrancas_agendadas`)

### 4b. Acao "Registrar Joias Adicionais"

No menu "Mais opcoes" de cada cobranca do tipo `kit` (ja entregue):
- Nova opcao: `+ Registrar joias adicionais`
- Abre modal com campos: Valor, Observacao, Data de vencimento
- Chama a RPC `registrar_acrescimo_pedido`
- Invalida queries para atualizar a agenda

---

## Etapa 5: Cobranca e Prestacao de Contas

O fluxo existente ja suporta isso sem alteracoes, porque:

- Cada acrescimo gera uma `cobranca_agendada` independente (tipo `acrescimo`)
- O representante cobra e recebe normalmente (pagamento completo, parcial, repasse)
- A `prestacao_contas` e criada pelo fluxo existente
- A `nota_promissoria` alimenta o fechamento diario normalmente

Nenhuma alteracao necessaria nos fluxos de pagamento.

---

## Etapa 6: Comissao

A comissao ja e calculada automaticamente pelo `ModalReceberCobranca`:
- Para tipo `kit`: calcula comissao percentual baseada no valor da venda
- Para tipo `repasse`: sem comissao
- Para tipo `acrescimo`: usara a mesma logica do `kit` (baseada no valor da venda informado)

Nenhuma alteracao necessaria no calculo de comissao.

---

## Etapa 7: DRE e KPIs

### DRE (DreResumo.tsx)
- Nenhuma alteracao necessaria
- O DRE usa `cobrancas_diarias.total_cobrado` como fonte oficial
- Acrescimos cobrados entram no fechamento diario via notas promissorias, como qualquer outra cobranca
- A receita total ja inclui naturalmente os acrescimos

### KPIs (RelatorioKpis.tsx)
- Nenhuma alteracao necessaria
- Os acrescimos entram nos totais existentes (Total Cobrado, Valor Vencido, Repasses Ativos, Ticket Medio)
- NAO criar KPIs duplicados, conforme a regra

---

## Resumo de Arquivos Alterados

| Arquivo | Tipo de Alteracao |
|---|---|
| Migracao SQL | Nova tabela `acrescimos_pedido`, funcao RPC, politicas RLS |
| `src/pages/Kits.tsx` | Adicionar secao de acrescimos na entrega |
| `src/pages/Cobranca.tsx` | Adicionar acao "Registrar joias adicionais" no menu de opcoes, badge para tipo acrescimo |
| `src/components/cobranca/ModalReceberCobranca.tsx` | Nenhuma alteracao (ja funciona com o novo tipo) |
| `src/pages/DreResumo.tsx` | Nenhuma alteracao |
| `src/pages/RelatorioKpis.tsx` | Nenhuma alteracao |

---

## Detalhes Tecnicos

### Migracao SQL completa

```text
1. CREATE TABLE acrescimos_pedido (...)
2. ALTER TABLE acrescimos_pedido ENABLE ROW LEVEL SECURITY
3. Criar 4 politicas RLS RESTRICTIVE (admin ALL, representante SELECT/INSERT/UPDATE)
4. CREATE FUNCTION registrar_acrescimo_pedido(...) RETURNS json
   - Parametros: p_kit_entregue_id, p_user_id, p_revendedora, p_valor, p_descricao, p_data_vencimento
   - Insere acrescimo
   - Cria cobranca_agendada tipo 'acrescimo'
   - Retorna JSON com IDs
```

### Fluxo de dados

```text
Entrega Kit --> kit_entregue + cobranca_agendada (tipo=kit)
                    |
                    +--> acrescimo_pedido + cobranca_agendada (tipo=acrescimo)
                    +--> acrescimo_pedido + cobranca_agendada (tipo=acrescimo)
                    ...

Cada cobranca_agendada segue o fluxo normal:
  cobrar --> nota_promissoria --> fechamento_diario --> DRE/KPIs
```

### Restricoes respeitadas
- Valor base do kit NUNCA e alterado
- Nenhum novo tipo de pedido criado
- DRE e KPIs nao quebram (os acrescimos entram naturalmente nos totais)
- Historico financeiro permanece auditavel
- Sem alteracao em valores historicos

