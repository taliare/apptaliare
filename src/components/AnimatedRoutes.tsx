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
import GruposPermissoes from '@/pages/GruposPermissoes';
import Metas from '@/pages/Metas';
import GerenciarAgenda from '@/pages/GerenciarAgenda';
import ImportarCobrancas from '@/pages/ImportarCobrancas';

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
import ApuracaoKits from '@/pages/ApuracaoKits';
import CatalogoProdutos from '@/pages/CatalogoProdutos';
import MontarKit from '@/pages/MontarKit';
import ConfiguracaoPDF from '@/pages/ConfiguracaoPDF';
import FluxoCaixa from '@/pages/FluxoCaixa';

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
        <Route path="/catalogo-produtos" element={<CatalogoProdutos />} />
        <Route path="/montar-kit" element={<MontarKit />} />
        
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
          <ProtectedRoute>
            <Garantias />
          </ProtectedRoute>
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
        <Route path="/fluxo-caixa" element={
          <PermissionRoute menuKey="fluxo_caixa">
            <FluxoCaixa />
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
        
        
        {/* Apuração de Kits */}
        <Route path="/apuracao" element={
          <PermissionRoute menuKey="apuracao">
            <ApuracaoKits />
          </PermissionRoute>
        } />
        
        {/* Configuração PDF - admin only */}
        <Route path="/configuracao-pdf" element={
          <ProtectedRoute requiredRole="admin">
            <ConfiguracaoPDF />
          </ProtectedRoute>
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
