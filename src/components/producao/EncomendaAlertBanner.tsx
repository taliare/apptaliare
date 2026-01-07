import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Bell, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EncomendaPendente {
  id: string;
  tipo_kit: string;
  descricao_pedido: string;
  criado_em: string;
  representante_id: string;
  profile?: { nome: string } | null;
}

export function EncomendaAlertBanner() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data: encomendas = [] } = useQuery({
    queryKey: ['encomendas-pendentes-alerta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('encomendas_kits')
        .select('id, tipo_kit, descricao_pedido, criado_em, representante_id')
        .eq('status', 'solicitado')
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Buscar nomes dos representantes
      if (data && data.length > 0) {
        const representanteIds = [...new Set(data.map(e => e.representante_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', representanteIds);

        return data.map(encomenda => ({
          ...encomenda,
          profile: profiles?.find(p => p.id === encomenda.representante_id) || null,
        })) as EncomendaPendente[];
      }

      return data as EncomendaPendente[];
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Mostrar modal automaticamente quando há encomendas pendentes
  useEffect(() => {
    if (encomendas.length > 0 && !dismissed) {
      setShowModal(true);
    }
  }, [encomendas.length, dismissed]);

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      inicial: 'Inicial',
      especial: 'Especial',
      maleta: 'Maleta',
      misto: 'Misto',
    };
    return tipos[tipo] || tipo;
  };

  const handleNavigate = () => {
    setShowModal(false);
    navigate('/encomendas-producao');
  };

  if (encomendas.length === 0) return null;

  return (
    <>
      {/* Banner fixo no topo */}
      {!dismissed && (
        <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-3 md:p-4 mb-4 animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-full animate-bounce">
                <Bell className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
              </div>
              <div>
                <p className="font-bold text-destructive text-sm md:text-base">
                  {encomendas.length === 1
                    ? 'NOVA ENCOMENDA PENDENTE!'
                    : `${encomendas.length} NOVAS ENCOMENDAS PENDENTES!`}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Clique para ver os detalhes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowModal(true)}
                className="hidden sm:flex"
              >
                Ver Encomendas
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal com detalhes */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atenção! Encomendas Pendentes
            </DialogTitle>
            <DialogDescription>
              Você tem {encomendas.length} encomenda(s) aguardando produção.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto space-y-3">
            {encomendas.map((encomenda) => (
              <div
                key={encomenda.id}
                className="p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline">{getTipoLabel(encomenda.tipo_kit)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(encomenda.criado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {encomenda.descricao_pedido}
                </p>
                {encomenda.profile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Solicitado por: <span className="font-medium">{encomenda.profile.nome}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Fechar
            </Button>
            <Button onClick={handleNavigate}>
              Ver Todas as Encomendas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
