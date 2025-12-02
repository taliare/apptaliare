import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface DateRangeFilterProps {
  onFilterChange: (startDate: string, endDate: string) => void;
}

export function DateRangeFilter({ onFilterChange }: DateRangeFilterProps) {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const handleApply = () => {
    onFilterChange(startDate, endDate);
  };

  const handleClear = () => {
    const newStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const newEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    setStartDate(newStart);
    setEndDate(newEnd);
    onFilterChange(newStart, newEnd);
  };

  return (
    <Card className="p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
        <div className="grid grid-cols-2 gap-2 md:contents">
          <div className="md:flex-1 md:min-w-[200px]">
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Data Inicial</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm"
            />
          </div>
          <div className="md:flex-1 md:min-w-[200px]">
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Data Final</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApply} className="gap-2 flex-1 md:flex-none text-sm">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Aplicar Filtro</span>
            <span className="sm:hidden">Filtrar</span>
          </Button>
          <Button onClick={handleClear} variant="outline" className="gap-2 text-sm">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Limpar</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}