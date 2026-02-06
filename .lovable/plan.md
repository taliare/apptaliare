

# Plano: Corrigir nome do representante nas encomendas (perfil producao)

## Problema

Na tela de encomendas da producao (`/encomendas-producao`), a coluna "Representante" aparece vazia. A resposta da API retorna `"profiles": null` para todos os registros.

**Causa raiz**: A query usa um JOIN via foreign key (`profiles!encomendas_kits_representante_id_fkey(nome)`), mas o usuario com role `producao` nao tem permissao de leitura na tabela `profiles` (RLS restringe a apenas o proprio perfil ou admin). Por isso, o JOIN retorna `null`.

## Solucao

Usar a mesma abordagem ja adotada no componente `EncomendaAlertBanner.tsx`: buscar os nomes dos representantes separadamente via a view `profiles_limited`, que nao possui restricoes de RLS e expoe apenas campos nao sensiveis (id, nome, ativo, avatar_url).

## Alteracoes

### Arquivo: `src/pages/EncomendaProducao.tsx`

1. **Importar** `profilesLimited` de `@/lib/profilesLimited`

2. **Alterar a query** `encomendas-producao`:
   - Remover o JOIN `profiles!encomendas_kits_representante_id_fkey(nome)` do select
   - Usar `select('*')` apenas
   - Apos buscar as encomendas, extrair os `representante_id` unicos
   - Buscar os nomes via `profilesLimited().select('id, nome').in('id', representanteIds)`
   - Mapear o nome do representante em cada encomenda

3. **Atualizar o tipo** `Encomenda`:
   - Trocar `profiles: { nome: string }` por `representante_nome: string | null`

4. **Atualizar as referencias na interface**:
   - Na tabela: trocar `encomenda.profiles?.nome` por `encomenda.representante_nome`
   - No modal de detalhes: mesma troca

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/EncomendaProducao.tsx` | Query sem JOIN, busca nomes via profiles_limited, atualiza tipo e referencias |

## O que NAO muda

- Nenhuma tabela ou politica de seguranca no banco de dados
- Nenhuma funcionalidade existente (acoes de marcar em producao, finalizar, notificacoes)
- Nenhum outro componente ou pagina
- Layout e visual da tela permanecem identicos

