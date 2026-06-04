import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { LeadCard } from "./LeadCard";
import { LeadRevendedora, KanbanColumnConfig, COLUMN_COLORS } from "./types";

interface KanbanColumnProps {
  column: KanbanColumnConfig;
  leads: LeadRevendedora[];
  count?: number;
  onLeadClick: (lead: LeadRevendedora) => void;
}

export function KanbanColumn({ column, leads, count, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const colorClasses = COLUMN_COLORS[column.color] || COLUMN_COLORS.blue;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[280px] h-full rounded-lg border bg-card/50 transition-all duration-200 ${
        isOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5" : ""
      }`}
    >
      {/* Header */}
      <div className={`p-3 border-b ${colorClasses} rounded-t-lg flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{column.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {count ?? leads.length}
          </Badge>
        </div>
      </div>

      {/* Cards - área de drop sempre visível */}
      <div className="flex-1 p-2 overflow-y-auto min-h-[300px]">
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
            />
          ))}
          {leads.length === 0 && (
            <div className={`text-center text-xs text-muted-foreground py-12 border-2 border-dashed rounded-lg transition-colors ${
              isOver ? "border-primary bg-primary/5" : "border-muted"
            }`}>
              Arraste um lead aqui
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
