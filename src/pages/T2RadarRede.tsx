import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wifi, AlertTriangle, XCircle, Activity, Search } from 'lucide-react';
import { RADAR_LABELS, RADAR_COLORS, CATEGORIA_LABELS, CATEGORIA_COLORS } from '@/components/t2/constants';

const RADAR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ATIVA: Wifi,
  ATENCAO: AlertTriangle,
  RISCO: XCircle,
};

export default function T2RadarRede() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filtroRepresentante, setFiltroRepresentante] = useState('todos');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroRadar, setFiltroRadar] = useState('todos');

  // Fetch radar data
  const { data: radarData = [], isLoading } = useQuery({
    queryKey: ['t2-radar-rede'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('t2_vw_radar_revendedoras' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch representantes for filter
  const { data: representantes = [] } = useQuery({
    queryKey: ['profiles-limited-radar'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles_limited').select('id, nome');
      return data || [];
    },
    enabled: isAdmin,
  });

  // Filter data
  const filteredData = useMemo(() => {
    return radarData.filter((r: any) => {
      if (filtroRepresentante !== 'todos' && r.representante_id !== filtroRepresentante) return false;
      if (filtroCidade && !r.cidade?.toLowerCase().includes(filtroCidade.toLowerCase())) return false;
      if (filtroCategoria !== 'todos' && r.categoria_atual !== filtroCategoria) return false;
      if (filtroRadar !== 'todos' && r.status_radar !== filtroRadar) return false;
      return true;
    });
  }, [radarData, filtroRepresentante, filtroCidade, filtroCategoria, filtroRadar]);

  // Dashboard stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const ativas = filteredData.filter((r: any) => r.status_radar === 'ATIVA').length;
    const atencao = filteredData.filter((r: any) => r.status_radar === 'ATENCAO').length;
    const risco = filteredData.filter((r: any) => r.status_radar === 'RISCO').length;
    const pctAtiva = total > 0 ? Math.round((ativas / total) * 100) : 0;
    return { total, ativas, atencao, risco, pctAtiva };
  }, [filteredData]);

  // Get representante name
  const getRepresentanteNome = (id: string) => {
    const rep = representantes.find((r: any) => r.id === id);
    return rep?.nome || '—';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Radar da Rede</h1>
        <p className="text-sm text-muted-foreground">Monitoramento de atividade das revendedoras</p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Ativas</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ativas}</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Atenção</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.atencao}</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Risco</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.risco}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Rede Ativa</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.pctAtiva}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {isAdmin && (
              <Select value={filtroRepresentante} onValueChange={setFiltroRepresentante}>
                <SelectTrigger>
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os representantes</SelectItem>
                  {representantes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar cidade..."
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas categorias</SelectItem>
                {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroRadar} onValueChange={setFiltroRadar}>
              <SelectTrigger>
                <SelectValue placeholder="Status Radar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(RADAR_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Revendedoras ({filteredData.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma revendedora encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Revendedora</TableHead>
                    {isAdmin && <TableHead>Representante</TableHead>}
                    <TableHead>Cidade</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Dias s/ Vender</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((r: any) => {
                    const RadarIcon = RADAR_ICONS[r.status_radar] || XCircle;
                    return (
                      <TableRow key={r.revendedora_id}>
                        <TableCell className="font-medium">{r.nome_revendedora}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground text-sm">
                            {getRepresentanteNome(r.representante_id)}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground text-sm">{r.cidade || '—'}</TableCell>
                        <TableCell>
                          {r.categoria_atual ? (
                            <Badge className={CATEGORIA_COLORS[r.categoria_atual] || ''} variant="secondary">
                              {CATEGORIA_LABELS[r.categoria_atual] || r.categoria_atual}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={
                            r.dias_sem_vender === null ? 'text-muted-foreground' :
                            r.dias_sem_vender <= 45 ? 'text-green-600 dark:text-green-400 font-medium' :
                            r.dias_sem_vender <= 90 ? 'text-yellow-600 dark:text-yellow-400 font-medium' :
                            'text-red-600 dark:text-red-400 font-bold'
                          }>
                            {r.dias_sem_vender !== null ? r.dias_sem_vender : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={RADAR_COLORS[r.status_radar] || ''} variant="secondary">
                            <RadarIcon className="h-3 w-3 mr-1" />
                            {RADAR_LABELS[r.status_radar] || r.status_radar}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
