import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MapPin, Calendar, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LeadRevendedora } from "./types";

interface LeadCardProps {
  lead: LeadRevendedora;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatarWhatsapp = (whatsapp: string) => {
    return whatsapp.replace(/\D/g, "");
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing hover:bg-accent/10 transition-colors touch-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <CardContent className="p-3 space-y-2">
        <p className="font-medium text-sm truncate">{lead.nome}</p>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          <a
            href={`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-green-500 hover:underline"
          >
            <Phone className="h-3 w-3" />
            {lead.whatsapp}
          </a>
          
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
