import { supabase } from '@/integrations/supabase/client';

export type RevendedoraStatusKey =
  | 'juridico_aprovado'
  | 'juridico_solicitado'
  | 'inadimplente'
  | 'em_atraso'
  | 'pagando'
  | 'ativa'
  | 'quite'
  | 'inativa';

export interface RevendedoraStatusInfo {
  key: RevendedoraStatusKey;
  label: string;
  emoji: string;
  /** Tailwind classes para o Badge */
  className: string;
  /** Se true, bloqueia criação de novas cobranças */
  blocked: boolean;
  /** Motivo amigável quando bloqueado */
  blockReason?: string;
}

const STATUS_MAP: Record<RevendedoraStatusKey, Omit<RevendedoraStatusInfo, 'key'>> = {
  juridico_aprovado: {
    label: 'Jurídico',
    emoji: '⛔',
    className: 'bg-red-900 text-red-50 hover:bg-red-900',
    blocked: true,
    blockReason: 'Revendedora em processo jurídico aprovado.',
  },
  juridico_solicitado: {
    label: 'Sol. Jurídico',
    emoji: '⚖️',
    className: 'bg-purple-600 text-white hover:bg-purple-600',
    blocked: true,
    blockReason: 'Solicitação jurídica pendente de aprovação.',
  },
  inadimplente: {
    label: 'Inadimplente',
    emoji: '🔴',
    className: 'bg-red-600 text-white hover:bg-red-600',
    blocked: true,
    blockReason: 'Possui cobrança com 30+ dias de atraso sem pagamento.',
  },
  em_atraso: {
    label: 'Em Atraso',
    emoji: '⚠️',
    className: 'bg-amber-500 text-white hover:bg-amber-500',
    blocked: false,
  },
  pagando: {
    label: 'Pagando',
    emoji: '🔵',
    className: 'bg-blue-600 text-white hover:bg-blue-600',
    blocked: false,
  },
  ativa: {
    label: 'Ativa',
    emoji: '🟢',
    className: 'bg-emerald-600 text-white hover:bg-emerald-600',
    blocked: false,
  },
  quite: {
    label: 'Quite',
    emoji: '✅',
    className: 'bg-teal-600 text-white hover:bg-teal-600',
    blocked: false,
  },
  inativa: {
    label: 'Inativa',
    emoji: '💤',
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    blocked: false,
  },
};

export function getStatusInfo(key: RevendedoraStatusKey): RevendedoraStatusInfo {
  return { key, ...STATUS_MAP[key] };
}

type CobrancaLite = {
  status: string | null;
  data_agendada: string | null;
};

type RevendedoraLite = {
  status_juridico?: string | null;
};

/** Calcula status a partir de uma revendedora + lista de cobranças associadas. */
export function calcularStatusRevendedora(
  revendedora: RevendedoraLite | null,
  cobrancas: CobrancaLite[]
): RevendedoraStatusInfo {
  if (revendedora?.status_juridico === 'aprovado') return getStatusInfo('juridico_aprovado');
  if (revendedora?.status_juridico === 'solicitado') return getStatusInfo('juridico_solicitado');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let temInadimplente = false;
  let temEmAtraso = false;
  let temParcial = false;
  let temPendenteFutura = false;
  let temAlguma = false;
  let todasPagas = true;

  for (const c of cobrancas) {
    if (!c.status) continue;
    temAlguma = true;
    if (c.status !== 'pago') todasPagas = false;

    if (c.status === 'pendente' && c.data_agendada) {
      const [y, m, d] = c.data_agendada.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setHours(0, 0, 0, 0);
      const diffDias = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
      if (diffDias >= 30) temInadimplente = true;
      else if (diffDias >= 1) temEmAtraso = true;
      else temPendenteFutura = true;
    } else if (c.status === 'parcial') {
      temParcial = true;
    }
  }

  if (temInadimplente) return getStatusInfo('inadimplente');
  if (temEmAtraso) return getStatusInfo('em_atraso');
  if (temParcial) return getStatusInfo('pagando');
  if (temPendenteFutura) return getStatusInfo('ativa');
  if (temAlguma && todasPagas) return getStatusInfo('quite');
  return getStatusInfo('inativa');
}

/** Busca o status atual de uma revendedora pelo nome normalizado (UPPER+TRIM). */
export async function fetchStatusRevendedoraPorNome(nome: string): Promise<RevendedoraStatusInfo> {
  const nomeNorm = nome.trim().toUpperCase();

  const [{ data: revs }, { data: cobs }] = await Promise.all([
    supabase
      .from('revendedoras')
      .select('status_juridico')
      .ilike('nome', nomeNorm)
      .maybeSingle(),
    supabase
      .from('cobrancas_agendadas')
      .select('status, data_agendada')
      .ilike('revendedora', nomeNorm),
  ]);

  return calcularStatusRevendedora(revs ?? null, (cobs ?? []) as CobrancaLite[]);
}
