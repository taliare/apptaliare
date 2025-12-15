import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatarValor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';

interface PagamentoForm {
  forma: FormaPagamento | '';
  valor: string;
}

interface ModalReceberCobrancaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: {
    id: string;
    revendedora: string;
    valor_previsto: number;
    tipo?: string | null;
  };
  diasNaoFinalizados?: string[];
  onPagamentoCompleto: (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    tipo: 'completo' | 'devolucao';
    dataNota: string;
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
  }) => Promise<void>;
}

export function ModalReceberCobranca({
  open,
  onOpenChange,
  cobranca,
  diasNaoFinalizados = [],
  onPagamentoCompleto,
  onPagamentoParcial
}: ModalReceberCobrancaProps) {
  const { toast } = useToast();
  
  const isRepasse = cobranca.tipo?.toLowerCase() === 'repasse';
  
  // Para KIT: valor da venda (precisa preencher)
  // Para REPASSE: usa valor_previsto
  const [valorVenda, setValorVenda] = useState('');
  
  // Desconto (discreto)
  const [desconto, setDesconto] = useState('');
  const [mostrarDesconto, setMostrarDesconto] = useState(false);
  
  // Comissão
  const [comissaoPercentual, setComissaoPercentual] = useState(0);
  const [comissaoValor, setComissaoValor] = useState(0);
  const [valorAReceber, setValorAReceber] = useState(0);
  const [comissaoManual, setComissaoManual] = useState(false);
  const [comissaoPercentualManual, setComissaoPercentualManual] = useState('');
  
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
      if (isRepasse) {
        setValorVenda(cobranca.valor_previsto.toString().replace('.', ','));
        setValorAReceber(cobranca.valor_previsto);
      } else {
        setValorVenda('');
        setValorAReceber(0);
      }
      setDesconto('');
      setMostrarDesconto(false);
      setComissaoPercentual(0);
      setComissaoValor(0);
      setComissaoManual(false);
      setComissaoPercentualManual('');
      setPagamento1({ forma: '', valor: '' });
      setPagamento2(null);
      setDataNota(new Date());
      setMostrarPagamentoParcial(false);
      setValorParcial('');
      setDataProximaCobranca(undefined);
    }
  }, [open, isRepasse, cobranca.valor_previsto]);

  const calcularComissao = (valor: number, percentualForced?: number) => {
    if (isRepasse) {
      const descontoValor = parseFloat(desconto.replace(',', '.')) || 0;
      setComissaoPercentual(0);
      setComissaoValor(0);
      setValorAReceber(valor - descontoValor);
      return;
    }
    
    if (percentualForced !== undefined) {
      const comissao = valor * (percentualForced / 100);
      setComissaoPercentual(percentualForced);
      setComissaoValor(comissao);
      setValorAReceber(valor - comissao);
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
    setValorAReceber(valor - comissao);
  };

  const handleValorVendaChange = (value: string) => {
    const cleanValue = value.replace(/[^\d,]/g, '');
    setValorVenda(cleanValue);
    
    const numeroValor = parseFloat(cleanValue.replace(',', '.'));
    if (!isNaN(numeroValor) && numeroValor > 0) {
      if (comissaoManual && comissaoPercentualManual) {
        calcularComissao(numeroValor, parseFloat(comissaoPercentualManual));
      } else {
        calcularComissao(numeroValor);
      }
    } else {
      setValorAReceber(0);
    }
  };
  
  const handleDescontoChange = (value: string) => {
    const cleanValue = value.replace(/[^\d,]/g, '');
    setDesconto(cleanValue);
    
    const valorBase = isRepasse ? cobranca.valor_previsto : (parseFloat(valorVenda.replace(',', '.')) || 0);
    const descontoNum = parseFloat(cleanValue.replace(',', '.')) || 0;
    setValorAReceber(valorBase - descontoNum);
  };

  const handleComissaoManualChange = (value: string) => {
    const cleanValue = value.replace(/[^\d,]/g, '');
    setComissaoPercentualManual(cleanValue);
    
    const percentual = parseFloat(cleanValue.replace(',', '.')) || 0;
    const valorVendaNum = parseFloat(valorVenda.replace(',', '.')) || 0;
    
    if (valorVendaNum > 0) {
      calcularComissao(valorVendaNum, percentual);
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
        dataNota: format(dataNota, 'yyyy-MM-dd')
      });
      
      toast({
        title: "Cobrança finalizada",
        description: "Devolução total registrada com sucesso.",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao registrar devolução total.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularTotalRecebido = () => {
    const valor1 = parseFloat(pagamento1.valor.replace(',', '.')) || 0;
    const valor2 = pagamento2 ? (parseFloat(pagamento2.valor.replace(',', '.')) || 0) : 0;
    return valor1 + valor2;
  };

  // Valor efetivo a receber (considera pagamento parcial)
  const valorEfetivoReceber = mostrarPagamentoParcial && valorParcial
    ? parseFloat(valorParcial.replace(',', '.')) || 0
    : valorAReceber;
  
  const valorRestante = valorAReceber - valorEfetivoReceber;

  const handleReceberPagamento = async () => {
    if (!pagamento1.forma) {
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
        const pagamentos: Array<{ forma: FormaPagamento; valor: number }> = [
          { forma: pagamento1.forma as FormaPagamento, valor: parseFloat(pagamento1.valor.replace(',', '.')) }
        ];
        
        if (pagamento2) {
          pagamentos.push({
            forma: pagamento2.forma as FormaPagamento,
            valor: parseFloat(pagamento2.valor.replace(',', '.'))
          });
        }

        await onPagamentoParcial({
          valor_venda: parseFloat(valorVenda.replace(',', '.')),
          comissao_percentual: comissaoPercentual,
          comissao_valor: comissaoValor,
          valor_devido_empresa: valorEfetivoReceber,
          valor_recebido: valorEfetivoReceber,
          pagamentos,
          valor_repasse: valorRestante,
          data_repasse: dataProximaCobranca,
          dataNota: format(dataNota, 'yyyy-MM-dd')
        });
        
        toast({
          title: "Sucesso",
          description: `Pagamento de ${formatarValor(valorEfetivoReceber)} registrado. Nova cobrança de ${formatarValor(valorRestante)} criada.`,
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
      const pagamentos: Array<{ forma: FormaPagamento; valor: number }> = [
        { forma: pagamento1.forma as FormaPagamento, valor: parseFloat(pagamento1.valor.replace(',', '.')) }
      ];
      
      if (pagamento2) {
        pagamentos.push({
          forma: pagamento2.forma as FormaPagamento,
          valor: parseFloat(pagamento2.valor.replace(',', '.'))
        });
      }

      await onPagamentoCompleto({
        valor_venda: parseFloat(valorVenda.replace(',', '.')),
        comissao_percentual: comissaoPercentual,
        comissao_valor: comissaoValor,
        valor_devido_empresa: valorAReceber,
        pagamentos,
        tipo: 'completo',
        dataNota: format(dataNota, 'yyyy-MM-dd')
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

  const podeReceber = valorAReceber > 0 && pagamento1.forma;

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
          {/* Tipo da cobrança */}
          {isRepasse && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              Nota de <strong>REPASSE</strong>
            </div>
          )}

          {/* Valor da Venda (só para KIT) */}
          {!isRepasse && (
            <div className="space-y-2">
              <Label>Valor da Venda</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={valorVenda}
                onChange={(e) => handleValorVendaChange(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* Info da comissão (só para KIT quando tem valor) */}
          {!isRepasse && valorAReceber > 0 && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between items-center">
                <span>Comissão ({comissaoPercentual}%):</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{formatarValor(comissaoValor)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => {
                      if (!comissaoManual) {
                        setComissaoManual(true);
                        setComissaoPercentualManual(comissaoPercentual.toString());
                      } else {
                        setComissaoManual(false);
                        setComissaoPercentualManual('');
                        const valorNum = parseFloat(valorVenda.replace(',', '.')) || 0;
                        if (valorNum > 0) calcularComissao(valorNum);
                      }
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {comissaoManual && (
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-xs">%:</Label>
                  <Input
                    type="text"
                    className="h-7 text-sm w-20"
                    value={comissaoPercentualManual}
                    onChange={(e) => handleComissaoManualChange(e.target.value)}
                  />
                </div>
              )}
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
                {/* Desconto (só REPASSE) */}
                {isRepasse && !mostrarDesconto && !desconto && (
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
              {isRepasse && (mostrarDesconto || desconto) && (
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    type="text"
                    placeholder="Desconto"
                    value={desconto}
                    onChange={(e) => handleDescontoChange(e.target.value)}
                    className="h-8 w-24"
                  />
                  <span className="text-sm text-orange-600">
                    {desconto && parseFloat(desconto.replace(',', '.')) > 0 && `-${formatarValor(parseFloat(desconto.replace(',', '.')))}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setDesconto('');
                      setMostrarDesconto(false);
                      setValorAReceber(cobranca.valor_previsto);
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
                      const clean = e.target.value.replace(/[^\d,]/g, '');
                      setValorParcial(clean);
                      // Atualiza pagamento1
                      if (pagamento1.forma && !pagamento2) {
                        setPagamento1({ ...pagamento1, valor: clean });
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
                        <Popover modal={false}>
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
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
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
                  onChange={(e) => setPagamento1({ ...pagamento1, valor: e.target.value.replace(/[^\d,]/g, '') })}
                />
              )}
            </div>
          )}

          {/* Segunda Forma de Pagamento */}
          {valorAReceber > 0 && !mostrarPagamentoParcial && (
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
                    onChange={(e) => setPagamento2({ ...pagamento2, valor: e.target.value.replace(/[^\d,]/g, '') })}
                  />
                </div>
              )}
            </>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDevolveuTudo}
              disabled={loading}
            >
              Devolveu Tudo
            </Button>
            <Button
              className="flex-1"
              onClick={handleReceberPagamento}
              disabled={!podeReceber || loading}
            >
              {mostrarPagamentoParcial && valorRestante > 0 ? 'Receber Parcial' : 'Receber'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
