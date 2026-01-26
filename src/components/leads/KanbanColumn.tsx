import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LeadCard } from "./LeadCard";
import { LeadRevendedora, KanbanColumnConfig, COLUMN_COLORS } from "./types";

interface KanbanColumnProps {
  column: KanbanColumnConfig;
  leads: LeadRevendedora[];
  onLeadClick: (lead: LeadRevendedora) => void;
}

export function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const colorClasses = COLUMN_COLORS[column.color] || COLUMN_COLORS.blue;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[280px] rounded-lg border bg-card/50 ${
        isOver ? "ring-2 ring-primary/50" : ""
      }`}
    >
      {/* Header */}
      <div className={`p-3 border-b ${colorClasses} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{column.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-[100px]">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
              />
            ))}
            {leads.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">
                Nenhum lead
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
