

# Transformar RevendedorasInativas em "Minhas Revendedoras" com 3 abas

## Resumo
Expandir a página atual para incluir abas Ativas, Inativas e Ranking, com modal de perfil compartilhado e edição de WhatsApp inline. A lógica existente de inativas permanece intacta.

## Arquivos afetados

### 1. `src/pages/RevendedorasInativas.tsx` — Reescrita completa

**Título**: "Minhas Revendedoras" com subtítulo atualizado.

**Tabs**: Ativas | Inativas | Ranking (usando componente Tabs existente).

**Aba Inativas**: Todo o conteúdo atual (busca, card resumo, grid de cards, dialog de reativação) movido para dentro de `TabsContent value="inativas"`. Nenhuma lógica removida.

**Aba Ativas** (nova):
- Query `minhas-revendedoras-ativas` busca `cobrancas_agendadas` com status pendente/parcial/reagendado + dados cadastrais de `revendedoras`
- Agrupa por nome, calcula saldo total e conta cobranças
- Cards com: nome, badge "Ativa" verde, WhatsApp (editável), saldo em aberto, cobranças abertas, botão "Ver Perfil"

**Aba Ranking** (nova):
- Query `ranking-minhas-revendedoras` busca `prestacoes_contas` do representante com `total_venda > 0`
- Filtro de período: Mensal / Trimestral / Total
- Deduplicação por `cobranca_id` (mesmo padrão já usado no ranking admin)
- Agrupamento por revendedora com cálculo de: ciclos, volume, ticket médio, nível
- Tabela: Posição, Nome, Nível (badge colorido), Ciclos, Volume, Ticket Médio, "Ver Perfil"

**Modal de Perfil** (novo, compartilhado):
- State `perfilAberto` controla nome da revendedora selecionada
- Busca todas as prestações da revendedora, deduplica por `cobranca_id`
- Exibe: nome, WhatsApp editável, status, cards resumo (ciclos, volume, ticket, nível), tabela histórica, evolução de nível

**Edição de WhatsApp**:
- Mutation `atualizarWhatsApp` faz update em `revendedoras` por `revendedora_id`
- Disponível nos cards de ativas e no modal de perfil

**Imports adicionais**: `startOfMonth, endOfMonth, subMonths` de date-fns; `Tabs, TabsList, TabsTrigger, TabsContent`; `Table` components; ícones adicionais (Phone, Edit2, Trophy, etc.)

**Função `calcularNivel`**:
```typescript
function calcularNivel(ticketMedio: number) {
  if (ticketMedio >= 2000) return { nivel: 'Elite', cor: 'purple' };
  if (ticketMedio >= 1000) return { nivel: 'Destaque', cor: 'orange' };
  if (ticketMedio >= 300) return { nivel: 'Ativa', cor: 'blue' };
  return { nivel: 'Inicial', cor: 'gray' };
}
```

### 2. `src/components/AnimatedRoutes.tsx` — Sem alteração
A rota `/revendedoras-inativas` já importa este arquivo. O export default mantém o mesmo nome, então nenhuma mudança de rota é necessária.

## Detalhes técnicos

- O arquivo será substancialmente maior (~600-700 linhas). Todas as queries, states e mutations ficam no mesmo componente para simplicidade.
- A aba padrão será "ativas" (`defaultValue="ativas"` no Tabs).
- A busca por nome será compartilhada entre as 3 abas.
- O modal de perfil usa `Dialog` com state `perfilAberto: string | null`.

