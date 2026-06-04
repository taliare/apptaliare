import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  url: string | null;
  nome: string;
  onClose: () => void;
}

export function FotoLightbox({ open, url, nome, onClose }: Props) {
  if (!url) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl p-2 bg-black/95 border-white/10">
        <img
          src={url}
          alt={nome}
          className="w-full h-auto max-h-[85vh] object-contain rounded"
        />
      </DialogContent>
    </Dialog>
  );
}
