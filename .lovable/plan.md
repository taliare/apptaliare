

# Ajustes no CRM — Colunas Kanban e Observacoes

## 1. Alteracoes nas colunas do Kanban

**Remover**: "Em Analise" e "Pre-aprovadas"
**Adicionar**: "Ligar para as Referencias" (no lugar de "Em Analise")

Novo funil:
```text
Leads Novos → Ligar para as Referências → Aguardando Entrevista → Para Entregar → Ativas | Reprovadas
```

### Arquivos afetados
- `src/components/leads/types.ts` — atualizar `KANBAN_COLUMNS` (trocar `em_analise` por `ligar_referencias`, remover `pre_aprovada`)
- **Migracao SQL** — migrar leads com status `em_analise` para `ligar_referencias` e `pre_aprovada` para `ligar_referencias`

## 2. Sistema de observacoes com identificacao de usuario

Substituir o campo simples de observacao por um sistema de notas/comentarios onde cada entrada registra quem escreveu e quando.

### Migracao SQL
Criar tabela `leads_observacoes`:
- `id`, `lead_id` (FK), `autor_id` (uuid), `autor_nome` (text), `conteudo` (text), `criado_em` (timestamptz)
- RLS: admin pode tudo (mesmas politicas da tabela leads)

### Frontend — `src/components/leads/LeadDetailsSheet.tsx`
- Substituir o campo de Textarea + "Salvar Observacao" por:
  - Lista de observacoes existentes, cada uma mostrando: nome do autor, data/hora, conteudo
  - Campo de texto para adicionar nova observacao
  - Botao "Adicionar" que insere na tabela `leads_observacoes` com o usuario logado
- Query para buscar observacoes do lead, ordenadas por data (mais recente primeiro)
- Mutation para inserir nova observacao
- O campo `observacao` antigo da tabela `leads_revendedoras` sera migrado como primeira observacao (quando existir)

### Detalhes tecnicos
- Importar `useAuth` para obter o perfil do usuario logado
- Cada nota renderizada como um mini-card com avatar/nome, timestamp formatado e texto
- Manter o campo `observacao` original na tabela `leads_revendedoras` intacto (sem quebrar nada), mas a UI passa a usar a nova tabela

