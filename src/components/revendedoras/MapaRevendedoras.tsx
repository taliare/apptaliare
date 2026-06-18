import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default icon paths for Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Profile { id: string; nome: string }

const makeIcon = (color: string) =>
  L.divIcon({
    className: 'revendedora-pin',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -16],
  });

const iconAtiva = makeIcon('#16a34a');
const iconInativa = makeIcon('#dc2626');

interface Props {
  representantes: Profile[];
}

type AtivoFiltro = 'todos' | 'ativas' | 'inativas';

export default function MapaRevendedoras({ representantes }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [ativoFiltro, setAtivoFiltro] = useState<AtivoFiltro>('todos');
  const [atualizando, setAtualizando] = useState(false);

  const { data: revendedoras = [], refetch } = useQuery({
    queryKey: ['revendedoras-mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('id, nome, bairro, cidade, estado, latitude, longitude, representante_id, ativo')
        .not('cidade', 'is', null)
        .not('estado', 'is', null);
      if (error) throw error;
      const repIds = [...new Set((data ?? []).map((r: any) => r.representante_id).filter(Boolean))];
      const { data: profiles } = await profilesLimited().select('id, nome').in('id', repIds);
      const map = new Map(profiles?.map((p: any) => [p.id, p.nome]) || []);
      return (data ?? []).map((r: any) => ({ ...r, representanteNome: r.representante_id ? map.get(r.representante_id) || '' : '' }));
    },
  });

  const filtradas = useMemo(() => {
    return revendedoras.filter((r: any) => {
      if (representanteFiltro !== 'todos' && r.representante_id !== representanteFiltro) return false;
      if (ativoFiltro === 'ativas' && !r.ativo) return false;
      if (ativoFiltro === 'inativas' && r.ativo) return false;
      return true;
    });
  }, [revendedoras, representanteFiltro, ativoFiltro]);

  const pontos = useMemo(
    () => filtradas.filter((r: any) => r.latitude != null && r.longitude != null),
    [filtradas]
  );

  const semCoords = useMemo(
    () => revendedoras.filter((r: any) => r.latitude == null).length,
    [revendedoras]
  );

  const handleAtualizarCoords = async () => {
    setAtualizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-revendedoras');
      if (error) throw error;
      toast.success(`Geocoding concluído: ${data?.sucesso ?? 0} sucesso, ${data?.falha ?? 0} falha`);
      await refetch();
    } catch (e: any) {
      toast.error(`Erro ao atualizar: ${e?.message || e}`);
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-2 items-center">
          <Select value={representanteFiltro} onValueChange={setRepresentanteFiltro}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Representante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos representantes</SelectItem>
              {representantes.map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={ativoFiltro} onValueChange={(v) => setAtivoFiltro(v as AtivoFiltro)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="ativas">🟢 Ativas</SelectItem>
              <SelectItem value="inativas">🔴 Inativas</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAtualizarCoords}
              disabled={atualizando}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${atualizando ? 'animate-spin' : ''}`} />
              {atualizando ? 'Atualizando…' : `Atualizar coordenadas${semCoords ? ` (${semCoords})` : ''}`}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {pontos.length}/{filtradas.length} no mapa
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="h-[600px] w-full rounded-md overflow-hidden">
            <MapContainer
              center={[-14.235, -51.925]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup chunkedLoading>
                {pontos.map((r: any) => (
                  <Marker
                    key={r.id}
                    position={[r.latitude, r.longitude]}
                    icon={r.ativo ? iconAtiva : iconInativa}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{r.nome}</div>
                        <div className="text-muted-foreground">
                          {r.bairro ? `${r.bairro} · ` : ''}{r.cidade} - {r.estado}
                        </div>
                        <div>Rep.: {r.representanteNome || '—'}</div>
                        <div className="mt-1">Status: {r.ativo ? '🟢 Ativa' : '🔴 Inativa'}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
