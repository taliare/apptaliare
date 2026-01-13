import { Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
import Producao from '@/pages/Producao';
import ProducaoDiaria from '@/pages/ProducaoDiaria';
import DistribuicaoKits from '@/pages/DistribuicaoKits';
import EncomendaRepresentante from '@/pages/EncomendaRepresentante';
import EncomendaProducao from '@/pages/EncomendaProducao';
import Juridico from '@/pages/Juridico';
import VendaExterna from '@/pages/VendaExterna';
import Vendedoras from '@/pages/Vendedoras';
import RevendedorasInativas from '@/pages/RevendedorasInativas';
import LeadsRevendedoras from '@/pages/LeadsRevendedoras';
import Garantias from '@/pages/Garantias';
import Perfil from '@/pages/Perfil';
import NotFound from '@/pages/NotFound';

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
        
        {/* Admin routes */}
        <Route path="/dashboard-admin" element={
          <ProtectedRoute requiredRole="admin">
            <DashboardAdmin />
          </ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <ProtectedRoute requiredRole="admin">
            <Usuarios />
          </ProtectedRoute>
        } />
        <Route path="/metas" element={
          <ProtectedRoute requiredRole="admin">
            <Metas />
          </ProtectedRoute>
        } />
        <Route path="/gerenciar-agenda" element={
          <ProtectedRoute requiredRole="admin">
            <GerenciarAgenda />
          </ProtectedRoute>
        } />
        <Route path="/importar-cobrancas" element={
          <ProtectedRoute requiredRole="admin">
            <ImportarCobrancas />
          </ProtectedRoute>
        } />
        <Route path="/relatorios" element={
          <ProtectedRoute requiredRole="admin">
            <Relatorios />
          </ProtectedRoute>
        } />
        <Route path="/fechamento-diario" element={
          <ProtectedRoute requiredRole="admin">
            <FechamentoDiario />
          </ProtectedRoute>
        } />
        <Route path="/juridico" element={
          <ProtectedRoute requiredRole="admin">
            <Juridico />
          </ProtectedRoute>
        } />
        <Route path="/venda-externa" element={
          <ProtectedRoute requiredRole="admin">
            <VendaExterna />
          </ProtectedRoute>
        } />
        <Route path="/vendedoras" element={
          <ProtectedRoute requiredRole="admin">
            <Vendedoras />
          </ProtectedRoute>
        } />
        <Route path="/leads-revendedoras" element={
          <ProtectedRoute requiredRole="admin">
            <LeadsRevendedoras />
          </ProtectedRoute>
        } />
        <Route path="/garantias" element={
          <ProtectedRoute requiredRole="admin">
            <Garantias />
          </ProtectedRoute>
        } />
        
        {/* Perfil - acessível para todos */}
        <Route path="/perfil" element={<Perfil />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
