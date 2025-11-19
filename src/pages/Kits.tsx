import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function Kits() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Kits</h1>
        <p className="text-muted-foreground">Acompanhe renovações e entregas de mostruários</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus Kits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Package className="h-16 w-16 mb-4" />
            <p className="text-lg">Gestão de kits em desenvolvimento</p>
            <p className="text-sm">Em breve você verá todos os kits entregues e vencimentos</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
