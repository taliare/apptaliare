import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Calendar, User, MessageCircle, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadRevendedora } from "./types";

interface LeadCardProps {
  lead: LeadRevendedora;
  onClick: () => void;
  isDragging?: boolean;
}

export function LeadCard({ lead, onClick, isDragging: isDraggingProp }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingLocal,
  } = useDraggable({ id: lead.id });

  // Use prop quando fornecida (para DragOverlay), senão use estado local
  const isDragging = isDraggingProp ?? isDraggingLocal;

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const formatarWhatsapp = (whatsapp: string) => {
    return whatsapp.replace(/\D/g, "");
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:bg-accent/10 transition-colors ${isDragging ? "shadow-lg" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm truncate flex-1">{lead.nome}</p>
        </div>
        
        <Button
          size="sm"
          variant="outline"
          className="w-full bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`, '_blank');
          }}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          WhatsApp
        </Button>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          {lead.cidade && (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {lead.cidade}
            </p>
          )}

          {lead.origem && (
            <p className="flex items-center gap-1 text-muted-foreground/70">
              {lead.origem}
            </p>
          )}
          
          <p className="flex items-center gap-1 text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            {format(parseISO(lead.created_at), "dd/MM/yy", { locale: ptBR })}
          </p>

          {lead.responsavel_nome && (
            <p className="flex items-center gap-1 text-primary/70">
              <User className="h-3 w-3" />
              {lead.responsavel_nome}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
