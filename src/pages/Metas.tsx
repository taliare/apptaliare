import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

export default function Metas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Metas</h1>
        <p className="text-muted-foreground">Defina metas mensais para os representantes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metas por Representante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Target className="h-16 w-16 mb-4" />
            <p className="text-lg">Gestão de metas em desenvolvimento</p>
            <p className="text-sm">Em breve você poderá definir e acompanhar metas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
