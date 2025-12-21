import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, X, Filter } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDateString } from '@/lib/utils';

interface DateRangeFilterPopoverProps {
  onFilterChange: (startDate: string, endDate: string) => void;
  className?: string;
}

export function DateRangeFilterPopover({ onFilterChange, className }: DateRangeFilterPopoverProps) {
  const defaultStart = getLocalDateString(startOfMonth(new Date()));
  const defaultEnd = getLocalDateString(endOfMonth(new Date()));
  
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [appliedStart, setAppliedStart] = useState(defaultStart);
  const [appliedEnd, setAppliedEnd] = useState(defaultEnd);
  const [isOpen, setIsOpen] = useState(false);

  const isFiltered = appliedStart !== defaultStart || appliedEnd !== defaultEnd;

  const handleApply = () => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    onFilterChange(startDate, endDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setAppliedStart(defaultStart);
    setAppliedEnd(defaultEnd);
    onFilterChange(defaultStart, defaultEnd);
    setIsOpen(false);
  };

  const formatDateRange = () => {
    const start = new Date(appliedStart + 'T12:00:00');
    const end = new Date(appliedEnd + 'T12:00:00');
    return `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM', { locale: ptBR })}`;
  };

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant={isFiltered ? "default" : "outline"} 
            size="sm" 
            className="gap-2 h-9"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtrar período</span>
            <span className="sm:hidden">Período</span>
            {isFiltered && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-normal">
                {formatDateRange()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-4" 
          align="start"
          sideOffset={8}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Período</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleApply} 
                size="sm" 
                className="flex-1 h-9"
              >
                Aplicar
              </Button>
              <Button 
                onClick={handleClear} 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-9"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
