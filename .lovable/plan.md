
# Logs Operacionais - Tabela + Registro Automatico + Paginas de Visualizacao

## 1. Criar tabela `logs_operacionais`

Migracao SQL com a estrutura solicitada:

| Coluna | Tipo | Detalhes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| usuario_id | uuid | NOT NULL |
| nome_usuario | text | NOT NULL |
| papel | text | NOT NULL |
| tipo_acao | text | NOT NULL |
| pedido_id | uuid | Nullable |
| valor_antes | numeric | Nullable |
| valor_depois | numeric | Nullable |
| descricao | text | NOT NULL |
| criado_em | timestamptz | default now() |

Politicas RLS:
- Representantes: SELECT apenas seus proprios logs (`usuario_id = auth.uid()`)
- Admin: SELECT todos os logs
- INSERT: qualquer usuario autenticado (para registrar seus proprios logs)
- UPDATE e DELETE: ninguem (logs sao imutaveis)

## 2. Helper de log centralizado

Criar `src/lib/logOperacional.ts` com funcao utilitaria:

```text
registrarLog({
  tipo_acao: string,
  pedido_id?: string,
  valor_antes?: number,
  valor_depois?: number,
  descricao: string,
  user: { id, nome, papel }
})
```

Essa funcao insere na tabela `logs_operacionais` e exibe o toast discreto "Esta acao foi registrada no sistema."

## 3. Integrar logs nas 8 acoes

Cada acao recebe uma chamada ao helper apos sucesso da operacao principal (sem alterar a logica existente):

| Acao | Arquivo(s) | Onde inserir |
|---|---|---|
| REGISTRO_PAGAMENTO | `Cobranca.tsx`, `CobrancaDiaria.tsx` | Apos `handlePagamentoCompleto` e `handlePagamentoParcial` com sucesso |
| ALTERACAO_COMISSAO | `ModalReceberCobranca.tsx` | Quando `comissaoManual` e ativado e percentual e alterado, registrar no submit |
| ACRESCIMO_PEDIDO | `ModalRegistrarAcrescimo.tsx`, `CobrancaDiaria.tsx` (entrega com acrescimos) | No `onSuccess` da mutation |
| REGISTRO_ADIANTAMENTO | `Cobranca.tsx` | No `onSuccess` do `adiantamentoMutation` |
| DESISTENCIA_KIT | `Cobranca.tsx` | No `onSuccess` do `desistenciaMutation` |
| REABERTURA_PEDIDO | `FechamentoDiario.tsx` | No `onSuccess` do `reabrirDiaMutation` |
| ALTERACAO_DEVOLUCAO | `Cobranca.tsx`, `CobrancaDiaria.tsx` | Quando `tipo === 'devolucao'` no pagamento completo |
| CONFERENCIA_INTERNA | `FechamentoDiario.tsx` | No `onSuccess` da finalizacao do dia pelo admin |

Nenhuma logica financeira sera alterada. O log e inserido apos o sucesso das operacoes existentes.

## 4. Pagina "Historico de Acoes" (representante)

Criar `src/pages/HistoricoAcoes.tsx`:
- Tabela com logs do proprio usuario
- Filtro por periodo (DateRangePicker)
- Filtro por tipo de acao (Select)
- Botao "Exportar CSV" usando a lib `xlsx` ja instalada

Rota: `/historico-acoes`

Adicionar ao menu do representante na categoria "GESTAO" no `AppSidebar.tsx` e `MobileDrawer.tsx`.

## 5. Pagina "Auditoria Geral" (admin)

Criar `src/pages/AuditoriaGeral.tsx`:
- Tabela com TODOS os logs
- Filtro por periodo
- Filtro por tipo de acao
- Filtro por representante (Select com lista de usuarios)
- Botao "Exportar CSV"

Rota: `/auditoria-geral`

Adicionar ao menu admin na categoria "RELATORIOS" no `AppSidebar.tsx` e `MobileDrawer.tsx`.
Adicionar ao `ASSIGNABLE_MENUS` em `menuPermissions.ts`.

## 6. Rotas

Adicionar em `AnimatedRoutes.tsx`:
- `/historico-acoes` -> `HistoricoAcoes` (acessivel a representantes)
- `/auditoria-geral` -> `AuditoriaGeral` (via PermissionRoute)

## Arquivos a serem criados

| Arquivo | Descricao |
|---|---|
| `src/lib/logOperacional.ts` | Helper centralizado de log |
| `src/pages/HistoricoAcoes.tsx` | Pagina do representante |
| `src/pages/AuditoriaGeral.tsx` | Pagina do admin |

## Arquivos a serem editados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Criar tabela + RLS |
| `src/pages/Cobranca.tsx` | Adicionar chamadas de log nos onSuccess |
| `src/pages/CobrancaDiaria.tsx` | Adicionar chamadas de log nos onSuccess |
| `src/pages/FechamentoDiario.tsx` | Adicionar chamadas de log nos onSuccess |
| `src/components/cobranca/ModalRegistrarAcrescimo.tsx` | Adicionar log no onSuccess |
| `src/components/cobranca/ModalReceberCobranca.tsx` | Adicionar log para comissao manual e devolucao |
| `src/components/AnimatedRoutes.tsx` | Adicionar rotas |
| `src/components/AppSidebar.tsx` | Adicionar menus |
| `src/components/MobileDrawer.tsx` | Adicionar menus |
| `src/lib/menuPermissions.ts` | Adicionar menu auditoria_geral |

## O que NAO sera alterado

- Nenhuma logica financeira
- Nenhum calculo de DRE, metas ou dashboard
- Nenhuma tabela existente (apenas INSERT na nova tabela)
- Nenhum fluxo de pedido ou cobranca
