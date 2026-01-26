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
  closestCenter,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./KanbanColumn";
import { LeadCard } from "./LeadCard";
import { LeadDetailsSheet } from "./LeadDetailsSheet";
import { LeadRevendedora, KANBAN_COLUMNS } from "./types";

interface LeadsKanbanProps {
  leads: LeadRevendedora[];
}

export function LeadsKanban({ leads }: LeadsKanbanProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadRevendedora | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
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
        .update({ status: newStatus })
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

    // Only update if status changed
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4 min-h-[calc(100vh-200px)]">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                leads={leadsByStatus[column.id] || []}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeLead && (
            <div className="opacity-90">
              <LeadCard lead={activeLead} onClick={() => {}} />
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
