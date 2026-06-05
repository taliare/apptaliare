import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatarValor, formatarInputMoeda, parseInputMoeda } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { registrarLog } from '@/lib/logOperacional';
import { useAuth } from '@/contexts/AuthContext';

type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';

interface PagamentoForm {
  forma: FormaPagamento | '';
  valor: string;
}

interface ModalReceberCobrancaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  cobranca: {
    id: string;
    revendedora: string;
    valor_previsto: number;
    tipo?: string | null;
    valor_adiantado?: number | null;
    status?: string | null;
  };
  valor_pago_acumulado?: number;
  diasNaoFinalizados?: string[];
  onPagamentoCompleto: (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
    valor_devolvido: number;
  }) => Promise<void>;
  onPagamentoParcial: (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    valor_recebido: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    valor_repasse: number;
    data_repasse: Date;
    dataNota: string;
    valor_devolvido: number;
  }) => Promise<void>;
}

export function ModalReceberCobranca({
  open,
  onOpenChange,
  isAdmin = false,
  cobranca,
  valor_pago_acumulado = 0,
  diasNaoFinalizados = [],
  onPagamentoCompleto,
  onPagamentoParcial
}: ModalReceberCobrancaProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  const isRepasse = cobranca.tipo?.toLowerCase() === 'repasse';
  
  // Modo subsequente: nota já tem pagamentos anteriores (não pedir valor da venda/comissão novamente)
  const isSubsequente = valor_pago_acumulado > 0 || cobranca.status === 'parcial' || isRepasse;
  const saldoAberto = Math.max(0, cobranca.valor_previsto - valor_pago_acumulado - (cobranca.valor_adiantado || 0));
  
  // Para KIT: valor da venda (precisa preencher)
  // Para REPASSE: usa valor_previsto
  const [valorDevolvido, setValorDevolvido] = useState('');
  
  // Desconto (discreto)
  const [desconto, setDesconto] = useState('');
  const [mostrarDesconto, setMostrarDesconto] = useState(false);
  
  // Comissão
  const [comissaoPercentual, setComissaoPercentual] = useState(0);
  const [comissaoValor, setComissaoValor] = useState(0);
  const [valorAReceber, setValorAReceber] = useState(0);
  
  // Pagamentos
  const [pagamento1, setPagamento1] = useState<PagamentoForm>({ forma: '', valor: '' });
  const [pagamento2, setPagamento2] = useState<PagamentoForm | null>(null);
  
  // Data da nota
  const [dataNota, setDataNota] = useState<Date>(new Date());
  
  // Pagamento parcial (discreto)
  const [mostrarPagamentoParcial, setMostrarPagamentoParcial] = useState(false);
  const [valorParcial, setValorParcial] = useState('');
  const [dataProximaCobranca, setDataProximaCobranca] = useState<Date>();
  
  const [loading, setLoading] = useState(false);

  // Inicializa valores quando abre o modal
  useEffect(() => {
    if (open) {
      if (isSubsequente) {
        // Modo subsequente: saldo já calculado, não pedir valor da venda
        setValorDevolvido('0');
        setValorAReceber(saldoAberto);
      } else {
        setValorDevolvido('');
        setValorAReceber(0);
      }
      setDesconto('');
      setMostrarDesconto(false);
      setComissaoPercentual(0);
      setComissaoValor(0);
      setPagamento1({ forma: '', valor: '' });
      setPagamento2(null);
      setDataNota(new Date());
      setMostrarPagamentoParcial(false);
      setValorParcial('');
      setDataProximaCobranca(undefined);
    }
  }, [open, isRepasse, isSubsequente, cobranca.valor_previsto, saldoAberto]);

  const calcularComissao = (valor: number, percentualForced?: number) => {
    if (percentualForced !== undefined) {
      const comissao = valor * (percentualForced / 100);
      setComissaoPercentual(percentualForced);
      setComissaoValor(comissao);
      setValorAReceber(Math.max(0, valor - comissao - (cobranca.valor_adiantado || 0)));
      return;
    }
    
    let percentual = 0;
    if (valor < 300) percentual = 20;
    else if (valor < 1000) percentual = 30;
    else if (valor < 2000) percentual = 40;
    else percentual = 50;
    
    const comissao = valor * (percentual / 100);
    setComissaoPercentual(percentual);
    setComissaoValor(comissao);
    setValorAReceber(Math.max(0, valor - comissao - (cobranca.valor_adiantado || 0)));
  };

  const handleValorDevolvidoChange = (value: string) => {
    const formatado = formatarInputMoeda(value);
    setValorDevolvido(formatado);
    
    const valorDevolvidoNum = parseInputMoeda(formatado);
    const valorVendido = Math.max(0, cobranca.valor_previsto - valorDevolvidoNum);
    
    if (valorVendido > 0) {
      calcularComissao(valorVendido);
    } else {
      setComissaoPercentual(0);
      setComissaoValor(0);
      setValorAReceber(0);
    }
  };
  
  const handleDescontoChange = (value: string) => {
    const formatado = formatarInputMoeda(value);
    setDesconto(formatado);
    
    const descontoNum = parseInputMoeda(formatado);
    
    if (isRepasse) {
      setValorAReceber(Math.max(0, cobranca.valor_previsto - descontoNum));
    } else if (isSubsequente) {
      // Desconto aplicado sobre o saldo em aberto, não sobre o valor total da nota
      setValorAReceber(Math.max(0, saldoAberto - descontoNum));
    } else {
      const valorVendaNum = parseInputMoeda(valorDevolvido);
      const valorVendido = Math.max(0, cobranca.valor_previsto - valorVendaNum);
      const valorAposComissao = valorVendido - comissaoValor;
      setValorAReceber(Math.max(0, valorAposComissao - descontoNum));
    }
  };

  const handleDevolveuTudo = async () => {
    setLoading(true);
    try {
      await onPagamentoCompleto({
        valor_venda: 0,
        comissao_percentual: 0,
        comissao_valor: 0,
        valor_devido_empresa: 0,
        pagamentos: [],
        tipo: 'devolucao',
        dataNota: format(dataNota, 'yyyy-MM-dd'),
        valor_devolvido: parseInputMoeda(valorDevolvido) || 0,
      });
      
      toast({
        title: "Cobrança finalizada",
        description: "Devolução total registrada com sucesso.",
      });
      
      registrarLog({
        tipo_acao: 'ALTERACAO_DEVOLUCAO',
        pedido_id: cobranca.id,
        valor_antes: cobranca.valor_previsto,
        valor_depois: 0,
        descricao: `Devolução total registrada para ${cobranca.revendedora}`,
        user: { id: user!.id, nome: profile?.nome || '', papel: profile?.role || 'representante' },
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro completo ao registrar devolução total:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao registrar pagamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularTotalRecebido = () => {
    const valor1 = parseInputMoeda(pagamento1.valor);
    const valor2 = pagamento2 ? parseInputMoeda(pagamento2.valor) : 0;
    return valor1 + valor2;
  };

  // Valor efetivo a receber (considera pagamento parcial)
  const valorEfetivoReceber = mostrarPagamentoParcial && valorParcial
    ? parseInputMoeda(valorParcial)
    : valorAReceber;
  
  const valorRestante = valorAReceber - valorEfetivoReceber;

  const handleReceberPagamento = async () => {
    // Só exige forma de pagamento se tem valor a receber
    if (valorEfetivoReceber > 0 && !pagamento1.forma) {
      toast({
        title: "Atenção",
        description: "Selecione a forma de pagamento.",
        variant: "destructive"
      });
      return;
    }

    if (pagamento2 && (!pagamento2.forma || !pagamento2.valor)) {
      toast({
        title: "Atenção",
        description: "Informe a forma e o valor do segundo pagamento ou remova-o.",
        variant: "destructive"
      });
      return;
    }

    // Se é pagamento parcial, precisa de data
    if (mostrarPagamentoParcial && valorRestante > 0) {
      if (!dataProximaCobranca) {
        toast({
          title: "Atenção",
          description: "Selecione a data da próxima cobrança.",
          variant: "destructive"
        });
        return;
      }
      
      setLoading(true);
      try {
        // Se valor efetivo a receber é zero, não precisa de pagamentos
        const pagamentos: Array<{ forma: FormaPagamento; valor: number }> = valorEfetivoReceber > 0 
          ? [{ forma: pagamento1.forma as FormaPagamento, valor: parseInputMoeda(pagamento1.valor) }]
          : [];
        
        if (valorEfetivoReceber > 0 && pagamento2) {
          pagamentos.push({
            forma: pagamento2.forma as FormaPagamento,
            valor: parseInputMoeda(pagamento2.valor)
          });
        }

        await onPagamentoParcial({
          valor_venda: Math.max(0, cobranca.valor_previsto - parseInputMoeda(valorDevolvido)),
          comissao_percentual: comissaoPercentual,
          comissao_valor: comissaoValor,
          valor_devido_empresa: valorAReceber,
          valor_recebido: valorEfetivoReceber,
          pagamentos,
          valor_repasse: valorRestante,
          data_repasse: dataProximaCobranca,
          dataNota: format(dataNota, 'yyyy-MM-dd'),
          valor_devolvido: parseInputMoeda(valorDevolvido) || 0,
        });
        
        const saldoAbertoAtual = cobranca.valor_previsto - valor_pago_acumulado - (cobranca.valor_adiantado || 0);
        const novoSaldo = saldoAbertoAtual - valorEfetivoReceber;
        toast({
          title: "Sucesso",
          description: novoSaldo <= 0 
            ? `Pagamento de ${formatarValor(valorEfetivoReceber)} registrado. Nota quitada!`
            : `Pagamento de ${formatarValor(valorEfetivoReceber)} registrado. Saldo restante: ${formatarValor(novoSaldo)}.`,
        });
        
        onOpenChange(false);
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao registrar pagamento.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Pagamento completo
    setLoading(true);
    try {
      // Se valor a receber é zero, não precisa de pagamentos
      const pagamentos: Array<{ forma: FormaPagamento; valor: number }> = [];
      
      if (valorAReceber > 0 && pagamento1.forma) {
        pagamentos.push({ 
          forma: pagamento1.forma as FormaPagamento, 
          valor: parseInputMoeda(pagamento1.valor) 
        });
        
        if (pagamento2) {
          pagamentos.push({
            forma: pagamento2.forma as FormaPagamento,
            valor: parseInputMoeda(pagamento2.valor)
          });
        }
      }

      await onPagamentoCompleto({
        valor_venda: Math.max(0, cobranca.valor_previsto - parseInputMoeda(valorDevolvido)),
        comissao_percentual: comissaoPercentual,
        comissao_valor: comissaoValor,
        valor_devido_empresa: valorAReceber,
        pagamentos,
        tipo: 'completo',
        dataNota: format(dataNota, 'yyyy-MM-dd'),
        valor_devolvido: parseInputMoeda(valorDevolvido) || 0,
      });
      
      toast({
        title: "Sucesso",
        description: "Cobrança recebida com sucesso.",
      });
      
      
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao registrar pagamento.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Permite receber se: 
  // - valor a receber = 0 (só registra sem pagamento)
  // - tem valor e forma de pagamento
  // - é repasse total (valor efetivo = 0 e resta algo para repasse)
  const valorTotalRepasse = mostrarPagamentoParcial && valorEfetivoReceber === 0 && valorRestante > 0;
  const podeReceber = valorAReceber === 0 || valorTotalRepasse || (valorAReceber > 0 && (valorEfetivoReceber === 0 || pagamento1.forma));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber Cobrança</DialogTitle>
          <DialogDescription>
            Revendedora: <strong>{cobranca.revendedora}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info de pagamentos anteriores */}
          {(valor_pago_acumulado > 0 || (cobranca.valor_adiantado || 0) > 0) && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm space-y-1">
              <div className="flex justify-between text-blue-700 dark:text-blue-300">
                <span>Valor total da nota:</span>
                <span className="font-semibold">{formatarValor(cobranca.valor_previsto)}</span>
              </div>
              <div className="flex justify-between text-blue-700 dark:text-blue-300">
                <span>Já pago:</span>
                <span className="font-semibold">{formatarValor(valor_pago_acumulado)}</span>
              </div>
              {(cobranca.valor_adiantado || 0) > 0 && (
                <div className="flex justify-between text-blue-700 dark:text-blue-300">
                  <span>Adiantado:</span>
                  <span className="font-semibold">{formatarValor(cobranca.valor_adiantado || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-blue-700 dark:text-blue-300 font-bold border-t border-blue-200 dark:border-blue-700 pt-1">
                <span>Saldo em aberto:</span>
                <span>{formatarValor(Math.max(0, cobranca.valor_previsto - valor_pago_acumulado - (cobranca.valor_adiantado || 0)))}</span>
              </div>
            </div>
          )}

          {/* Tipo da cobrança */}
          {isRepasse && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              Nota de <strong>REPASSE</strong>
            </div>
          )}

          {/* Valor em Joias Devolvidas (só para KIT na primeira cobrança) */}
          {!isRepasse && !isSubsequente && (
            <div className="space-y-2">
              <Label>Valor em Joias Devolvidas <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                placeholder="Digite o valor total devolvido em joias"
                value={valorDevolvido}
                onChange={(e) => handleValorDevolvidoChange(e.target.value)}
                disabled={loading}
                className={cn(!valorDevolvido && "border-orange-400 focus-visible:ring-orange-400")}
              />
              {!valorDevolvido && (
                <p className="text-xs text-orange-600">
                  Informe o valor total das joias que a revendedora devolveu
                </p>
              )}
              {valorDevolvido && parseInputMoeda(valorDevolvido) >= 0 && (
                <p className="text-xs text-muted-foreground">
                  Valor do kit: {formatarValor(cobranca.valor_previsto)} — Vendido: {formatarValor(Math.max(0, cobranca.valor_previsto - parseInputMoeda(valorDevolvido)))}
                </p>
              )}
            </div>
          )}

          {/* Info da comissão (só para KIT na primeira cobrança quando tem valor) */}
          {!isRepasse && !isSubsequente && valorAReceber > 0 && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between items-center">
                <span>Comissão ({comissaoPercentual}%):</span>
                <span className="font-medium">{formatarValor(comissaoValor)}</span>
              </div>
            </div>
          )}

          {/* Data da Cobrança */}
          <div className="space-y-2">
            <Label>Data da Cobrança</Label>
            <Popover modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataNota && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataNota, "PPP", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={dataNota}
                  onSelect={(date) => date && setDataNota(date)}
                  disabled={(date) => {
                    if (isAdmin) return false;
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);
                    if (checkDate.getTime() === hoje.getTime()) return false;
                    if (checkDate < hoje) {
                      return !diasNaoFinalizados.includes(format(checkDate, 'yyyy-MM-dd'));
                    }
                    return true;
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Valor a Receber */}
          {valorAReceber > 0 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium">Valor a Receber</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-primary">
                  {formatarValor(mostrarPagamentoParcial ? valorEfetivoReceber : valorAReceber)}
                </div>
              </div>
              
              {/* Opções discretas */}
              <div className="flex flex-wrap gap-2 pt-1">
                {/* Desconto (disponível para todos os tipos) */}
                {!mostrarDesconto && !desconto && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setMostrarDesconto(true)}
                  >
                    Aplicar desconto
                  </Button>
                )}
                
                {/* Pagamento Parcial */}
                {!mostrarPagamentoParcial && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => {
                      setMostrarPagamentoParcial(true);
                      setValorParcial('');
                    }}
                  >
                    Receber parcial
                  </Button>
                )}
              </div>

              {/* Campo de Desconto expandido */}
              {(mostrarDesconto || desconto) && (
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    type="text"
                    placeholder="Desconto"
                    value={desconto}
                    onChange={(e) => handleDescontoChange(e.target.value)}
                    className="h-8 w-24"
                  />
                  <span className="text-sm text-orange-600">
                    {desconto && parseInputMoeda(desconto) > 0 && `-${formatarValor(parseInputMoeda(desconto))}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setDesconto('');
                      setMostrarDesconto(false);
                      // Recalcula valor a receber sem desconto
                      if (isSubsequente) {
                        setValorAReceber(saldoAberto);
                        return;
                      }
                      const valorDevolvidoNum = parseInputMoeda(valorDevolvido);
                      const valorBase = isRepasse 
                        ? cobranca.valor_previsto 
                        : Math.max(0, cobranca.valor_previsto - valorDevolvidoNum);
                      if (isRepasse) {
                        setValorAReceber(valorBase);
                      } else {
                        calcularComissao(valorBase);
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Campo de Pagamento Parcial expandido */}
              {mostrarPagamentoParcial && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Valor a receber agora</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setMostrarPagamentoParcial(false);
                        setValorParcial('');
                        setDataProximaCobranca(undefined);
                        // Restaura valor no pagamento
                        if (pagamento1.forma && !pagamento2) {
                          setPagamento1({
                            ...pagamento1,
                            valor: valorAReceber.toFixed(2).replace('.', ',')
                          });
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={valorParcial}
                    onChange={(e) => {
                      const formatado = formatarInputMoeda(e.target.value);
                      setValorParcial(formatado);
                      if (pagamento1.forma && !pagamento2) {
                        setPagamento1({ ...pagamento1, valor: formatado });
                      }
                    }}
                    className="h-8"
                  />
                  
                  {valorRestante > 0 && (
                    <>
                      <div className="text-sm">
                        <span className="text-orange-700 dark:text-orange-300">Restante: </span>
                        <span className="font-bold">{formatarValor(valorRestante)}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-sm">Data da próxima cobrança</Label>
                        
                        {/* Mobile: input type="date" nativo */}
                        <div className="block md:hidden">
                          <Input
                            type="date"
                            value={dataProximaCobranca ? format(dataProximaCobranca, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                const [year, month, day] = e.target.value.split('-').map(Number);
                                setDataProximaCobranca(new Date(year, month - 1, day));
                              } else {
                                setDataProximaCobranca(undefined);
                              }
                            }}
                            min={format(new Date(), "yyyy-MM-dd")}
                            className="h-8"
                          />
                        </div>
                        
                        {/* Desktop: DatePicker com Popover */}
                        <div className="hidden md:block">
                          <Popover modal={true}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-8",
                                  !dataProximaCobranca && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {dataProximaCobranca ? format(dataProximaCobranca, "dd/MM/yyyy") : "Selecione"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[9999]" align="start" sideOffset={4}>
                              <Calendar
                                mode="single"
                                selected={dataProximaCobranca}
                                onSelect={setDataProximaCobranca}
                                disabled={(date) => {
                                  const hoje = new Date();
                                  hoje.setHours(0, 0, 0, 0);
                                  return new Date(date) < hoje;
                                }}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Forma de Pagamento */}
          {valorAReceber > 0 && (
            <div className="space-y-2">
              <Label>{pagamento2 ? 'Primeira Forma de Pagamento' : 'Forma de Pagamento'}</Label>
              <Select
                value={pagamento1.forma}
                onValueChange={(value) => {
                  if (!pagamento2) {
                    const valorPreencher = mostrarPagamentoParcial && valorParcial
                      ? valorParcial
                      : valorAReceber.toFixed(2).replace('.', ',');
                    setPagamento1({ forma: value as FormaPagamento, valor: valorPreencher });
                  } else {
                    setPagamento1({ ...pagamento1, forma: value as FormaPagamento });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
              
              {pagamento2 && (
                <Input
                  type="text"
                  placeholder="Valor"
                  value={pagamento1.valor}
                  onChange={(e) => setPagamento1({ ...pagamento1, valor: formatarInputMoeda(e.target.value) })}
                />
              )}
            </div>
          )}

          {/* Segunda Forma de Pagamento - disponível para integral e parcial */}
          {valorAReceber > 0 && (
            <>
              {!pagamento2 ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPagamento1({ ...pagamento1, valor: '' });
                    setPagamento2({ forma: '', valor: '' });
                  }}
                  disabled={!pagamento1.forma}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Segunda Forma de Pagamento
                </Button>
              ) : (
                <div className="space-y-2 p-3 border rounded-lg relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => {
                      setPagamento1({ ...pagamento1, valor: valorAReceber.toFixed(2).replace('.', ',') });
                      setPagamento2(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Label>Segunda Forma</Label>
                  <Select
                    value={pagamento2.forma}
                    onValueChange={(value) => setPagamento2({ ...pagamento2, forma: value as FormaPagamento })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Valor"
                    value={pagamento2.valor}
                    onChange={(e) => setPagamento2({ ...pagamento2, valor: formatarInputMoeda(e.target.value) })}
                  />
                </div>
              )}
            </>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            {!isRepasse && !isSubsequente && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDevolveuTudo}
                disabled={loading}
              >
                Devolveu Tudo
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={handleReceberPagamento}
              disabled={!podeReceber || loading}
              title={!podeReceber ? 'Preencha o valor da venda e selecione a forma de pagamento' : ''}
            >
              {mostrarPagamentoParcial && valorRestante > 0 ? 'Receber Parcial' : 'Receber'}
            </Button>
          </div>
          
          {/* Mensagem de ajuda quando botão está desabilitado */}
          {!podeReceber && !isRepasse && !isSubsequente && !valorDevolvido && (
            <p className="text-xs text-center text-muted-foreground">
              Informe o valor das joias devolvidas para habilitar o botão
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
