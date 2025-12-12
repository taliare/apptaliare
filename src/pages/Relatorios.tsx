import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarValor, formatarNumero } from '@/lib/utils';

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

  // Query para dados do período
  const { data: dadosRelatorio } = useQuery({
    queryKey: ['relatorio', mesAno, representanteId],
    queryFn: async () => {
      const inicio = format(startOfMonth(new Date(mesAno + '-01')), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date(mesAno + '-01')), 'yyyy-MM-dd');

      // Cobranças diárias
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

      // Notas promissórias
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

      // Kits entregues
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

      return { cobrancas, notas, kits };
    },
  });

  const gerarRelatorioPDF = () => {
    if (!dadosRelatorio) return;

    const { cobrancas = [], notas = [], kits = [] } = dadosRelatorio;

    // Calcula totais
    const totalCobrado = cobrancas.reduce((sum, c) => sum + c.total_cobrado, 0);
    const totalDespesas = cobrancas.reduce((sum, c) => sum + (c.despesa_cobranca || 0), 0);
    const totalNotas = notas.reduce((sum, n) => sum + n.valor_total, 0);
    const totalKits = kits.length;

    // Cria o conteúdo HTML para impressão
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

    // Abre em nova janela para impressão
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">Gere relatórios detalhados em PDF</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Gerar Relatório</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
          <FileText className="h-16 w-16 text-primary" />
          <p className="text-lg text-center">
            Clique no botão abaixo para gerar o relatório do período selecionado
          </p>
          <Button size="lg" onClick={gerarRelatorioPDF} disabled={!dadosRelatorio}>
            <Download className="h-4 w-4 mr-2" />
            Gerar e Imprimir PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
