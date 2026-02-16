import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TipoAcao =
  | 'REGISTRO_PAGAMENTO'
  | 'ALTERACAO_COMISSAO'
  | 'ACRESCIMO_PEDIDO'
  | 'REGISTRO_ADIANTAMENTO'
  | 'DESISTENCIA_KIT'
  | 'REABERTURA_PEDIDO'
  | 'ALTERACAO_DEVOLUCAO'
  | 'CONFERENCIA_INTERNA';

interface RegistrarLogParams {
  tipo_acao: TipoAcao;
  pedido_id?: string;
  valor_antes?: number;
  valor_depois?: number;
  descricao: string;
  user: { id: string; nome: string; papel: string };
}

export async function registrarLog(params: RegistrarLogParams) {
  try {
    const { error } = await supabase.from('logs_operacionais' as any).insert({
      usuario_id: params.user.id,
      nome_usuario: params.user.nome,
      papel: params.user.papel,
      tipo_acao: params.tipo_acao,
      pedido_id: params.pedido_id || null,
      valor_antes: params.valor_antes ?? null,
      valor_depois: params.valor_depois ?? null,
      descricao: params.descricao,
    });

    if (error) {
      console.error('Erro ao registrar log operacional:', error);
      return;
    }

    toast.info('Esta ação foi registrada no sistema.', { duration: 2000 });
  } catch (err) {
    console.error('Erro ao registrar log operacional:', err);
  }
}
