import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarIcon, Plus, Trash2, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NotaPromissoria {
  id: string;
  codigo_nota: string;
  data: string;
  valor_total: number;
  forma_pagamento_1: 'pix' | 'dinheiro' | 'cartao' | 'transferencia';
  valor_pagamento_1: number;
  forma_pagamento_2?: 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null;
  valor_pagamento_2?: number | null;
  representante_id: string;
}

interface CobrancaDiaria {
  id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  finalizado: boolean | null;
  representante_id: string;
}

const formaPagamentoLabels = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
};

export default function CobrancaDiaria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isNotaDialogOpen, setIsNotaDialogOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaPromissoria | null>(null);

  // Form states for Nota Promissória
  const [codigoNota, setCodigoNota] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [formaPagamento1, setFormaPagamento1] = useState<'pix' | 'dinheiro' | 'cartao' | 'transferencia'>('pix');
  const [valorPagamento1, setValorPagamento1] = useState('');
  const [formaPagamento2, setFormaPagamento2] = useState<'pix' | 'dinheiro' | 'cartao' | 'transferencia' | ''>('');
  const [valorPagamento2, setValorPagamento2] = useState('');

  // Form states for Cobrança Diária
  const [despesaCobranca, setDespesaCobranca] = useState('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Query for notas promissórias do dia
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-promissorias', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as NotaPromissoria[];
    },
    enabled: !!user?.id,
  });

  // Query for cobrança diária
  const { data: cobrancaDiaria, isLoading: loadingCobranca } = useQuery({
    queryKey: ['cobranca-diaria', dateStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .eq('data', dateStr)
        .maybeSingle();
      
      if (error) throw error;
      return data as CobrancaDiaria | null;
    },
    enabled: !!user?.id,
  });

  // Query for histórico
  const { data: historico = [] } = useQuery({
    queryKey: ['historico-cobrancas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_diarias')
        .select('*')
        .eq('representante_id', user?.id)
        .order('data', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as CobrancaDiaria[];
    },
    enabled: !!user?.id,
  });

  // Mutation para adicionar nota
  const addNotaMutation = useMutation({
    mutationFn: async (nota: Omit<NotaPromissoria, 'id' | 'criado_em'>) => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .insert(nota)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast.success('Nota promissória adicionada com sucesso!');
      resetNotaForm();
      setIsNotaDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar nota: ${error.message}`);
    },
  });

  // Mutation para atualizar nota
  const updateNotaMutation = useMutation({
    mutationFn: async ({ id, ...nota }: Partial<NotaPromissoria> & { id: string }) => {
      const { data, error } = await supabase
        .from('notas_promissorias')
        .update(nota)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast.success('Nota promissória atualizada com sucesso!');
      resetNotaForm();
      setIsNotaDialogOpen(false);
      setEditingNota(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar nota: ${error.message}`);
    },
  });

  // Mutation para deletar nota
  const deleteNotaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notas_promissorias')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-promissorias'] });
      toast.success('Nota promissória excluída com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir nota: ${error.message}`);
    },
  });

  // Mutation para finalizar dia
  const finalizarDiaMutation = useMutation({
    mutationFn: async () => {
      const totalCobrado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
      
      const cobrancaData = {
        representante_id: user!.id,
        data: dateStr,
        total_cobrado: totalCobrado,
        total_pix: totalPixCalculado,
        total_dinheiro: totalDinheiroCalculado,
        total_cartao: totalCartaoCalculado,
        despesa_cobranca: parseFloat(despesaCobranca) || 0,
        finalizado: true,
      };

      if (cobrancaDiaria) {
        const { data, error } = await supabase
          .from('cobrancas_diarias')
          .update(cobrancaData)
          .eq('id', cobrancaDiaria.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cobrancas_diarias')
          .insert(cobrancaData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranca-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      toast.success('Dia finalizado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao finalizar dia: ${error.message}`);
    },
  });

  const resetNotaForm = () => {
    setCodigoNota('');
    setValorTotal('');
    setFormaPagamento1('pix');
    setValorPagamento1('');
    setFormaPagamento2('');
    setValorPagamento2('');
  };

  const handleOpenNotaDialog = (nota?: NotaPromissoria) => {
    if (nota) {
      setEditingNota(nota);
      setCodigoNota(nota.codigo_nota);
      setValorTotal(nota.valor_total.toString());
      setFormaPagamento1(nota.forma_pagamento_1);
      setValorPagamento1(nota.valor_pagamento_1.toString());
      setFormaPagamento2(nota.forma_pagamento_2 || '');
      setValorPagamento2(nota.valor_pagamento_2?.toString() || '');
    } else {
      resetNotaForm();
      setEditingNota(null);
    }
    setIsNotaDialogOpen(true);
  };

  const handleSubmitNota = () => {
    // Validações
    if (!codigoNota || !valorTotal || !valorPagamento1) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const vTotal = parseFloat(valorTotal);
    const vPag1 = parseFloat(valorPagamento1);
    const vPag2 = valorPagamento2 ? parseFloat(valorPagamento2) : 0;

    if (vPag1 + vPag2 !== vTotal) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total');
      return;
    }

    if (valorPagamento2 && !formaPagamento2) {
      toast.error('Selecione a forma de pagamento 2');
      return;
    }

    const notaData = {
      representante_id: user!.id,
      data: dateStr,
      codigo_nota: codigoNota,
      valor_total: vTotal,
      forma_pagamento_1: formaPagamento1,
      valor_pagamento_1: vPag1,
      forma_pagamento_2: formaPagamento2 || null,
      valor_pagamento_2: vPag2 || null,
    };

    if (editingNota) {
      updateNotaMutation.mutate({ id: editingNota.id, ...notaData });
    } else {
      addNotaMutation.mutate(notaData);
    }
  };

  const handleFinalizarDia = () => {
    if (notas.length === 0) {
      toast.error('Adicione pelo menos uma nota promissória antes de finalizar o dia');
      return;
    }

    finalizarDiaMutation.mutate();
  };

  const totalCobradoCalculado = notas.reduce((acc, nota) => acc + nota.valor_total, 0);
  
  // Calcular totais por forma de pagamento automaticamente
  const totaisPorFormaPagamento = notas.reduce((acc, nota) => {
    // Soma pagamento 1
    acc[nota.forma_pagamento_1] = (acc[nota.forma_pagamento_1] || 0) + nota.valor_pagamento_1;
    
    // Soma pagamento 2 se existir
    if (nota.forma_pagamento_2 && nota.valor_pagamento_2) {
      acc[nota.forma_pagamento_2] = (acc[nota.forma_pagamento_2] || 0) + nota.valor_pagamento_2;
    }
    
    return acc;
  }, {} as Record<string, number>);
  
  const totalPixCalculado = totaisPorFormaPagamento['pix'] || 0;
  const totalDinheiroCalculado = totaisPorFormaPagamento['dinheiro'] || 0;
  const totalCartaoCalculado = totaisPorFormaPagamento['cartao'] || 0;
  const totalTransferenciaCalculado = totaisPorFormaPagamento['transferencia'] || 0;
  
  const isDiaFinalizado = cobrancaDiaria?.finalizado;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cobrança Diária</h1>
          <p className="text-muted-foreground">Registre suas notas promissórias e finalize o dia</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[240px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Notas Promissórias */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas Promissórias do Dia</CardTitle>
          <Dialog open={isNotaDialogOpen} onOpenChange={setIsNotaDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => handleOpenNotaDialog()} 
                disabled={isDiaFinalizado}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Nota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingNota ? 'Editar Nota Promissória' : 'Nova Nota Promissória'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="codigo_nota">Código da Nota *</Label>
                  <Input
                    id="codigo_nota"
                    value={codigoNota}
                    onChange={(e) => setCodigoNota(e.target.value)}
                    placeholder="Ex: NP-001"
                  />
                </div>

                <div>
                  <Label htmlFor="valor_total">Valor Total *</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="forma_pagamento_1">Forma de Pagamento 1 *</Label>
                    <Select value={formaPagamento1} onValueChange={(v: any) => setFormaPagamento1(v)}>
                      <SelectTrigger id="forma_pagamento_1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="valor_pagamento_1">Valor Pagamento 1 *</Label>
                    <Input
                      id="valor_pagamento_1"
                      type="number"
                      step="0.01"
                      value={valorPagamento1}
                      onChange={(e) => setValorPagamento1(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="forma_pagamento_2">Forma de Pagamento 2 (Opcional)</Label>
                    <Select value={formaPagamento2} onValueChange={(v: any) => setFormaPagamento2(v)}>
                      <SelectTrigger id="forma_pagamento_2">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="valor_pagamento_2">Valor Pagamento 2</Label>
                    <Input
                      id="valor_pagamento_2"
                      type="number"
                      step="0.01"
                      value={valorPagamento2}
                      onChange={(e) => setValorPagamento2(e.target.value)}
                      placeholder="0.00"
                      disabled={!formaPagamento2}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNotaDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmitNota}>
                  {editingNota ? 'Atualizar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingNotas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma nota promissória registrada para este dia
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Pagamento 1</TableHead>
                  <TableHead>Pagamento 2</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="font-medium">{nota.codigo_nota}</TableCell>
                    <TableCell>R$ {nota.valor_total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formaPagamentoLabels[nota.forma_pagamento_1]}: R$ {nota.valor_pagamento_1.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {nota.forma_pagamento_2 && nota.valor_pagamento_2 ? (
                        <Badge variant="secondary">
                          {formaPagamentoLabels[nota.forma_pagamento_2]}: R$ {nota.valor_pagamento_2.toFixed(2)}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenNotaDialog(nota)}
                          disabled={isDiaFinalizado}
                        >
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              disabled={isDiaFinalizado}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Nota Promissória</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a nota {nota.codigo_nota}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteNotaMutation.mutate(nota.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fechamento do Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fechamento do Dia
            {isDiaFinalizado && (
              <Badge variant="default" className="ml-2">
                <Lock className="h-3 w-3 mr-1" />
                Finalizado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="total_pix">Total PIX</Label>
              <Input
                id="total_pix"
                type="text"
                value={`R$ ${totalPixCalculado.toFixed(2)}`}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="total_dinheiro">Total Dinheiro</Label>
              <Input
                id="total_dinheiro"
                type="text"
                value={`R$ ${totalDinheiroCalculado.toFixed(2)}`}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="total_cartao">Total Cartão</Label>
              <Input
                id="total_cartao"
                type="text"
                value={`R$ ${totalCartaoCalculado.toFixed(2)}`}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="despesa_cobranca">Despesa de Cobrança</Label>
              <Input
                id="despesa_cobranca"
                type="number"
                step="0.01"
                value={despesaCobranca}
                onChange={(e) => setDespesaCobranca(e.target.value)}
                placeholder="0.00"
                disabled={isDiaFinalizado}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Cobrado (soma das notas)</p>
              <p className="text-2xl font-bold">R$ {totalCobradoCalculado.toFixed(2)}</p>
            </div>
            {!isDiaFinalizado && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={notas.length === 0}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finalizar Dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar Cobrança Diária</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja finalizar o dia? Após finalizar, não será possível adicionar ou editar notas promissórias para esta data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFinalizarDia}>
                      Confirmar Finalização
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Fechamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum fechamento registrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Total Cobrado</TableHead>
                  <TableHead>Total PIX</TableHead>
                  <TableHead>Total Dinheiro</TableHead>
                  <TableHead>Total Cartão</TableHead>
                  <TableHead>Despesas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((cobranca) => (
                  <TableRow key={cobranca.id}>
                    <TableCell className="font-medium">
                      {format(new Date(cobranca.data + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>R$ {cobranca.total_cobrado.toFixed(2)}</TableCell>
                    <TableCell>R$ {(cobranca.total_pix || 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {(cobranca.total_dinheiro || 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {(cobranca.total_cartao || 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {(cobranca.despesa_cobranca || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {cobranca.finalizado ? (
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Finalizado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Aberto
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
