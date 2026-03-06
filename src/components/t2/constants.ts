export const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  inadimplente: 'Inadimplente',
  desistencia: 'Desistência',
};

export const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-green-500/20 text-green-700 dark:text-green-400',
  encerrado: 'bg-muted text-muted-foreground',
  inadimplente: 'bg-red-500/20 text-red-700 dark:text-red-400',
  desistencia: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
};

export function getComissaoFaixa(valorVendido: number): { percentual: number; categoria: string } {
  if (valorVendido >= 2000) return { percentual: 50, categoria: 'Diamante' };
  if (valorVendido >= 1000) return { percentual: 40, categoria: 'Ouro' };
  if (valorVendido >= 300) return { percentual: 30, categoria: 'Prata' };
  return { percentual: 20, categoria: 'Bronze' };
}

export const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
];

export const CATEGORIA_LABELS: Record<string, string> = {
  INICIAL: 'Inicial',
  ATIVA: 'Ativa',
  DESTAQUE: 'Destaque',
  ELITE: 'Elite',
};

export const CATEGORIA_COLORS: Record<string, string> = {
  INICIAL: 'bg-muted text-muted-foreground',
  ATIVA: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  DESTAQUE: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  ELITE: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
};

export const RADAR_LABELS: Record<string, string> = {
  ATIVA: 'Ativa',
  ATENCAO: 'Atenção',
  RISCO: 'Risco',
};

export const RADAR_COLORS: Record<string, string> = {
  ATIVA: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  ATENCAO: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  RISCO: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
};

export const FINANCEIRO_LABELS: Record<string, string> = {
  RECEBIDO: 'Recebido',
  A_RECEBER: 'A Receber',
  EM_RISCO: 'Em Risco',
  INADIMPLENTE: 'Inadimplente',
};

export const FINANCEIRO_COLORS: Record<string, string> = {
  RECEBIDO: 'bg-green-500/20 text-green-700 dark:text-green-400',
  A_RECEBER: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  EM_RISCO: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  INADIMPLENTE: 'bg-red-500/20 text-red-700 dark:text-red-400',
};
