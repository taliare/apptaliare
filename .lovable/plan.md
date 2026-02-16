

# Criar tabela `ajustes_representantes`

Tabela auxiliar para uso futuro, sem impacto em nenhuma logica existente do sistema.

## Estrutura da tabela

| Coluna | Tipo | Detalhes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| representante_id | uuid | FK para profiles.id, NOT NULL |
| cobranca_id | uuid | FK para cobrancas_agendadas.id, NOT NULL |
| valor_registrado | numeric | NOT NULL |
| valor_conferido | numeric | NOT NULL |
| diferenca | numeric | NOT NULL |
| motivo | text | Nullable |
| status | text | default 'pendente', NOT NULL |
| criado_em | timestamptz | default now() |
| quitado_em | timestamptz | Nullable |

## Politicas RLS

Apenas admin tem acesso completo (INSERT, SELECT, UPDATE, DELETE). Representantes nao tem nenhuma politica, ou seja, nao conseguem ver nem interagir com a tabela.

- **Admin ALL**: `has_role(auth.uid(), 'admin'::app_role)`

## O que NAO sera alterado

- Nenhum arquivo de codigo
- Nenhuma logica de dashboard, metas ou DRE
- Nenhuma rota ou componente existente

## Detalhe tecnico

Uma unica migracao SQL sera executada para criar a tabela, habilitar RLS e adicionar a politica de admin.

