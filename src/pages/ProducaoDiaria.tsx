import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function ProducaoDiaria() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [quantities, setQuantities] = useState({
    inicial: 0,
    especial: 0,
    maleta: 0,
  });
  const [codes, setCodes] = useState<{
    inicial: string[];
    especial: string[];
    maleta: string[];
  }>({
    inicial: [],
    especial: [],
    maleta: [],
  });
  const [loading, setLoading] = useState(false);

  const handleConfirmQuantities = () => {
    setCodes({
      inicial: Array(quantities.inicial).fill(''),
      especial: Array(quantities.especial).fill(''),
      maleta: Array(quantities.maleta).fill(''),
    });
    setStep(2);
  };

  const handleCodeChange = (tipo: 'inicial' | 'especial' | 'maleta', index: number, value: string) => {
    setCodes(prev => ({
      ...prev,
      [tipo]: prev[tipo].map((c, i) => i === index ? value : c),
    }));
  };

  const handleRegister = async () => {
    if (!user) return;

    const allCodes = [...codes.inicial, ...codes.especial, ...codes.maleta];
    if (allCodes.some(c => !c.trim())) {
      toast.error('Preencha todos os códigos');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Registrar produção
      const producaoData = [
        ...codes.inicial.map(codigo => ({ data: today, tipo: 'inicial', codigo, criado_por: user.id })),
        ...codes.especial.map(codigo => ({ data: today, tipo: 'especial', codigo, criado_por: user.id })),
        ...codes.maleta.map(codigo => ({ data: today, tipo: 'maleta', codigo, criado_por: user.id })),
      ];

      const { data: producao, error: prodError } = await supabase
        .from('producao_diaria')
        .insert(producaoData)
        .select();

      if (prodError) throw prodError;

      // Adicionar ao estoque
      const estoqueData = producao.map(p => ({
        tipo: p.tipo,
        codigo: p.codigo,
        status: 'estoque',
        representante_id: null,
        origem_producao_id: p.id,
      }));

      const { error: estError } = await supabase
        .from('kits_estoque')
        .insert(estoqueData);

      if (estError) throw estError;

      toast.success('Produção registrada com sucesso!');
      setStep(1);
      setQuantities({ inicial: 0, especial: 0, maleta: 0 });
      setCodes({ inicial: [], especial: [], maleta: [] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Produção Diária</h1>
        <p className="text-muted-foreground">Registre a produção de kits do dia</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === 1 ? 'Passo 1: Quantidades' : 'Passo 2: Códigos dos Kits'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="inicial">Quantos kits iniciais?</Label>
                <Input
                  id="inicial"
                  type="number"
                  min="0"
                  value={quantities.inicial}
                  onChange={(e) => setQuantities(prev => ({ ...prev, inicial: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="especial">Quantos kits especiais?</Label>
                <Input
                  id="especial"
                  type="number"
                  min="0"
                  value={quantities.especial}
                  onChange={(e) => setQuantities(prev => ({ ...prev, especial: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="maleta">Quantas maletas?</Label>
                <Input
                  id="maleta"
                  type="number"
                  min="0"
                  value={quantities.maleta}
                  onChange={(e) => setQuantities(prev => ({ ...prev, maleta: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <Button
                onClick={handleConfirmQuantities}
                disabled={quantities.inicial + quantities.especial + quantities.maleta === 0}
                className="w-full"
              >
                Confirmar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {codes.inicial.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Kits Iniciais ({codes.inicial.length})</h3>
                  <div className="space-y-2">
                    {codes.inicial.map((code, idx) => (
                      <Input
                        key={`inicial-${idx}`}
                        placeholder={`Código ${idx + 1}`}
                        value={code}
                        onChange={(e) => handleCodeChange('inicial', idx, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {codes.especial.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Kits Especiais ({codes.especial.length})</h3>
                  <div className="space-y-2">
                    {codes.especial.map((code, idx) => (
                      <Input
                        key={`especial-${idx}`}
                        placeholder={`Código ${idx + 1}`}
                        value={code}
                        onChange={(e) => handleCodeChange('especial', idx, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {codes.maleta.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Maletas ({codes.maleta.length})</h3>
                  <div className="space-y-2">
                    {codes.maleta.map((code, idx) => (
                      <Input
                        key={`maleta-${idx}`}
                        placeholder={`Código ${idx + 1}`}
                        value={code}
                        onChange={(e) => handleCodeChange('maleta', idx, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleRegister} disabled={loading} className="flex-1">
                  {loading ? 'Registrando...' : 'Registrar Produção'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}