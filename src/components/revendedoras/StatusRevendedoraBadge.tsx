import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RevendedoraStatusInfo } from '@/lib/revendedoraStatus';

interface Props {
  status: RevendedoraStatusInfo;
  className?: string;
}

export function StatusRevendedoraBadge({ status, className }: Props) {
  return (
    <Badge className={cn(status.className, 'gap-1 font-medium', className)}>
      <span>{status.emoji}</span>
      {status.label}
    </Badge>
  );
}
