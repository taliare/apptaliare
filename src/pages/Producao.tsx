import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function Producao() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Produção</h1>
        <p className="text-muted-foreground">Gestão de produção e distribuição</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Área da Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Funcionalidades em Desenvolvimento
              </h3>
              <p className="text-muted-foreground max-w-md">
                O módulo de produção está sendo desenvolvido e em breve estará disponível com 
                funcionalidades para gestão de encomendas, controle de estoque e distribuição de kits.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
