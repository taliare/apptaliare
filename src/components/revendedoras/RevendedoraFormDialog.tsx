import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FotoCapture } from './FotoCapture';
import { uploadRevendedoraFoto } from '@/lib/revendedoraFoto';
import { useRevendedoraHistorico } from '@/hooks/useRevendedoraHistorico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Referencia {
  id?: string;
  nome: string;
  telefone: string;
  vinculo: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  revendedoraId?: string | null;
  /** Nome inicial sugerido (para fluxo de "cadastrar nova" a partir de uma busca) */
  initialNome?: string;
  onSaved?: (id: string, nome: string) => void;
}

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório').max(120),
  cpf: z.string().trim().min(11, 'CPF obrigatório').max(20),
  whatsapp: z.string().trim().min(8, 'WhatsApp obrigatório').max(20),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
});

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const maskFone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
};

const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export function RevendedoraFormDialog({ open, onClose, revendedoraId, initialNome, onSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Estado dos campos
  const [foto, setFoto] = useState<{ path: string | null; pickedBlob: Blob | null; previewUrl: string | null }>({
    path: null,
    pickedBlob: null,
    previewUrl: null,
  });
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [genero, setGenero] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telAlt, setTelAlt] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [bloqueioJuridico, setBloqueioJuridico] = useState(false);
  const [checandoBloqueio, setChecandoBloqueio] = useState(false);
  const [duplicidade, setDuplicidade] = useState<{ motivo: string; representante_nome: string } | null>(null);

  const verificarBloqueio = async (nomeVal: string, cpfVal: string) => {
    if (revendedoraId) return; // só aplica no cadastro
    const nomeLimpo = nomeVal.trim();
    const cpfLimpo = cpfVal.replace(/\D/g, '');
    if (!nomeLimpo && !cpfLimpo) {
      setBloqueioJuridico(false);
      return;
    }
    setChecandoBloqueio(true);
    try {
      const { data, error } = await supabase.rpc('verificar_bloqueio_juridico', {
        p_nome: nomeLimpo,
        p_cpf: cpfLimpo || null,
      });
      if (error) throw error;
      const isBlocked = Array.isArray(data) ? data[0]?.blocked : (data as any)?.blocked;
      setBloqueioJuridico(!!isBlocked);
    } catch {
      setBloqueioJuridico(false);
    } finally {
      setChecandoBloqueio(false);
    }
  };

  const verificarDuplicidade = async (nomeVal: string, cpfVal: string, whatsappVal: string) => {
    const nomeLimpo = nomeVal.trim();
    const cpfLimpo = cpfVal.replace(/\D/g, '');
    const wppLimpo = whatsappVal.replace(/\D/g, '');

    // Em modo edição, só checa campos que mudaram em relação ao valor original.
    // Evita falso positivo com homônimos pré-existentes em outras carteiras.
    let nomeParam = nomeLimpo;
    let cpfParam: string | null = cpfLimpo || null;
    let wppParam: string | null = wppLimpo || null;
    if (revendedoraId && rev) {
      const nomeOrig = (rev.nome ?? '').trim();
      const cpfOrig = (rev.cpf ?? '').replace(/\D/g, '');
      const wppOrig = (rev.whatsapp ?? '').replace(/\D/g, '');
      if (nomeLimpo.toUpperCase() === nomeOrig.toUpperCase()) nomeParam = '';
      if (cpfLimpo === cpfOrig) cpfParam = null;
      if (wppLimpo === wppOrig) wppParam = null;
      if (!nomeParam && !cpfParam && !wppParam) {
        setDuplicidade(null);
        return;
      }
    }

    if (!nomeParam && !cpfParam && !wppParam) {
      setDuplicidade(null);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('checar_duplicidade_revendedora', {
        p_representante_id: user?.id ?? null,
        p_nome: nomeParam,
        p_cpf: cpfParam,
        p_whatsapp: wppParam,
        p_ignorar_id: revendedoraId ?? null,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.duplicado) {
        setDuplicidade({ motivo: res.motivo, representante_nome: res.representante_nome });
      } else {
        setDuplicidade(null);
      }
    } catch {
      setDuplicidade(null);
    }
  };

  // Carregar dados existentes
  const { data: rev } = useQuery({
    queryKey: ['revendedora-form', revendedoraId],
    queryFn: async () => {
      if (!revendedoraId) return null;
      const { data, error } = await supabase
        .from('revendedoras')
        .select('*')
        .eq('id', revendedoraId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!revendedoraId,
  });

  const { data: refsExistentes } = useQuery({
    queryKey: ['revendedora-refs', revendedoraId],
    queryFn: async () => {
      if (!revendedoraId) return [];
      const { data, error } = await supabase
        .from('revendedoras_referencias')
        .select('*')
        .eq('revendedora_id', revendedoraId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!revendedoraId,
  });

  // Reset quando abre
  useEffect(() => {
    if (!open) return;
    if (rev) {
      setFoto({ path: rev.foto_url ?? null, pickedBlob: null, previewUrl: null });
      setNome(rev.nome ?? '');
      setCpf(rev.cpf ? maskCpf(rev.cpf) : '');
      setRg(rev.rg ?? '');
      setDataNasc(rev.data_nascimento ?? '');
      setGenero(rev.genero ?? '');
      setEstadoCivil(rev.estado_civil ?? '');
      setCep(rev.cep ? maskCep(rev.cep) : '');
      setLogradouro(rev.logradouro ?? '');
      setNumero(rev.numero ?? '');
      setComplemento(rev.complemento ?? '');
      setBairro(rev.bairro ?? '');
      setCidade(rev.cidade ?? '');
      setEstado(rev.estado ?? '');
      setWhatsapp(rev.whatsapp ? maskFone(rev.whatsapp) : '');
      setTelAlt(rev.telefone_alternativo ? maskFone(rev.telefone_alternativo) : '');
      setEmail(rev.email ?? '');
      setObservacoes(rev.observacoes ?? '');
    } else if (!revendedoraId) {
      setFoto({ path: null, pickedBlob: null, previewUrl: null });
      setNome(initialNome ?? '');
      setCpf('');
      setRg('');
      setDataNasc('');
      setGenero('');
      setEstadoCivil('');
      setCep('');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidade('');
      setEstado('');
      setWhatsapp('');
      setTelAlt('');
      setEmail('');
      setObservacoes('');
      setReferencias([]);
    }
    setBloqueioJuridico(false);
    setDuplicidade(null);
  }, [rev, open, revendedoraId, initialNome]);

  useEffect(() => {
    if (refsExistentes) {
      setReferencias(
        refsExistentes.map((r) => ({
          id: r.id,
          nome: r.nome ?? '',
          telefone: r.telefone ?? '',
          vinculo: r.vinculo ?? '',
        }))
      );
    }
  }, [refsExistentes]);

  // ViaCEP
  const buscarCep = async (raw: string) => {
    const cepLimpo = raw.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      setLogradouro(data.logradouro ?? '');
      setBairro(data.bairro ?? '');
      setCidade(data.localidade ?? '');
      setEstado(data.uf ?? '');
    } catch {
      toast.error('Erro ao consultar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const onPickFoto = (file: Blob | null) => {
    if (foto.previewUrl) URL.revokeObjectURL(foto.previewUrl);
    if (!file) {
      setFoto((f) => ({ ...f, pickedBlob: null, previewUrl: null }));
      return;
    }
    setFoto((f) => ({ ...f, pickedBlob: file, previewUrl: URL.createObjectURL(file) }));
  };

  const addRef = () => setReferencias((rs) => [...rs, { nome: '', telefone: '', vinculo: '' }]);
  const updRef = (i: number, patch: Partial<Referencia>) =>
    setReferencias((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const rmRef = (i: number) => setReferencias((rs) => rs.filter((_, idx) => idx !== i));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ''),
        whatsapp: whatsapp.replace(/\D/g, ''),
        email: email.trim(),
      });
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0].message);
      }

      // Bloqueio jurídico: verifica se nome ou CPF estão na lista de bloqueados
      if (!revendedoraId) {
        const { data: bloqueio, error: bloqErr } = await supabase.rpc('verificar_bloqueio_juridico', {
          p_nome: nome.trim(),
          p_cpf: cpf.replace(/\D/g, '') || null,
        });
        if (bloqErr) throw bloqErr;
        const isBlocked = Array.isArray(bloqueio) ? bloqueio[0]?.blocked : (bloqueio as any)?.blocked;
        if (isBlocked) {
          throw new Error('⚠️ Esta pessoa consta na lista de inadimplentes/protestadas do jurídico e está bloqueada para novo cadastro.');
        }
      }

      const payload: any = {
        nome: nome.trim().toUpperCase(),
        cpf: cpf.replace(/\D/g, '') || null,
        rg: rg.trim() || null,
        data_nascimento: dataNasc || null,
        genero: genero || null,
        estado_civil: estadoCivil || null,
        cep: cep.replace(/\D/g, '') || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        estado: estado.trim() || null,
        whatsapp: whatsapp.replace(/\D/g, '') || null,
        telefone_alternativo: telAlt.replace(/\D/g, '') || null,
        email: email.trim() || null,
        observacoes: observacoes.trim() || null,
      };

      let id = revendedoraId ?? null;

      if (id) {
        const { data, error } = await supabase
          .from('revendedoras')
          .update(payload)
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Sem permissão para atualizar esta revendedora (verifique se ela pertence a você).');
        }
      } else {
        payload.representante_id = user?.id;
        payload.ativo = true;
        const { data, error } = await supabase
          .from('revendedoras')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Upload da foto (se houve nova)
      if (foto.pickedBlob && id) {
        const path = await uploadRevendedoraFoto(foto.pickedBlob, id);
        const { error } = await supabase.from('revendedoras').update({ foto_url: path }).eq('id', id);
        if (error) throw error;
      }

      // Sincronizar referências (estratégia simples: delete+insert)
      if (id) {
        await supabase.from('revendedoras_referencias').delete().eq('revendedora_id', id);
        const validas = referencias.filter((r) => r.nome.trim());
        if (validas.length > 0) {
          const { error } = await supabase.from('revendedoras_referencias').insert(
            validas.map((r) => ({
              revendedora_id: id!,
              nome: r.nome.trim(),
              telefone: r.telefone.replace(/\D/g, '') || null,
              vinculo: r.vinculo.trim() || null,
            }))
          );
          if (error) throw error;
        }
      }

      return { id: id!, nome: payload.nome };
    },
    onSuccess: ({ id, nome }) => {
      toast.success(revendedoraId ? 'Revendedora atualizada' : 'Revendedora cadastrada');
      qc.invalidateQueries({ queryKey: ['revendedoras-admin'] });
      qc.invalidateQueries({ queryKey: ['revendedora-form'] });
      qc.invalidateQueries({ queryKey: ['revendedora-refs'] });
      qc.invalidateQueries({ queryKey: ['revendedora-info'] });
      qc.invalidateQueries({ queryKey: ['revendedora-historico'] });
      qc.invalidateQueries({ queryKey: ['minhas-revendedoras-ativas'] });
      qc.invalidateQueries({ queryKey: ['revendedoras-inativas'] });
      onSaved?.(id, nome);
      onClose();
    },
    onError: (err: any) => {
      if (err?.code === '23505') {
        toast.error(err?.message ?? 'Já existe um cadastro com dados iguais');
      } else {
        toast.error(err?.message ?? 'Erro ao salvar');
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{revendedoraId ? 'Editar Revendedora' : 'Nova Revendedora'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {duplicidade && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
              <p className="font-semibold">⚠️ Revendedora já cadastrada</p>
              <p className="mt-1">
                Esta revendedora já está cadastrada com o representante <strong>{duplicidade.representante_nome}</strong>
                {' '}({duplicidade.motivo === 'cpf' ? 'CPF igual' : duplicidade.motivo === 'whatsapp' ? 'WhatsApp igual' : 'nome igual'}).
                Solicite a transferência ao administrador.
              </p>
            </div>
          )}
          {/* DADOS PESSOAIS */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Dados Pessoais</h3>
              <FotoCapture
                currentPath={foto.path}
                onPick={onPickFoto}
                pickedPreviewUrl={foto.previewUrl}
              />
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={nome}
                    onChange={(e) => { setNome(e.target.value); if (bloqueioJuridico) setBloqueioJuridico(false); if (duplicidade) setDuplicidade(null); }}
                    onBlur={(e) => { verificarBloqueio(e.target.value, cpf); verificarDuplicidade(e.target.value, cpf, whatsapp); }}
                  />
                  {bloqueioJuridico && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      ⚠️ Esta pessoa consta na lista de inadimplentes/protestadas do jurídico.
                    </p>
                  )}
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input
                    value={cpf}
                    onChange={(e) => { setCpf(maskCpf(e.target.value)); if (bloqueioJuridico) setBloqueioJuridico(false); if (duplicidade) setDuplicidade(null); }}
                    onBlur={(e) => { verificarBloqueio(nome, e.target.value); verificarDuplicidade(nome, e.target.value, whatsapp); }}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input value={rg} onChange={(e) => setRg(e.target.value)} />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} />
                </div>
                <div>
                  <Label>Gênero</Label>
                  <Select value={genero} onValueChange={setGenero}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Estado Civil</Label>
                  <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solteira">Solteira</SelectItem>
                      <SelectItem value="Casada">Casada</SelectItem>
                      <SelectItem value="Divorciada">Divorciada</SelectItem>
                      <SelectItem value="Viúva">Viúva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ENDEREÇO */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Endereço</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      value={cep}
                      onChange={(e) => {
                        const v = maskCep(e.target.value);
                        setCep(v);
                        if (v.replace(/\D/g, '').length === 8) buscarCep(v);
                      }}
                      placeholder="00000-000"
                    />
                    {cepLoading && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Complemento</Label>
                  <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Input value={estado} maxLength={2} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CONTATO */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Contato</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>WhatsApp *</Label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => { setWhatsapp(maskFone(e.target.value)); if (duplicidade) setDuplicidade(null); }}
                    onBlur={(e) => verificarDuplicidade(nome, cpf, e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label>Telefone Alternativo</Label>
                  <Input value={telAlt} onChange={(e) => setTelAlt(maskFone(e.target.value))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* REFERÊNCIAS */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Referências</h3>
                <Button type="button" size="sm" variant="outline" onClick={addRef} className="gap-1">
                  <Plus className="w-4 h-4" />Adicionar
                </Button>
              </div>
              {referencias.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma referência adicionada.</p>
              )}
              {referencias.map((r, i) => (
                <div key={i} className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border-b pb-3 last:border-b-0">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={r.nome} onChange={(e) => updRef(i, { nome: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone</Label>
                    <Input value={r.telefone} onChange={(e) => updRef(i, { telefone: maskFone(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Vínculo</Label>
                    <Input value={r.vinculo} onChange={(e) => updRef(i, { vinculo: e.target.value })} placeholder="Mãe, marido..." />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => rmRef(i)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* OBSERVAÇÕES */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </CardContent>
          </Card>

          {revendedoraId && <HistoricoEdicoes revendedoraId={revendedoraId} />}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || bloqueioJuridico || checandoBloqueio || !!duplicidade}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {bloqueioJuridico ? 'Bloqueado pelo Jurídico' : duplicidade ? 'Já cadastrada com outro' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CAMPO_LABELS: Record<string, string> = {
  nome: 'Nome', cpf: 'CPF', rg: 'RG', data_nascimento: 'Data de nascimento',
  genero: 'Gênero', estado_civil: 'Estado civil', cep: 'CEP', logradouro: 'Logradouro',
  numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade',
  estado: 'UF', whatsapp: 'WhatsApp', telefone_alternativo: 'Telefone alternativo',
  email: 'Email', observacoes: 'Observações', foto_url: 'Foto',
  status_juridico: 'Status jurídico', ativo: 'Ativo',
};

function HistoricoEdicoes({ revendedoraId }: { revendedoraId: string }) {
  const { data: historico = [], isLoading } = useRevendedoraHistorico(revendedoraId);
  const [expandido, setExpandido] = useState(false);
  const visivel = expandido ? historico : historico.slice(0, 10);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Histórico de Edições</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros de auditoria.</p>
        ) : (
          <>
            <ul className="space-y-3 text-sm">
              {visivel.map((h) => (
                <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">
                      {h.acao === 'criou' ? 'Cadastrada' : 'Editada'}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(h.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {h.user_nome && (
                      <span className="text-muted-foreground">por <strong>{h.user_nome}</strong></span>
                    )}
                  </div>
                  {h.acao === 'editou' && Object.keys(h.campos_alterados).length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {Object.entries(h.campos_alterados).map(([campo, diff]) => (
                        <li key={campo}>
                          <strong>{CAMPO_LABELS[campo] ?? campo}:</strong>{' '}
                          <span className="line-through">{String((diff as any).antes ?? '—')}</span>
                          {' → '}
                          <span className="text-foreground">{String((diff as any).depois ?? '—')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {historico.length > 10 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setExpandido((v) => !v)}>
                {expandido ? 'Ver menos' : `Ver mais (${historico.length - 10})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

