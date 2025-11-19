import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';

export default function Relatorios() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">Gere relatórios detalhados em PDF</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exportar Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">Geração de relatórios em desenvolvimento</p>
            <p className="text-sm text-muted-foreground">Em breve você poderá exportar relatórios em PDF</p>
            <Button disabled>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
