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
        atualizado_em: new Date().toISOString(),
      };

      let id = revendedoraId ?? null;

      if (id) {
        const { error } = await supabase.from('revendedoras').update(payload).eq('id', id);
        if (error) throw error;
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
      onSaved?.(id, nome);
      onClose();
    },
    onError: (err: any) => {
      if (err?.code === '23505') {
        toast.error('Já existe uma revendedora com este nome');
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
                    onChange={(e) => { setNome(e.target.value); if (bloqueioJuridico) setBloqueioJuridico(false); }}
                    onBlur={(e) => verificarBloqueio(e.target.value, cpf)}
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
                    onChange={(e) => { setCpf(maskCpf(e.target.value)); if (bloqueioJuridico) setBloqueioJuridico(false); }}
                    onBlur={(e) => verificarBloqueio(nome, e.target.value)}
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
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(maskFone(e.target.value))} placeholder="(11) 99999-9999" />
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
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
