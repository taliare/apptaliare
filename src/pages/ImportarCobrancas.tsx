import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export default function ImportarCobrancas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Cobranças</h1>
        <p className="text-muted-foreground">Importe cobranças agendadas via planilha Excel</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Planilha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <Upload className="h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">Importação em desenvolvimento</p>
            <p className="text-sm text-muted-foreground">Em breve você poderá importar planilhas Excel</p>
            <Button disabled>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
