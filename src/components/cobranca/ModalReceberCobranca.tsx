import { useState } from 'react';
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
  };
  onPagamentoCompleto: (dados: {
    valor_venda: number;
    comissao_percentual: number;
    comissao_valor: number;
    valor_devido_empresa: number;
    pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
    tipo: 'completo' | 'devolucao';
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
  }) => Promise<void>;
}

export function ModalReceberCobranca({
  open,
  onOpenChange,
  cobranca,
  onPagamentoCompleto,
  onPagamentoParcial
}: ModalReceberCobrancaProps) {
  const { toast } = useToast();
  
  // Estado do fluxo
  const [etapa, setEtapa] = useState<'venda' | 'pagamento' | 'repasse'>('venda');
  
  // Dados da venda
  const [valorVenda, setValorVenda] = useState('');
  const [devolveuTudo, setDevolveuTudo] = useState(false);
  
  // Cálculos automáticos
  const [comissaoPercentual, setComissaoPercentual] = useState(0);
  const [comissaoValor, setComissaoValor] = useState(0);
  const [valorAReceber, setValorAReceber] = useState(0);
  
  // Pagamentos
  const [pagamento1, setPagamento1] = useState<PagamentoForm>({ forma: '', valor: '' });
  const [pagamento2, setPagamento2] = useState<PagamentoForm | null>(null);
  
  // Repasse
  const [valorRepasse, setValorRepasse] = useState('');
  const [dataRepasse, setDataRepasse] = useState<Date>();
  
  // Carregando
  const [loading, setLoading] = useState(false);

  const calcularComissao = (valor: number) => {
    let percentual = 0;
    if (valor < 300) {
      percentual = 20;
    } else if (valor < 1000) {
      percentual = 30;
    } else if (valor < 2000) {
      percentual = 40;
    } else {
      percentual = 50;
    }
    
    const comissao = valor * (percentual / 100);
    const aReceber = valor - comissao;
    
    setComissaoPercentual(percentual);
    setComissaoValor(comissao);
    setValorAReceber(aReceber);
  };

  const handleValorVendaChange = (value: string) => {
    // Remove tudo que não for número ou vírgula
    const cleanValue = value.replace(/[^\d,]/g, '');
    setValorVenda(cleanValue);
    
    // Converte para número para cálculo
    const numeroValor = parseFloat(cleanValue.replace(',', '.'));
    if (!isNaN(numeroValor)) {
      calcularComissao(numeroValor);
    }
  };

  const handleDevolveuTudo = async () => {
    setDevolveuTudo(true);
    setLoading(true);
    
    try {
      await onPagamentoCompleto({
        valor_venda: 0,
        comissao_percentual: 0,
        comissao_valor: 0,
        valor_devido_empresa: 0,
        pagamentos: [],
        tipo: 'devolucao'
      });
      
      toast({
        title: "Cobrança finalizada",
        description: "Devolução total registrada com sucesso.",
      });
      
      onOpenChange(false);
      resetarFormulario();
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

  const avancarParaPagamento = () => {
    if (!valorVenda || parseFloat(valorVenda.replace(',', '.')) <= 0) {
      toast({
        title: "Atenção",
        description: "Informe o valor da venda.",
        variant: "destructive"
      });
      return;
    }
    setEtapa('pagamento');
  };

  const adicionarSegundoPagamento = () => {
    if (!pagamento2) {
      setPagamento2({ forma: '', valor: '' });
    }
  };

  const removerSegundoPagamento = () => {
    setPagamento2(null);
  };

  const calcularTotalRecebido = () => {
    const valor1 = parseFloat(pagamento1.valor.replace(',', '.')) || 0;
    const valor2 = pagamento2 ? (parseFloat(pagamento2.valor.replace(',', '.')) || 0) : 0;
    return valor1 + valor2;
  };

  const handleReceberPagamento = async () => {
    // Validações
    if (!pagamento1.forma || !pagamento1.valor) {
      toast({
        title: "Atenção",
        description: "Informe a forma e o valor do primeiro pagamento.",
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

    const totalRecebido = calcularTotalRecebido();
    
    if (totalRecebido > valorAReceber) {
      toast({
        title: "Atenção",
        description: "O valor recebido não pode ser maior que o valor a receber.",
        variant: "destructive"
      });
      return;
    }

    // Pagamento completo
    if (totalRecebido === valorAReceber) {
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
          tipo: 'completo'
        });
        
        toast({
          title: "Sucesso",
          description: "Cobrança recebida com sucesso.",
        });
        
        onOpenChange(false);
        resetarFormulario();
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao registrar pagamento.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Pagamento parcial - avançar para repasse
      setValorRepasse((valorAReceber - totalRecebido).toFixed(2).replace('.', ','));
      setEtapa('repasse');
    }
  };

  const handleCriarRepasse = async () => {
    if (!valorRepasse || !dataRepasse) {
      toast({
        title: "Atenção",
        description: "Informe o valor e a data do repasse.",
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
        valor_devido_empresa: valorAReceber,
        valor_recebido: calcularTotalRecebido(),
        pagamentos,
        valor_repasse: parseFloat(valorRepasse.replace(',', '.')),
        data_repasse: dataRepasse
      });
      
      toast({
        title: "Sucesso",
        description: "Pagamento parcial e repasse criados com sucesso.",
      });
      
      onOpenChange(false);
      resetarFormulario();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar repasse.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetarFormulario = () => {
    setEtapa('venda');
    setValorVenda('');
    setDevolveuTudo(false);
    setComissaoPercentual(0);
    setComissaoValor(0);
    setValorAReceber(0);
    setPagamento1({ forma: '', valor: '' });
    setPagamento2(null);
    setValorRepasse('');
    setDataRepasse(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetarFormulario();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber Cobrança</DialogTitle>
          <DialogDescription>
            Revendedora: <strong>{cobranca.revendedora}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Etapa 1: Valor da Venda */}
        {etapa === 'venda' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor-venda">Valor da Venda</Label>
              <Input
                id="valor-venda"
                type="text"
                placeholder="0,00"
                value={valorVenda}
                onChange={(e) => handleValorVendaChange(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleDevolveuTudo}
              disabled={loading}
            >
              Devolveu Tudo
            </Button>

            {valorVenda && parseFloat(valorVenda.replace(',', '.')) > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Comissão ({comissaoPercentual}%):</span>
                  <span className="font-medium">{formatarValor(comissaoValor)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Valor a Receber (Taliare):</span>
                  <span className="text-primary">{formatarValor(valorAReceber)}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={avancarParaPagamento}
              disabled={!valorVenda || loading}
            >
              Receber
            </Button>
          </div>
        )}

        {/* Etapa 2: Formas de Pagamento */}
        {etapa === 'pagamento' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-1">Valor a Receber</div>
              <div className="text-2xl font-bold text-primary">{formatarValor(valorAReceber)}</div>
            </div>

            {/* Pagamento 1 */}
            <div className="space-y-2">
              <Label>Primeira Forma de Pagamento</Label>
              <Select
                value={pagamento1.forma}
                onValueChange={(value) => setPagamento1({ ...pagamento1, forma: value as FormaPagamento })}
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
                placeholder="Valor recebido"
                value={pagamento1.valor}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d,]/g, '');
                  setPagamento1({ ...pagamento1, valor: clean });
                }}
              />
            </div>

            {/* Pagamento 2 */}
            {!pagamento2 ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={adicionarSegundoPagamento}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Segunda Forma de Pagamento
              </Button>
            ) : (
              <div className="space-y-2 p-3 border rounded-lg relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={removerSegundoPagamento}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Label>Segunda Forma de Pagamento</Label>
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
                  placeholder="Valor recebido"
                  value={pagamento2.valor}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d,]/g, '');
                    setPagamento2({ ...pagamento2, valor: clean });
                  }}
                />
              </div>
            )}

            {calcularTotalRecebido() > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total Recebido:</span>
                  <span className="font-bold">{formatarValor(calcularTotalRecebido())}</span>
                </div>
                {calcularTotalRecebido() < valorAReceber && (
                  <div className="flex justify-between text-sm mt-1 text-orange-600">
                    <span>Valor em Aberto:</span>
                    <span className="font-bold">{formatarValor(valorAReceber - calcularTotalRecebido())}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEtapa('venda')}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleReceberPagamento}
                disabled={loading}
              >
                {calcularTotalRecebido() === valorAReceber ? 'Receber Pagamento' : 'Criar Repasse'}
              </Button>
            </div>
          </div>
        )}

        {/* Etapa 3: Criar Repasse */}
        {etapa === 'repasse' && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="text-sm font-medium mb-1">Valor em Aberto</div>
              <div className="text-2xl font-bold text-orange-600">{formatarValor(valorAReceber - calcularTotalRecebido())}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor-repasse">Valor do Repasse</Label>
              <Input
                id="valor-repasse"
                type="text"
                placeholder="0,00"
                value={valorRepasse}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d,]/g, '');
                  setValorRepasse(clean);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Data do Repasse</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataRepasse && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataRepasse ? format(dataRepasse, "PPP", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataRepasse}
                    onSelect={setDataRepasse}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEtapa('pagamento')}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleCriarRepasse}
                disabled={loading}
              >
                Criar Repasse
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
