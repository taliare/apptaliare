import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function Cobranca() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Kanban de Cobrança</h1>
        <p className="text-muted-foreground">Gerencie suas cobranças agendadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendário de Cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Calendar className="h-16 w-16 mb-4" />
            <p className="text-lg">Calendário em desenvolvimento</p>
            <p className="text-sm">Em breve você poderá visualizar e gerenciar cobranças aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
