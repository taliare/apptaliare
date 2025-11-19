import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';

export default function CobrancaDiaria() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cobrança Diária</h1>
        <p className="text-muted-foreground">Registre suas notas promissórias e finalize o dia</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Notas Promissórias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <CalendarCheck className="h-16 w-16 mb-4" />
            <p className="text-lg">Sistema de cobrança diária em desenvolvimento</p>
            <p className="text-sm">Em breve você poderá registrar notas promissórias</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
