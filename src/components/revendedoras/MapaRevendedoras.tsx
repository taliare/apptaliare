import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profilesLimited } from '@/lib/profilesLimited';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcularStatusRevendedora, type RevendedoraStatusKey } from '@/lib/revendedoraStatus';
import { AlertCircle, MapPin } from 'lucide-react';

interface Profile { id: string; nome: string }

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

interface Props {
  representantes: Profile[];
}

export default function MapaRevendedoras({ representantes }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | RevendedoraStatusKey>('todos');

  const { data: revendedoras = [] } = useQuery({
    queryKey: ['revendedoras-mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revendedoras')
        .select('id, nome, cidade, estado, cep, logradouro, numero, bairro, representante_id, ativo, status_juridico, ultima_atividade')
        .not('cidade', 'is', null)
        .not('estado', 'is', null);
      if (error) throw error;
      const repIds = [...new Set((data ?? []).map((r: any) => r.representante_id).filter(Boolean))];
      const { data: profiles } = await profilesLimited().select('id, nome').in('id', repIds);
      const map = new Map(profiles?.map((p: any) => [p.id, p.nome]) || []);
      return (data ?? []).map((r: any) => ({ ...r, representanteNome: r.representante_id ? map.get(r.representante_id) || '' : '' }));
    },
  });

  const nomesNorm = useMemo(() => revendedoras.map((r) => r.nome.trim().toUpperCase()), [revendedoras]);

  const { data: cobrancasMap = new Map<string, any[]>() } = useQuery({
    queryKey: ['revendedoras-mapa-cobrancas', nomesNorm],
    enabled: nomesNorm.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_agendadas')
        .select('revendedora, status, data_agendada, valor_previsto, valor_pago_acumulado, valor_adiantado')
        .in('revendedora', nomesNorm);
      if (error) throw error;
      const map = new Map<string, any[]>();
      (data ?? []).forEach((c: any) => {
        const k = (c.revendedora ?? '').trim().toUpperCase();
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
      });
      return map;
    },
  });

  const revendedorasComStatus = useMemo(() => {
    return revendedoras.map((r) => {
      const cobs = cobrancasMap.get(r.nome.trim().toUpperCase()) ?? [];
      return { ...r, statusInfo: calcularStatusRevendedora(r as any, cobs) };
    });
  }, [revendedoras, cobrancasMap]);

  const filtradas = useMemo(() => {
    return revendedorasComStatus.filter((r) => {
      if (representanteFiltro !== 'todos' && r.representante_id !== representanteFiltro) return false;
      if (statusFiltro !== 'todos' && r.statusInfo.key !== statusFiltro) return false;
      return true;
    });
  }, [revendedorasComStatus, representanteFiltro, statusFiltro]);

  // init map
  useEffect(() => {
    if (!apiKey || !mapDivRef.current) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, version: 'weekly' });
    loader.load().then(() => {
      if (cancelled || !mapDivRef.current) return;
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        center: { lat: -14.235, lng: -51.9253 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapReady(true);
    }).catch((e) => console.error('Erro ao carregar Google Maps:', e));
    return () => { cancelled = true; };
  }, [apiKey]);

  // geocode + render markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const geocoder = new google.maps.Geocoder();
      const markers: google.maps.Marker[] = [];
      const toGeocode = filtradas.filter((r) => {
        const key = `${r.cep ?? ''}|${r.cidade}|${r.estado}`;
        return !geocodeCache.has(key);
      });

      setGeocoding(toGeocode.length > 0);
      setProgress({ done: 0, total: toGeocode.length });

      for (let i = 0; i < toGeocode.length; i++) {
        if (cancelled) return;
        const r = toGeocode[i];
        const key = `${r.cep ?? ''}|${r.cidade}|${r.estado}`;
        const address = [r.logradouro, r.numero, r.bairro, r.cidade, r.estado, r.cep, 'Brasil'].filter(Boolean).join(', ');
        try {
          const res = await geocoder.geocode({ address });
          const loc = res.results[0]?.geometry.location;
          geocodeCache.set(key, loc ? { lat: loc.lat(), lng: loc.lng() } : null);
        } catch {
          geocodeCache.set(key, null);
        }
        setProgress({ done: i + 1, total: toGeocode.length });
        await new Promise((res) => setTimeout(res, 80));
      }
      setGeocoding(false);

      if (cancelled) return;

      for (const r of filtradas) {
        const key = `${r.cep ?? ''}|${r.cidade}|${r.estado}`;
        const coords = geocodeCache.get(key);
        if (!coords) continue;
        const marker = new google.maps.Marker({
          position: coords,
          title: r.nome,
        });
        marker.addListener('click', () => {
          if (!infoWindowRef.current || !mapRef.current) return;
          const html = `
            <div style="font-family: system-ui; min-width: 180px;">
              <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(r.nome)}</div>
              <div style="font-size:12px;color:#555;">${escapeHtml(r.cidade)} - ${escapeHtml(r.estado)}</div>
              <div style="font-size:12px;color:#555;">Rep.: ${escapeHtml(r.representanteNome || '—')}</div>
              <div style="font-size:12px;margin-top:4px;">${r.statusInfo.emoji} ${escapeHtml(r.statusInfo.label)}</div>
            </div>`;
          infoWindowRef.current.setContent(html);
          infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
        });
        markers.push(marker);
      }

      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
      }
      clustererRef.current = new MarkerClusterer({ map: mapRef.current!, markers });
    })();

    return () => { cancelled = true; };
  }, [mapReady, filtradas]);

  if (!apiKey) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="font-medium">Chave do Google Maps não configurada</p>
          <p className="text-sm text-muted-foreground">
            Defina <code className="px-1 py-0.5 bg-muted rounded">VITE_GOOGLE_MAPS_API_KEY</code> no arquivo <code>.env</code> e reinicie o servidor.
          </p>
        </CardContent>
      </Card>
    );
  }

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
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativa">🟢 Ativa</SelectItem>
              <SelectItem value="pagando">🔵 Pagando</SelectItem>
              <SelectItem value="quite">✅ Quite</SelectItem>
              <SelectItem value="em_atraso">⚠️ Em Atraso</SelectItem>
              <SelectItem value="inadimplente">🔴 Inadimplente</SelectItem>
              <SelectItem value="juridico_solicitado">⚖️ Sol. Jurídico</SelectItem>
              <SelectItem value="juridico_aprovado">⛔ Jurídico</SelectItem>
              <SelectItem value="inativa">💤 Inativa</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {filtradas.length} revendedoras
            {geocoding && <span>· geocodificando {progress.done}/{progress.total}…</span>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div ref={mapDivRef} className="w-full h-[600px] rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
