import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useFotoUrl } from '@/hooks/useFotoUrl';

interface Props {
  currentPath: string | null;
  onPick: (file: Blob | null) => void;
  pickedPreviewUrl: string | null;
}

/** Avatar grande com botões para upload ou captura via câmera. */
export function FotoCapture({ currentPath, onPick, pickedPreviewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const signedUrl = useFotoUrl(currentPath);

  const displayUrl = pickedPreviewUrl || signedUrl;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch {
      toast.error('Não foi possível acessar a câmera');
    }
  };

  const snapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onPick(blob);
        stopCamera();
      },
      'image/webp',
      0.85
    );
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32 rounded-full overflow-hidden bg-muted border-2 border-primary/30 shadow-lg">
        {cameraOn ? (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        ) : displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="Foto" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Camera className="w-10 h-10" />
          </div>
        )}
      </div>

      {cameraOn ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={snapshot} className="gap-1">
            <Check className="w-4 h-4" />
            Capturar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={stopCamera} className="gap-1">
            <X className="w-4 h-4" />
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="gap-1">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={openCamera} className="gap-1">
            <Camera className="w-4 h-4" />
            Câmera
          </Button>
          {pickedPreviewUrl && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onPick(null)} className="gap-1">
              <RotateCcw className="w-4 h-4" />
              Reverter
            </Button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
