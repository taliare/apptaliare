import { Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionRoute } from '@/components/PermissionRoute';
import Dashboard from '@/pages/Dashboard';
import DashboardAdmin from '@/pages/DashboardAdmin';
import Cobranca from '@/pages/Cobranca';
import CobrancaDiaria from '@/pages/CobrancaDiaria';
import FechamentoDiario from '@/pages/FechamentoDiario';
import Kits from '@/pages/Kits';
import KitsEntregues from '@/pages/KitsEntregues';
import Usuarios from '@/pages/Usuarios';
import Metas from '@/pages/Metas';
import GerenciarAgenda from '@/pages/GerenciarAgenda';
import ImportarCobrancas from '@/pages/ImportarCobrancas';
import Relatorios from '@/pages/Relatorios';
import RelatorioKpis from '@/pages/RelatorioKpis';
import Producao from '@/pages/Producao';
import ProducaoDiaria from '@/pages/ProducaoDiaria';
import DistribuicaoKits from '@/pages/DistribuicaoKits';
import EncomendaRepresentante from '@/pages/EncomendaRepresentante';
import EncomendaProducao from '@/pages/EncomendaProducao';
import Juridico from '@/pages/Juridico';
import VendaExterna from '@/pages/VendaExterna';
import Revendedoras from '@/pages/Revendedoras';
import RevendedorasInativas from '@/pages/RevendedorasInativas';
import LeadsRevendedoras from '@/pages/LeadsRevendedoras';
import Garantias from '@/pages/Garantias';
import Perfil from '@/pages/Perfil';
import NotFound from '@/pages/NotFound';
import DreResumo from '@/pages/DreResumo';
import DreDespesas from '@/pages/DreDespesas';
import DreCategorias from '@/pages/DreCategorias';
import AnaliseComercial from '@/pages/AnaliseComercial';
import HistoricoAcoes from '@/pages/HistoricoAcoes';
import AuditoriaGeral from '@/pages/AuditoriaGeral';
import T2Producao from '@/pages/T2Producao';
import T2Revendedoras from '@/pages/T2Revendedoras';
import T2Ciclos from '@/pages/T2Ciclos';
import T2Ranking from '@/pages/T2Ranking';
import T2Inadimplencia from '@/pages/T2Inadimplencia';
import T2RadarRede from '@/pages/T2RadarRede';
import T2RepresentantesPerformance from '@/pages/T2RepresentantesPerformance';
import T2Financeiro from '@/pages/T2Financeiro';
import T2PainelRede from '@/pages/T2PainelRede';
import T2MeusKits from '@/pages/T2MeusKits';

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-transition page-enter">
      <Routes location={location}>
        {/* Representante routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cobranca" element={<Cobranca />} />
        <Route path="/cobranca-diaria" element={<CobrancaDiaria />} />
        <Route path="/kits" element={<Kits />} />
        <Route path="/kits-entregues" element={<KitsEntregues />} />
        <Route path="/encomendas" element={<EncomendaRepresentante />} />
        <Route path="/revendedoras-inativas" element={<RevendedorasInativas />} />
        
        {/* Producao routes */}
        <Route path="/producao" element={
          <ProtectedRoute requiredRole="producao">
            <Producao />
          </ProtectedRoute>
        } />
        <Route path="/producao-diaria" element={
          <ProtectedRoute requiredRole="producao">
            <ProducaoDiaria />
          </ProtectedRoute>
        } />
        <Route path="/distribuicao-kits" element={
          <DistribuicaoKits />
        } />
        <Route path="/encomendas-producao" element={
          <ProtectedRoute requiredRole="producao">
            <EncomendaProducao />
          </ProtectedRoute>
        } />
        
        {/* Admin routes - with permission control for non-admins */}
        <Route path="/dashboard-admin" element={
          <ProtectedRoute requiredRole="admin">
            <DashboardAdmin />
          </ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <PermissionRoute menuKey="usuarios">
            <Usuarios />
          </PermissionRoute>
        } />
        <Route path="/metas" element={
          <PermissionRoute menuKey="metas">
            <Metas />
          </PermissionRoute>
        } />
        <Route path="/gerenciar-agenda" element={
          <PermissionRoute menuKey="gerenciar_agenda">
            <GerenciarAgenda />
          </PermissionRoute>
        } />
        <Route path="/importar-cobrancas" element={
          <PermissionRoute menuKey="importar_cobrancas">
            <ImportarCobrancas />
          </PermissionRoute>
        } />
        <Route path="/relatorios" element={
          <PermissionRoute menuKey="relatorios">
            <Relatorios />
          </PermissionRoute>
        } />
        <Route path="/relatorio-kpis" element={
          <PermissionRoute menuKey="relatorio_kpis">
            <RelatorioKpis />
          </PermissionRoute>
        } />
        <Route path="/fechamento-diario" element={
          <PermissionRoute menuKey="fechamento_diario">
            <FechamentoDiario />
          </PermissionRoute>
        } />
        <Route path="/juridico" element={
          <PermissionRoute menuKey="juridico">
            <Juridico />
          </PermissionRoute>
        } />
        <Route path="/venda-externa" element={
          <PermissionRoute menuKey="venda_externa">
            <VendaExterna />
          </PermissionRoute>
        } />
        <Route path="/revendedoras" element={
          <PermissionRoute menuKey="revendedoras">
            <Revendedoras />
          </PermissionRoute>
        } />
        <Route path="/leads-revendedoras" element={
          <PermissionRoute menuKey="crm">
            <LeadsRevendedoras />
          </PermissionRoute>
        } />
        <Route path="/garantias" element={
          <PermissionRoute menuKey="garantias">
            <Garantias />
          </PermissionRoute>
        } />
        
        {/* DRE routes */}
        <Route path="/dre-resumo" element={
          <PermissionRoute menuKey="dre_resumo">
            <DreResumo />
          </PermissionRoute>
        } />
        <Route path="/dre-despesas" element={
          <PermissionRoute menuKey="dre_despesas">
            <DreDespesas />
          </PermissionRoute>
        } />
        <Route path="/dre-categorias" element={
          <PermissionRoute menuKey="dre_categorias">
            <DreCategorias />
          </PermissionRoute>
        } />
        
        {/* Análise Comercial route */}
        <Route path="/analise-comercial" element={
          <PermissionRoute menuKey="analise_comercial">
            <AnaliseComercial />
          </PermissionRoute>
        } />
        
        {/* Auditoria Geral */}
        <Route path="/auditoria-geral" element={
          <PermissionRoute menuKey="auditoria_geral">
            <AuditoriaGeral />
          </PermissionRoute>
        } />
        
        {/* TALIARE 2.0 routes */}
        <Route path="/t2-painel-rede" element={
          <PermissionRoute menuKey="t2_painel_rede">
            <T2PainelRede />
          </PermissionRoute>
        } />
        <Route path="/t2-producao" element={
          <PermissionRoute menuKey="t2_producao">
            <T2Producao />
          </PermissionRoute>
        } />
        <Route path="/t2-revendedoras" element={
          <PermissionRoute menuKey="t2_revendedoras">
            <T2Revendedoras />
          </PermissionRoute>
        } />
        <Route path="/t2-ciclos" element={
          <PermissionRoute menuKey="t2_ciclos">
            <T2Ciclos />
          </PermissionRoute>
        } />
        <Route path="/t2-ranking" element={
          <PermissionRoute menuKey="t2_ranking">
            <T2Ranking />
          </PermissionRoute>
        } />
        <Route path="/t2-radar" element={
          <PermissionRoute menuKey="t2_radar">
            <T2RadarRede />
          </PermissionRoute>
        } />
        <Route path="/t2-representantes-performance" element={
          <PermissionRoute menuKey="t2_representantes_performance">
            <T2RepresentantesPerformance />
          </PermissionRoute>
        } />
        <Route path="/t2-inadimplencia" element={
          <PermissionRoute menuKey="t2_inadimplencia">
            <T2Inadimplencia />
          </PermissionRoute>
        } />
        <Route path="/t2-financeiro" element={
          <PermissionRoute menuKey="t2_financeiro">
            <T2Financeiro />
          </PermissionRoute>
        } />
        
        {/* Histórico de Ações - representantes */}
        <Route path="/historico-acoes" element={<HistoricoAcoes />} />
        
        {/* Perfil - acessível para todos */}
        <Route path="/perfil" element={<Perfil />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
