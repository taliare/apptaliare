import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase-external';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';

interface KitData {
  codigo: string;
  valor: string;
}

export default function ProducaoDiaria() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [quantities, setQuantities] = useState({
    inicial: 0,
    especial: 0,
    maleta: 0,
  });
  const [kits, setKits] = useState<{
    inicial: KitData[];
    especial: KitData[];
    maleta: KitData[];
  }>({
    inicial: [],
    especial: [],
    maleta: [],
  });
  const [loading, setLoading] = useState(false);

  const handleConfirmQuantities = () => {
    setKits({
      inicial: Array(quantities.inicial).fill(null).map(() => ({ codigo: '', valor: '' })),
      especial: Array(quantities.especial).fill(null).map(() => ({ codigo: '', valor: '' })),
      maleta: Array(quantities.maleta).fill(null).map(() => ({ codigo: '', valor: '' })),
    });
    setStep(2);
  };

  const handleKitChange = (tipo: 'inicial' | 'especial' | 'maleta', index: number, field: 'codigo' | 'valor', value: string) => {
    setKits(prev => ({
      ...prev,
      [tipo]: prev[tipo].map((kit, i) => 
        i === index ? { ...kit, [field]: value } : kit
      ),
    }));
  };

  const formatarValorInput = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    const numero = parseFloat(apenasNumeros) / 100;
    return numero.toFixed(2);
  };

  const handleRegister = async () => {
    if (!user) return;

    const allKits = [...kits.inicial, ...kits.especial, ...kits.maleta];
    if (allKits.some(k => !k.codigo.trim() || !k.valor.trim())) {
      toast.error('Preencha todos os códigos e valores');
      return;
    }

    setLoading(true);
    try {
      const today = getLocalDateString();
      
      // Registrar produção com valor
      const producaoData = [
        ...kits.inicial.map(kit => ({ 
          data: today, 
          tipo: 'inicial', 
          codigo: kit.codigo, 
          valor: parseFloat(kit.valor.replace(',', '.')),
          criado_por: user.id 
        })),
        ...kits.especial.map(kit => ({ 
          data: today, 
          tipo: 'especial', 
          codigo: kit.codigo, 
          valor: parseFloat(kit.valor.replace(',', '.')),
          criado_por: user.id 
        })),
        ...kits.maleta.map(kit => ({ 
          data: today, 
          tipo: 'maleta', 
          codigo: kit.codigo, 
          valor: parseFloat(kit.valor.replace(',', '.')),
          criado_por: user.id 
        })),
      ];

      const { data: producao, error: prodError } = await supabase
        .from('producao_diaria')
        .insert(producaoData)
        .select();

      if (prodError) throw prodError;

      // Adicionar ao estoque com valor
      const estoqueData = producao.map(p => ({
        tipo: p.tipo,
        codigo: p.codigo,
        valor: p.valor,
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
      setKits({ inicial: [], especial: [], maleta: [] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderKitInputs = (tipo: 'inicial' | 'especial' | 'maleta', label: string) => {
    if (kits[tipo].length === 0) return null;
    
    return (
      <div>
        <h3 className="font-semibold mb-2">{label} ({kits[tipo].length})</h3>
        <div className="space-y-3">
          {kits[tipo].map((kit, idx) => (
            <div key={`${tipo}-${idx}`} className="grid grid-cols-2 gap-2">
              <Input
                placeholder={`Código ${idx + 1}`}
                value={kit.codigo}
                onChange={(e) => handleKitChange(tipo, idx, 'codigo', e.target.value)}
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  placeholder="Valor"
                  className="pl-10"
                  value={kit.valor}
                  onChange={(e) => handleKitChange(tipo, idx, 'valor', formatarValorInput(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
            {step === 1 ? 'Passo 1: Quantidades' : 'Passo 2: Códigos e Valores dos Kits'}
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
              {renderKitInputs('inicial', 'Kits Iniciais')}
              {renderKitInputs('especial', 'Kits Especiais')}
              {renderKitInputs('maleta', 'Maletas')}
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