import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Calendar, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatarNumero } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Sanitize HTML to prevent XSS attacks
function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface Profile {
  id: string;
  nome: string;
  email: string | null;
}

interface CobrancaDiaria {
  id: string;
  data: string;
  total_cobrado: number;
  total_pix: number | null;
  total_dinheiro: number | null;
  total_cartao: number | null;
  despesa_cobranca: number | null;
  representante_id: string;
  finalizado: boolean | null;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Relatorios() {
  const [mesAno, setMesAno] = useState(format(new Date(), 'yyyy-MM'));
  const [representanteId, setRepresentanteId] = useState('todos');

  // Query para representantes ativos
  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-relatorio'],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'representante');
      
      if (rolesError) throw rolesError;
      
      const representanteIds = rolesData.map(r => r.user_id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .in('id', representanteIds)
        .order('nome');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Query para dados do período (mensal)
  const { data: dadosRelatorio } = useQuery({
    queryKey: ['relatorio', mesAno, representanteId],
    queryFn: async () => {
      const inicio = format(startOfMonth(new Date(mesAno + '-01')), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(mesAno + '-01')), 'yyyy-MM-dd');

      let queryCobrancas = supabase
        .from('cobrancas_diarias')
        .select('*')
        .gte('data', inicio)
        .lte('data', fim);

      if (representanteId !== 'todos') {
        queryCobrancas = queryCobrancas.eq('representante_id', representanteId);
      }

      const { data: cobrancas, error: cobError } = await queryCobrancas;
      if (cobError) throw cobError;

      let queryNotas = supabase
        .from('notas_promissorias')
        .select('*')
        .gte('data', inicio)
        .lte('data', fim);

      if (representanteId !== 'todos') {
        queryNotas = queryNotas.eq('representante_id', representanteId);
      }

      const { data: notas, error: notasError } = await queryNotas;
      if (notasError) throw notasError;

      let queryKits = supabase
        .from('kits_entregues')
        .select('*')
        .gte('data_entrega', inicio)
        .lte('data_entrega', fim);

      if (representanteId !== 'todos') {
        queryKits = queryKits.eq('representante_id', representanteId);
      }

      const { data: kits, error: kitsError } = await queryKits;
      if (kitsError) throw kitsError;

      return { cobrancas: cobrancas as CobrancaDiaria[], notas, kits };
    },
  });

  // Query para dados das últimas 8 semanas (para gráficos de evolução)
  const { data: dadosSemanais = [] } = useQuery({
    queryKey: ['relatorio-semanal', representanteId],
    queryFn: async () => {
      const hoje = new Date();
      const inicioIntervalo = subWeeks(hoje, 8);
      const inicio = format(startOfWeek(inicioIntervalo, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const fim = format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      let query = supabase
        .from('cobrancas_diarias')
        .select('*')
        .gte('data', inicio)
        .lte('data', fim)
        .eq('finalizado', true);

      if (representanteId !== 'todos') {
        query = query.eq('representante_id', representanteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CobrancaDiaria[];
    },
  });

  // Processar dados para gráfico de evolução semanal
  const dadosEvolucaoSemanal = useMemo(() => {
    if (!dadosSemanais.length) return [];

    const hoje = new Date();
    const inicioIntervalo = subWeeks(hoje, 7);
    const semanas = eachWeekOfInterval(
      { start: inicioIntervalo, end: hoje },
      { weekStartsOn: 1 }
    );

    return semanas.map((inicioSemana) => {
      const fimSemana = endOfWeek(inicioSemana, { weekStartsOn: 1 });
      const inicioStr = format(inicioSemana, 'yyyy-MM-dd');
      const fimStr = format(fimSemana, 'yyyy-MM-dd');

      const cobrancasSemana = dadosSemanais.filter((c) => {
        return c.data >= inicioStr && c.data <= fimStr;
      });

      const totalCobrado = cobrancasSemana.reduce((sum, c) => sum + c.total_cobrado, 0);
      const totalPix = cobrancasSemana.reduce((sum, c) => sum + (c.total_pix || 0), 0);
      const totalDinheiro = cobrancasSemana.reduce((sum, c) => sum + (c.total_dinheiro || 0), 0);
      const totalCartao = cobrancasSemana.reduce((sum, c) => sum + (c.total_cartao || 0), 0);
      const totalDespesas = cobrancasSemana.reduce((sum, c) => sum + (c.despesa_cobranca || 0), 0);

      return {
        semana: format(inicioSemana, "dd/MM", { locale: ptBR }),
        periodo: `${format(inicioSemana, "dd/MM")} - ${format(fimSemana, "dd/MM")}`,
        totalCobrado,
        totalPix,
        totalDinheiro,
        totalCartao,
        totalDespesas,
        liquido: totalCobrado - totalDespesas,
        diasTrabalhados: cobrancasSemana.length,
      };
    });
  }, [dadosSemanais]);

  // Dados para gráfico de pizza (formas de pagamento)
  const dadosPizza = useMemo(() => {
    if (!dadosRelatorio?.cobrancas?.length) return [];

    const totalPix = dadosRelatorio.cobrancas.reduce((sum, c) => sum + (c.total_pix || 0), 0);
    const totalDinheiro = dadosRelatorio.cobrancas.reduce((sum, c) => sum + (c.total_dinheiro || 0), 0);
    const totalCartao = dadosRelatorio.cobrancas.reduce((sum, c) => sum + (c.total_cartao || 0), 0);

    return [
      { name: 'PIX', value: totalPix, color: '#8b5cf6' },
      { name: 'Dinheiro', value: totalDinheiro, color: '#10b981' },
      { name: 'Cartão', value: totalCartao, color: '#f59e0b' },
    ].filter(item => item.value > 0);
  }, [dadosRelatorio]);

  // Dados para gráfico de barras por representante
  const dadosPorRepresentante = useMemo(() => {
    if (!dadosRelatorio?.cobrancas?.length || representanteId !== 'todos') return [];

    const agrupado = dadosRelatorio.cobrancas.reduce((acc, c) => {
      if (!acc[c.representante_id]) {
        acc[c.representante_id] = {
          totalCobrado: 0,
          totalDespesas: 0,
        };
      }
      acc[c.representante_id].totalCobrado += c.total_cobrado;
      acc[c.representante_id].totalDespesas += c.despesa_cobranca || 0;
      return acc;
    }, {} as Record<string, { totalCobrado: number; totalDespesas: number }>);

    return Object.entries(agrupado).map(([repId, dados]) => ({
      nome: representantes.find(r => r.id === repId)?.nome?.split(' ')[0] || 'Desconhecido',
      totalCobrado: dados.totalCobrado,
      liquido: dados.totalCobrado - dados.totalDespesas,
    })).sort((a, b) => b.totalCobrado - a.totalCobrado);
  }, [dadosRelatorio, representantes, representanteId]);

  const gerarRelatorioPDF = () => {
    if (!dadosRelatorio) return;

    const { cobrancas = [], notas = [], kits = [] } = dadosRelatorio;

    const totalCobrado = cobrancas.reduce((sum, c) => sum + c.total_cobrado, 0);
    const totalDespesas = cobrancas.reduce((sum, c) => sum + (c.despesa_cobranca || 0), 0);
    const totalNotas = notas.reduce((sum, n) => sum + n.valor_total, 0);
    const totalKits = kits.length;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório - ${format(new Date(mesAno + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #1a1a1a; text-align: center; }
          h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          .header { text-align: center; margin-bottom: 30px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
          .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
          .card h3 { margin: 0; color: #666; font-size: 14px; }
          .card p { margin: 10px 0 0; font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TALIARE SEMIJOIAS</h1>
          <h2>Relatório Financeiro - ${format(new Date(mesAno + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}</h2>
          ${representanteId !== 'todos' ? `<p><strong>Representante:</strong> ${escapeHtml(representantes.find(r => r.id === representanteId)?.nome)}</p>` : ''}
        </div>

        <div class="summary">
          <div class="card">
            <h3>Total Cobrado</h3>
            <p>${formatarValor(totalCobrado)}</p>
          </div>
          <div class="card">
            <h3>Total Despesas</h3>
            <p>${formatarValor(totalDespesas)}</p>
          </div>
          <div class="card">
            <h3>Saldo Líquido</h3>
            <p>${formatarValor(totalCobrado - totalDespesas)}</p>
          </div>
          <div class="card">
            <h3>Kits Entregues</h3>
            <p>${formatarNumero(totalKits)}</p>
          </div>
        </div>

        <h2>Cobranças Diárias</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Total Cobrado</th>
              <th>PIX</th>
              <th>Dinheiro</th>
              <th>Cartão</th>
              <th>Despesas</th>
            </tr>
          </thead>
          <tbody>
            ${cobrancas.map(c => `
              <tr>
                <td>${format(new Date(c.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                <td>${formatarValor(c.total_cobrado)}</td>
                <td>${formatarValor(c.total_pix || 0)}</td>
                <td>${formatarValor(c.total_dinheiro || 0)}</td>
                <td>${formatarValor(c.total_cartao || 0)}</td>
                <td>${formatarValor(c.despesa_cobranca || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Notas Promissórias</h2>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${notas.map(n => `
              <tr>
                <td>${escapeHtml(n.codigo_nota)}</td>
                <td>${format(new Date(n.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                <td>${formatarValor(n.valor_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const totalCobrado = dadosRelatorio?.cobrancas?.reduce((sum, c) => sum + c.total_cobrado, 0) || 0;
  const totalDespesas = dadosRelatorio?.cobrancas?.reduce((sum, c) => sum + (c.despesa_cobranca || 0), 0) || 0;
  const totalNotas = dadosRelatorio?.notas?.length || 0;
  const totalKits = dadosRelatorio?.kits?.length || 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatarValor(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">Análise detalhada com gráficos de evolução</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodo">Período (Mês/Ano)</Label>
              <Input
                id="periodo"
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representante">Representante</Label>
              <Select value={representanteId} onValueChange={setRepresentanteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Representantes</SelectItem>
                  {representantes.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalCobrado)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarValor(totalDespesas)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalNotas)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kits</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarNumero(totalKits)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com gráficos */}
      <Tabs defaultValue="evolucao" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="evolucao" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Evolução</span>
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Comparativo</span>
          </TabsTrigger>
          <TabsTrigger value="exportar" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </TabsTrigger>
        </TabsList>

        {/* Gráfico de Evolução Semanal */}
        <TabsContent value="evolucao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução Semanal (Últimas 8 semanas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dadosEvolucaoSemanal.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={dadosEvolucaoSemanal}>
                    <defs>
                      <linearGradient id="colorCobrado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="semana" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="totalCobrado"
                      name="Total Cobrado"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorCobrado)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="liquido"
                      name="Líquido"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorLiquido)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  Nenhum dado disponível para o período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Formas de Pagamento por Semana */}
          <Card>
            <CardHeader>
              <CardTitle>Formas de Pagamento por Semana</CardTitle>
            </CardHeader>
            <CardContent>
              {dadosEvolucaoSemanal.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosEvolucaoSemanal}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="semana" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="totalPix" name="PIX" fill="#8b5cf6" stackId="a" />
                    <Bar dataKey="totalDinheiro" name="Dinheiro" fill="#10b981" stackId="a" />
                    <Bar dataKey="totalCartao" name="Cartão" fill="#f59e0b" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráfico de Pizza - Formas de Pagamento */}
        <TabsContent value="pagamentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuição por Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dadosPizza.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={dadosPizza}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {dadosPizza.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatarValor(value)}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  <div className="flex flex-col justify-center space-y-4">
                    {dadosPizza.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold">{formatarValor(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráfico Comparativo por Representante */}
        <TabsContent value="comparativo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparativo por Representante
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dadosPorRepresentante.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={dadosPorRepresentante} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <YAxis 
                      type="category"
                      dataKey="nome"
                      width={80}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="totalCobrado" name="Total Cobrado" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="liquido" name="Líquido" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  {representanteId !== 'todos' 
                    ? 'Selecione "Todos os Representantes" para ver o comparativo'
                    : 'Nenhum dado disponível para o período'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exportar PDF */}
        <TabsContent value="exportar">
          <Card>
            <CardHeader>
              <CardTitle>Gerar Relatório em PDF</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
              <FileText className="h-16 w-16 text-primary" />
              <p className="text-lg text-center">
                Clique no botão abaixo para gerar o relatório detalhado do período selecionado
              </p>
              <Button size="lg" onClick={gerarRelatorioPDF} disabled={!dadosRelatorio}>
                <Download className="h-4 w-4 mr-2" />
                Gerar e Imprimir PDF
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
