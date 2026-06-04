import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { LeadCard } from "./LeadCard";
import { LeadDetailsSheet } from "./LeadDetailsSheet";
import { LeadCountsByStatus, LeadRevendedora, KANBAN_COLUMNS } from "./types";

interface LeadsKanbanProps {
  leads: LeadRevendedora[];
  countsByStatus?: LeadCountsByStatus;
}

export function LeadsKanban({ leads, countsByStatus }: LeadsKanbanProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadRevendedora | null>(null);
  const [zoom, setZoom] = useState(0.8);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  // Group leads by status
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, LeadRevendedora[]> = {};
    KANBAN_COLUMNS.forEach((col) => {
      grouped[col.id] = [];
    });
    leads.forEach((lead) => {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      } else {
        // If status doesn't match any column, put in leads_novos
        grouped["leads_novos"].push(lead);
      }
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const dateA = new Date((a as any).status_updated_at || a.created_at).getTime();
        const dateB = new Date((b as any).status_updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
    });

    return grouped;
  }, [leads]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const moveLeadMutation = useMutation({
    mutationFn: async ({
      leadId,
      oldStatus,
      newStatus,
    }: {
      leadId: string;
      oldStatus: string;
      newStatus: string;
    }) => {
      // Update lead status
      const { error: updateError } = await supabase
        .from("leads_revendedoras")
        .update({ status: newStatus, status_updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (updateError) throw updateError;

      // Insert history record
      const { error: historyError } = await supabase
        .from("leads_status_historico")
        .insert({
          lead_id: leadId,
          status_anterior: oldStatus,
          status_novo: newStatus,
          alterado_por: profile?.id || null,
          alterado_por_nome: profile?.nome || null,
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-revendedoras"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao mover lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Get the column ID from the droppable
    const newStatus = over.id as string;

    // Only update if status changed and is a valid column
    if (lead.status !== newStatus && KANBAN_COLUMNS.some((c) => c.id === newStatus)) {
      moveLeadMutation.mutate({
        leadId,
        oldStatus: lead.status,
        newStatus,
      });
    }
  };

  const handleLeadClick = (lead: LeadRevendedora) => {
    setSelectedLead(lead);
  };

  return (
    <>
      {/* Zoom controls */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.05))}
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Slider
          value={[zoom]}
          onValueChange={([v]) => setZoom(v)}
          min={0.5}
          max={1}
          step={0.05}
          className="w-28"
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setZoom((z) => Math.min(1, z + 0.05))}
          disabled={zoom >= 1}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-medium min-w-[3ch] text-center">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div
            className="flex gap-3 pb-4 min-h-[calc(100vh-200px)] items-stretch"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${100 / zoom}%`,
            }}
          >
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                leads={leadsByStatus[column.id] || []}
                count={countsByStatus?.[column.id]}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeLead && (
            <div className="opacity-90 rotate-2 scale-105">
              <LeadCard lead={activeLead} onClick={() => {}} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadDetailsSheet
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  );
}
