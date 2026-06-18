import { useEffect, useMemo, useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

interface Profile { id: string; nome: string }

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

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
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [ativoFiltro, setAtivoFiltro] = useState<AtivoFiltro>('todos');
  const [, setTick] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0, running: false });

  const { data: revendedoras = [] } = useQuery({
    queryKey: ['revendedoras-mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('id, nome, bairro, cidade, estado, representante_id, ativo')
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

  const cacheKey = (r: any) =>
    `${(r.bairro || '').trim().toUpperCase()}|${(r.cidade || '').trim().toUpperCase()}|${(r.estado || '').trim().toUpperCase()}`;

  // Geocode missing addresses sequentially with 200ms delay
  useEffect(() => {
    let cancelled = false;
    const pending = filtradas.filter((r: any) => !geocodeCache.has(cacheKey(r)));
    if (pending.length === 0) return;

    setProgress({ done: 0, total: pending.length, running: true });

    (async () => {
      for (let i = 0; i < pending.length; i++) {
        if (cancelled) return;
        const r: any = pending[i];
        const key = cacheKey(r);
        if (geocodeCache.has(key)) {
          setProgress((p) => ({ ...p, done: i + 1 }));
          continue;
        }

        const fetchNominatim = async (params: Record<string, string>) => {
          const qs = new URLSearchParams({ ...params, country: 'Brazil', format: 'json', limit: '1' }).toString();
          const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
            headers: { 'Accept': 'application/json', 'Accept-Language': 'pt-BR' },
          });
          const json = await res.json();
          return Array.isArray(json) && json[0] ? json[0] : null;
        };

        try {
          let first: any = null;
          if (r.bairro) {
            first = await fetchNominatim({ street: r.bairro, city: r.cidade, state: r.estado });
            if (!first) {
              await new Promise((res) => setTimeout(res, 200));
              first = await fetchNominatim({ city: r.cidade, state: r.estado });
              console.warn(`[Mapa] ⚠️ Bairro "${r.bairro}" não localizado, usando cidade ${r.cidade}/${r.estado}`);
            }
          } else {
            first = await fetchNominatim({ city: r.cidade, state: r.estado });
          }

          if (first) {
            const coords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
            geocodeCache.set(key, coords);
            console.log(`[Mapa] ✅ ${r.bairro || ''} ${r.cidade}/${r.estado}:`, coords);
          } else {
            geocodeCache.set(key, null);
            console.warn(`[Mapa] ❌ Sem resultado para ${r.bairro || ''} ${r.cidade}/${r.estado}`);
          }
        } catch (e) {
          geocodeCache.set(key, null);
          console.error(`[Mapa] Erro geocodificando ${r.cidade}/${r.estado}:`, e);
        }
        if (cancelled) return;
        setProgress({ done: i + 1, total: pending.length, running: i + 1 < pending.length });
        setTick((t) => t + 1);
        await new Promise((res) => setTimeout(res, 200));
      }
      if (!cancelled) {
        const sucesso = [...geocodeCache.values()].filter(Boolean).length;
        const falha = [...geocodeCache.values()].filter((v) => v === null).length;
        console.log(`[Mapa] Geocoding finalizado — ${sucesso} sucesso, ${falha} falha`);
        setProgress((p) => ({ ...p, running: false }));
      }
    })();

    return () => { cancelled = true; };
  }, [filtradas]);

  const pontos = useMemo(() => {
    return filtradas
      .map((r: any) => {
        const coords = geocodeCache.get(cacheKey(r));
        return coords ? { ...r, coords } : null;
      })
      .filter(Boolean) as any[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, progress.done]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-2">
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
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {pontos.length}/{filtradas.length} no mapa
            {progress.running && <span>· geocodificando {progress.done}/{progress.total}…</span>}
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
                {pontos.map((r) => (
                  <Marker
                    key={r.id}
                    position={[r.coords.lat, r.coords.lng]}
                    icon={r.ativo ? iconAtiva : iconInativa}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{r.nome}</div>
                        <div className="text-muted-foreground">{r.cidade} - {r.estado}</div>
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
