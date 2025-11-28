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
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Data Inicial</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Data Final</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApply} className="gap-2">
            <Calendar className="h-4 w-4" />
            Aplicar Filtro
          </Button>
          <Button onClick={handleClear} variant="outline" className="gap-2">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </Card>
  );
}