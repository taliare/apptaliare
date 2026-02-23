import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Calendar, User, MessageCircle, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadRevendedora } from "./types";

interface LeadCardProps {
  lead: LeadRevendedora;
  onClick: () => void;
  isDragging?: boolean;
}

export function LeadCard({ lead, onClick, isDragging: isDraggingProp }: LeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [wasDragging, setWasDragging] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingLocal,
  } = useDraggable({ id: lead.id });

  const isDragging = isDraggingProp ?? isDraggingLocal;

  // Track drag state to prevent onClick after drag
  const prevDragging = React.useRef(false);
  React.useEffect(() => {
    if (prevDragging.current && !isDragging) {
      setWasDragging(true);
      const timer = setTimeout(() => setWasDragging(false), 100);
      return () => clearTimeout(timer);
    }
    prevDragging.current = isDragging;
  }, [isDragging]);

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const formatarWhatsapp = (whatsapp: string) => whatsapp.replace(/\D/g, "");

  const hasDetails = lead.cidade || lead.origem || lead.responsavel_nome;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing touch-none hover:bg-accent/10 transition-colors ${isDragging ? "shadow-lg" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!wasDragging) onClick();
      }}
    >
      <CardContent className="p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate flex-1">{lead.nome}</p>
          {hasDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`, '_blank');
          }}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          WhatsApp
        </Button>

        {expanded && (
          <div className="space-y-1 text-xs text-muted-foreground pt-0.5">
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
        )}
      </CardContent>
    </Card>
  );
}
