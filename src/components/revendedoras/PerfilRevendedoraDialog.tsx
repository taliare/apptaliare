import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatarValor } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularNivel } from './RankingRevendedoras';
import { Trophy, TrendingUp, Hash, Award, Edit2, Gavel, ShieldCheck, ShieldX, Eye, EyeOff, MapPin } from 'lucide-react';
import { calcularStatusRevendedora } from '@/lib/revendedoraStatus';
import { StatusRevendedoraBadge } from './StatusRevendedoraBadge';
import { useFotoUrl } from '@/hooks/useFotoUrl';
import { RevendedoraFormDialog } from './RevendedoraFormDialog';
import { useRevendedoraHistorico } from '@/hooks/useRevendedoraHistorico';
import { toast } from 'sonner';

interface Props {
  nomeRevendedora: string;
  revendedoraId?: string | null;
  representantes: { id: string; nome: string }[];
  onClose: () => void;
}

export function PerfilRevendedoraDialog({ nomeRevendedora, revendedoraId, representantes, onClose }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [solicJuridicoOpen, setSolicJuridicoOpen] = useState(false);
  const [motivoJuridico, setMotivoJuridico] = useState('');
  const [saldoVisivel, setSaldoVisivel] = useState(false);

  const { data: prestacoesBruto = [], isLoading } = useQuery({
    queryKey: ['perfil-revendedora', nomeRevendedora],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestacoes_contas')
        .select('*')
        .eq('revendedora', nomeRevendedora)
        .order('data_execucao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const prestacoes = useMemo(() => {
    if (!prestacoesBruto) return [];
    const porCobranca = new Map<string, any>();
    for (const p of prestacoesBruto) {
      if (!p.cobranca_id) continue;
      const existente = porCobranca.get(p.cobranca_id);
      if (!existente || Number(p.total_venda) > Number(existente.total_venda)) {
        porCobranca.set(p.cobranca_id, p);
      }
    }
    const semCobrancaId = prestacoesBruto.filter((p) => !p.cobranca_id);
    return [...porCobranca.values(), ...semCobrancaId].sort(
      (a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime()
    );
  }, [prestacoesBruto]);

  const { data: revendedoraInfo } = useQuery({
    queryKey: ['revendedora-info', revendedoraId ?? nomeRevendedora],
    queryFn: async () => {
      // 1) Prefere busca por ID quando a tela já o conhece
      if (revendedoraId) {
        const { data, error } = await supabase
          .from('revendedoras')
          .select('*')
          .eq('id', revendedoraId)
          .maybeSingle();
        if (error && (error as any).code !== 'PGRST116') throw error;
        if (data) return data;
      }
      // 2) RPC tolerante a variações (UPPER/TRIM/unaccent + prefixo)
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('buscar_revendedora_match', {
        p_representante_id: null,
        p_nome: nomeRevendedora,
      });
      if (!rpcErr && rpcData) {
        return Array.isArray(rpcData) ? (rpcData[0] ?? null) : rpcData;
      }
      return null;
    },
  });

  const { data: cobrancas = [] } = useQuery({
    queryKey: ['revendedora-cobrancas-perfil', nomeRevendedora],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('status, data_agendada')
        .eq('revendedora', nomeRevendedora.trim().toUpperCase());
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  const fotoUrl = useFotoUrl(revendedoraInfo?.foto_url ?? null);
  const statusInfo = calcularStatusRevendedora(revendedoraInfo ?? null, cobrancas as any[]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    representantes.forEach((r) => map.set(r.id, r.nome));
    return map;
  }, [representantes]);

  const totalCiclos = prestacoes.length;
  const totalVolume = prestacoes.reduce((s, p) => s + (Number(p.total_venda) || 0), 0);
  const ticketMedio = totalCiclos > 0 ? totalVolume / totalCiclos : 0;
  const { nivel, cor } = calcularNivel(ticketMedio);

  const repNome = revendedoraInfo?.representante_id
    ? profileMap.get(revendedoraInfo.representante_id) || '-'
    : (prestacoes[0]?.representante_id ? profileMap.get(prestacoes[0].representante_id) || '-' : '-');

  const nivelBadgeClass = (c: string) => {
    if (c === 'purple') return 'bg-purple-600 text-white';
    if (c === 'orange') return 'bg-orange-500 text-white';
    if (c === 'blue') return 'bg-blue-500 text-white';
    return '';
  };

  const initials = nomeRevendedora.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');

  // Mutation: solicitar jurídico
  const solicitarJuridico = useMutation({
    mutationFn: async () => {
      if (!revendedoraInfo?.id) throw new Error('Revendedora sem cadastro.');
      const { error } = await supabase
        .from('revendedoras')
        .update({
          status_juridico: 'solicitado',
          data_solicitacao_juridico: new Date().toISOString(),
          motivo_juridico: motivoJuridico.trim() || null,
        })
        .eq('id', revendedoraInfo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação enviada ao admin');
      setSolicJuridicoOpen(false);
      setMotivoJuridico('');
      qc.invalidateQueries({ queryKey: ['revendedora-info'] });
      qc.invalidateQueries({ queryKey: ['revendedoras-admin'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao solicitar'),
  });

  // Mutation: admin define status jurídico
  const definirJuridico = useMutation({
    mutationFn: async (acao: 'aprovado' | 'negado' | 'remover') => {
      if (!revendedoraInfo?.id) throw new Error('Revendedora sem cadastro.');
      const payload: any =
        acao === 'remover'
          ? {
              status_juridico: null,
              data_aprovacao_juridico: null,
              aprovado_por: null,
              motivo_juridico: null,
            }
          : {
              status_juridico: acao,
              data_aprovacao_juridico: new Date().toISOString(),
              aprovado_por: user!.id,
            };
      const { error } = await supabase.from('revendedoras').update(payload).eq('id', revendedoraInfo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status jurídico atualizado');
      qc.invalidateQueries({ queryKey: ['revendedora-info'] });
      qc.invalidateQueries({ queryKey: ['revendedoras-admin'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });

  const podeSolicitarJuridico =
    !!revendedoraInfo?.id &&
    !revendedoraInfo.status_juridico &&
    !isAdmin;

  const { data: historico = [] } = useRevendedoraHistorico(revendedoraInfo?.id);
  const ultimaEdicao = historico.find((h) => h.acao === 'editou') ?? null;
  const cadastro = historico.find((h) => h.acao === 'criou') ?? null;

  const fmtField = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const fmtDateTime = (iso?: string | null) =>
    iso ? format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';



  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Perfil — {nomeRevendedora}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header com foto + status */}
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/30">
              {fotoUrl && <AvatarImage src={fotoUrl} alt={nomeRevendedora} />}
              <AvatarFallback>{initials || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px] space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusRevendedoraBadge status={statusInfo} />
                {statusInfo.blocked && (
                  <span className="text-xs text-red-500">🚫 Cadastro de novas cobranças bloqueado</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Representante: <strong>{repNome}</strong>
              </p>
              {revendedoraInfo?.whatsapp && (
                <p className="text-sm text-muted-foreground">
                  WhatsApp: <strong>{revendedoraInfo.whatsapp}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {podeSolicitarJuridico && (
                <Button variant="outline" size="sm" onClick={() => setSolicJuridicoOpen(true)} className="gap-1">
                  <Gavel className="h-4 w-4" />Solicitar Jurídico
                </Button>
              )}
              {isAdmin && revendedoraInfo?.status_juridico === 'solicitado' && (
                <>
                  <Button size="sm" onClick={() => definirJuridico.mutate('aprovado')} className="gap-1">
                    <ShieldCheck className="h-4 w-4" />Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => definirJuridico.mutate('negado')} className="gap-1">
                    <ShieldX className="h-4 w-4" />Negar
                  </Button>
                </>
              )}
              {isAdmin && (revendedoraInfo?.status_juridico === 'aprovado' || revendedoraInfo?.status_juridico === 'negado') && (
                <Button size="sm" variant="outline" onClick={() => definirJuridico.mutate('remover')}>
                  Remover Status
                </Button>
              )}
            </div>
          </div>

          {revendedoraInfo?.motivo_juridico && (
            <Card>
              <CardContent className="py-3 text-sm">
                <strong className="text-purple-600">Motivo jurídico:</strong> {revendedoraInfo.motivo_juridico}
              </CardContent>
            </Card>
          )}

          {/* Dados cadastrais */}
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide">Dados Cadastrais</p>
                <div className="flex gap-1">
                  {(() => {
                    const parts = [
                      [revendedoraInfo?.logradouro, revendedoraInfo?.numero].filter(Boolean).join(', '),
                      revendedoraInfo?.bairro,
                      revendedoraInfo?.cidade,
                      revendedoraInfo?.estado,
                      revendedoraInfo?.cep,
                    ].filter(Boolean);
                    if (parts.length === 0) return null;
                    const query = encodeURIComponent(parts.join(', ') + ', Brasil');
                    const mapsUrl = `https://www.google.com/maps?q=${query}`;
                    return (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 h-7"
                        title="Abrir no Google Maps"
                        onClick={() => {
                          const win = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                          if (!win) {
                            toast.error('Permita pop-ups deste site para abrir o Google Maps.');
                          }
                        }}
                      >
                        <MapPin className="h-3.5 w-3.5" /> Ver localização
                      </Button>
                    );
                  })()}
                  <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} className="gap-1 h-7">
                    <Edit2 className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> {fmtField(revendedoraInfo?.cpf)}</div>
                <div><span className="text-muted-foreground">RG:</span> {fmtField(revendedoraInfo?.rg)}</div>
                <div><span className="text-muted-foreground">Nascimento:</span> {fmtField(revendedoraInfo?.data_nascimento)}</div>
                <div><span className="text-muted-foreground">Gênero:</span> {fmtField(revendedoraInfo?.genero)}</div>
                <div><span className="text-muted-foreground">Estado civil:</span> {fmtField(revendedoraInfo?.estado_civil)}</div>
                <div><span className="text-muted-foreground">Email:</span> {fmtField(revendedoraInfo?.email)}</div>
                <div><span className="text-muted-foreground">WhatsApp:</span> {fmtField(revendedoraInfo?.whatsapp)}</div>
                <div><span className="text-muted-foreground">Tel. alternativo:</span> {fmtField(revendedoraInfo?.telefone_alternativo)}</div>
                <div><span className="text-muted-foreground">CEP:</span> {fmtField(revendedoraInfo?.cep)}</div>
                <div className="md:col-span-2"><span className="text-muted-foreground">Endereço:</span> {fmtField([revendedoraInfo?.logradouro, revendedoraInfo?.numero, revendedoraInfo?.complemento].filter(Boolean).join(', ') || null)}</div>
                <div><span className="text-muted-foreground">Bairro:</span> {fmtField(revendedoraInfo?.bairro)}</div>
                <div><span className="text-muted-foreground">Cidade/UF:</span> {fmtField([revendedoraInfo?.cidade, revendedoraInfo?.estado].filter(Boolean).join('/') || null)}</div>
              </div>
              <div className="border-t pt-2 mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>
                  📅 Cadastrada em: <strong className="text-foreground">{fmtDateTime(revendedoraInfo?.criado_em)}</strong>
                  {cadastro?.user_nome && <> por <strong className="text-foreground">{cadastro.user_nome}</strong></>}
                </div>
                <div>
                  ✏️ Última edição: <strong className="text-foreground">{ultimaEdicao ? fmtDateTime(ultimaEdicao.criado_em) : (revendedoraInfo?.atualizado_em ? fmtDateTime(revendedoraInfo.atualizado_em) : '—')}</strong>
                  {ultimaEdicao?.user_nome && <> por <strong className="text-foreground">{ultimaEdicao.user_nome}</strong></>}
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 text-center">
                <Hash className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl font-bold">{totalCiclos}</p>
                <p className="text-xs text-muted-foreground">Ciclos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{formatarValor(totalVolume)}</p>
                <p className="text-xs text-muted-foreground">Volume Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <Trophy className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold">{formatarValor(ticketMedio)}</p>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <Award className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                <Badge variant="default" className={nivelBadgeClass(cor)}>{nivel}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Nível Atual</p>
              </CardContent>
            </Card>
          </div>

          {/* Histórico */}
          <Card>
            <CardContent className="py-3">
              <p className="text-sm font-medium mb-2">Histórico de Ciclos</p>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Carregando...</p>
              ) : prestacoes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum registro encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor Vendido</TableHead>
                        <TableHead className="text-right">Comissão (%)</TableHead>
                        <TableHead className="text-right">Valor Empresa</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <span>Saldo</span>
                            <button
                              type="button"
                              onClick={() => setSaldoVisivel((v) => !v)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title={saldoVisivel ? 'Ocultar saldo' : 'Mostrar saldo'}
                            >
                              {saldoVisivel ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prestacoes.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.data_execucao), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.total_venda))}</TableCell>
                          <TableCell className="text-right">{p.comissao_percentual}%</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.valor_devido_empresa))}</TableCell>
                          <TableCell className="text-right">{formatarValor(Number(p.valor_pago))}</TableCell>
                          <TableCell className="text-right">
                            {saldoVisivel ? formatarValor(Number(p.saldo_devedor) || 0) : '••••'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <RevendedoraFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          revendedoraId={revendedoraInfo?.id ?? null}
          initialNome={revendedoraInfo?.id ? undefined : nomeRevendedora}
        />


        <AlertDialog open={solicJuridicoOpen} onOpenChange={setSolicJuridicoOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Solicitar Encaminhamento Jurídico</AlertDialogTitle>
              <AlertDialogDescription>
                Descreva brevemente o motivo da solicitação. O admin precisa aprovar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={motivoJuridico}
              onChange={(e) => setMotivoJuridico(e.target.value)}
              rows={3}
              placeholder="Ex: cliente sumiu há 60 dias, sem retorno em WhatsApp."
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => solicitarJuridico.mutate()}>
                Enviar solicitação
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
