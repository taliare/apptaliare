import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';
import { 
  Package, 
  RefreshCw, 
  Calendar, 
  CreditCard, 
  Gift, 
  Check,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialCobrancaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Sistema de Cobranças',
    icon: Gift,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'types',
    title: 'Tipos de Cobrança',
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'filters',
    title: 'Encontrar Cobranças',
    icon: Calendar,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    id: 'kit',
    title: 'Registrar Cobrança KIT',
    icon: Package,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  {
    id: 'repasse',
    title: 'Registrar REPASSE',
    icon: RefreshCw,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    id: 'special',
    title: 'Situações Especiais',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
];

export function TutorialCobranca({ open, onOpenChange }: TutorialCobrancaProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentStep, setCurrentStep] = useState(0);

  const handleFinish = () => {
    localStorage.setItem('tutorial_cobranca_visto', 'true');
    onOpenChange(false);
    setCurrentStep(0);
    api?.scrollTo(0);
  };

  const handleNext = () => {
    api?.scrollNext();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            Guia Rápido de Cobranças
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicators */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === currentStep 
                  ? "w-6 bg-primary" 
                  : index < currentStep 
                    ? "w-1.5 bg-primary/50" 
                    : "w-1.5 bg-muted"
              )}
            />
          ))}
        </div>

        <Carousel
          setApi={setApi}
          opts={{ watchDrag: false }}
          className="w-full"
        >
          <CarouselContent>
            {/* Step 1: Welcome */}
            <CarouselItem>
              <div className="flex flex-col items-center text-center p-4 space-y-4">
                <div className={cn("p-4 rounded-full", steps[0].bgColor)}>
                  <Gift className={cn("h-12 w-12", steps[0].color)} />
                </div>
                <h3 className="text-xl font-semibold">Bem-vindo!</h3>
                <p className="text-muted-foreground">
                  Este guia vai te ensinar como registrar cobranças de forma rápida e eficiente.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-left w-full">
                  <p className="font-medium mb-2">O que você vai aprender:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Diferença entre KIT e REPASSE
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Como usar os filtros
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Registrar pagamentos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Situações especiais
                    </li>
                  </ul>
                </div>
              </div>
            </CarouselItem>

            {/* Step 2: Types */}
            <CarouselItem>
              <div className="flex flex-col p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", steps[1].bgColor)}>
                    <Package className={cn("h-6 w-6", steps[1].color)} />
                  </div>
                  <h3 className="text-lg font-semibold">Tipos de Cobrança</h3>
                </div>

                <div className="grid gap-3">
                  <div className="border rounded-lg p-4 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-5 w-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-700">KIT</span>
                    </div>
                    <ul className="text-sm space-y-1 text-emerald-800">
                      <li>• Primeira cobrança da revendedora</li>
                      <li>• <strong>Você precisa informar o VALOR DA VENDA</strong></li>
                      <li>• O sistema calcula a comissão automaticamente</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold text-orange-700">REPASSE</span>
                    </div>
                    <ul className="text-sm space-y-1 text-orange-800">
                      <li>• Saldo restante de cobrança anterior</li>
                      <li>• O valor já vem preenchido</li>
                      <li>• Só precisa selecionar forma de pagamento</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Step 3: Filters */}
            <CarouselItem>
              <div className="flex flex-col p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", steps[2].bgColor)}>
                    <Calendar className={cn("h-6 w-6", steps[2].color)} />
                  </div>
                  <h3 className="text-lg font-semibold">Encontrar Cobranças</h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  Use os filtros para encontrar suas cobranças:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <span className="text-destructive font-medium">🔴 Vencidas</span>
                    <span className="text-sm text-destructive">Cobranças que passaram da data (ATENÇÃO!)</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-primary font-medium">📅 Hoje</span>
                    <span className="text-sm">Cobranças agendadas para hoje</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                    <span className="font-medium">📆 Semana X</span>
                    <span className="text-sm text-muted-foreground">Cobranças da semana atual</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                    <span className="font-medium">📋 Todas</span>
                    <span className="text-sm text-muted-foreground">Ver tudo</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="text-amber-800">
                    💡 <strong>Dica:</strong> O botão "Vencidas" pisca quando há cobranças atrasadas!
                  </p>
                </div>
              </div>
            </CarouselItem>

            {/* Step 4: Register KIT */}
            <CarouselItem>
              <div className="flex flex-col p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", steps[3].bgColor)}>
                    <Package className={cn("h-6 w-6", steps[3].color)} />
                  </div>
                  <h3 className="text-lg font-semibold">Registrar Cobrança KIT</h3>
                </div>

                <ol className="space-y-3">
                  {[
                    'Encontre a cobrança na lista',
                    'Clique no botão "Receber"',
                    'Digite o VALOR DA VENDA (campo obrigatório)',
                    'Selecione a forma de pagamento (Pix, Dinheiro, etc)',
                    'Clique em "Receber"'
                  ].map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <p className="text-emerald-800">
                    💡 <strong>Dica:</strong> A comissão é calculada automaticamente com base no valor da venda!
                  </p>
                </div>
              </div>
            </CarouselItem>

            {/* Step 5: Register REPASSE */}
            <CarouselItem>
              <div className="flex flex-col p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", steps[4].bgColor)}>
                    <RefreshCw className={cn("h-6 w-6", steps[4].color)} />
                  </div>
                  <h3 className="text-lg font-semibold">Registrar REPASSE</h3>
                </div>

                <ol className="space-y-3">
                  {[
                    'Encontre a cobrança (aparece com badge REPASSE)',
                    'Clique no botão "Receber"',
                    'O valor já vem preenchido',
                    'Selecione a forma de pagamento',
                    'Clique em "Receber"'
                  ].map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <p className="text-orange-800">
                    💡 <strong>Nota:</strong> Repasses são mais simples pois o valor já está definido!
                  </p>
                </div>
              </div>
            </CarouselItem>

            {/* Step 6: Special Situations */}
            <CarouselItem>
              <div className="flex flex-col p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", steps[5].bgColor)}>
                    <AlertTriangle className={cn("h-6 w-6", steps[5].color)} />
                  </div>
                  <h3 className="text-lg font-semibold">Situações Especiais</h3>
                </div>

                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm">Desconto</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clique em "Aplicar desconto" se precisar dar desconto à revendedora
                    </p>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-sm">Pagamento Parcial</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clique em "Receber parcial", digite o valor e selecione a data da próxima cobrança
                    </p>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-sm">Devolução Total</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se a revendedora devolveu tudo, clique em "Devolveu Tudo"
                    </p>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-center">
                  <p className="text-primary font-medium">
                    🎉 Pronto! Agora você sabe registrar cobranças!
                  </p>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4 px-2">
            <CarouselPrevious 
              className="static translate-x-0 translate-y-0"
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            />
            
            {currentStep === steps.length - 1 ? (
              <Button onClick={handleFinish} className="gap-2">
                <Check className="h-4 w-4" />
                Entendi!
              </Button>
            ) : (
              <Button 
                variant="default" 
                onClick={() => {
                  handleNext();
                  setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
                }}
                className="gap-2"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            <CarouselNext 
              className="static translate-x-0 translate-y-0"
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
            />
          </div>
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
