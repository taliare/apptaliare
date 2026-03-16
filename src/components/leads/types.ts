export interface LeadRevendedora {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string;
  cidade: string | null;
  instagram: string | null;
  experiencia_vendas: string | null;
  tempo_disponivel: string | null;
  capital_inicial: string | null;
  motivacao: string | null;
  origem: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: string;
  observacao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  idade: string | null;
  ultimo_envio: string | null;
  tentativas: number | null;
  data_nascimento: string | null;
  cpf: string | null;
  estado_civil: string | null;
  profissao: string | null;
  telefone_alternativo: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  restricao_serasa: string | null;
  possui_veiculo: string | null;
  expectativa_venda: string | null;
}

export interface LeadStatusHistorico {
  id: string;
  lead_id: string;
  status_anterior: string | null;
  status_novo: string;
  alterado_por: string | null;
  alterado_por_nome: string | null;
  criado_em: string;
}

export interface KanbanColumnConfig {
  id: string;
  label: string;
  color: string;
  final?: boolean;
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: 'leads_novos', label: 'Leads Novos', color: 'blue' },
  { id: 'em_analise', label: 'Em Análise', color: 'yellow' },
  { id: 'pre_aprovada', label: 'Pré-aprovadas', color: 'purple' },
  { id: 'aguardando_entrevista', label: 'Aguardando Entrevista', color: 'orange' },
  { id: 'para_entregar', label: 'Para Entregar', color: 'cyan' },
  { id: 'ativa', label: 'Ativas', color: 'green', final: true },
  { id: 'reprovada', label: 'Reprovadas', color: 'red', final: true },
];

export const COLUMN_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  orange: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
  indigo: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400',
  green: 'bg-green-500/20 border-green-500/40 text-green-400',
  red: 'bg-red-500/20 border-red-500/40 text-red-400',
};

export const getColumnLabel = (statusId: string): string => {
  const column = KANBAN_COLUMNS.find(c => c.id === statusId);
  return column?.label || statusId;
};
