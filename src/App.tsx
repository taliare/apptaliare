import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTopbar } from "@/components/MobileTopbar";
import { MobileDrawer } from "@/components/MobileDrawer";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState } from "react";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import DashboardAdmin from "./pages/DashboardAdmin";
import Cobranca from "./pages/Cobranca";
import CobrancaDiaria from "./pages/CobrancaDiaria";
import Kits from "./pages/Kits";
import Usuarios from "./pages/Usuarios";
import Metas from "./pages/Metas";
import GerenciarAgenda from "./pages/GerenciarAgenda";
import ImportarCobrancas from "./pages/ImportarCobrancas";
import Relatorios from "./pages/Relatorios";
import Producao from "./pages/Producao";
import ProducaoDiaria from "./pages/ProducaoDiaria";
import DistribuicaoKits from "./pages/DistribuicaoKits";
import EncomendaRepresentante from "./pages/EncomendaRepresentante";
import EncomendaProducao from "./pages/EncomendaProducao";
import Juridico from "./pages/Juridico";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup" element={<Setup />} />
              
              <Route path="/*" element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="flex min-h-screen w-full">
                      {/* Desktop Sidebar - hidden on mobile */}
                      <div className="hidden md:block">
                        <AppSidebar />
                      </div>

                      {/* Mobile Topbar - visible only on mobile */}
                      <MobileTopbar onMenuClick={() => setShowMobileMenu(true)} />

                      {/* Mobile Drawer */}
                      <MobileDrawer open={showMobileMenu} onOpenChange={setShowMobileMenu} />

                      {/* Main Content */}
                      <main className="flex-1 px-4 py-4 md:p-6 bg-background w-full pt-20 md:pt-6 overflow-x-hidden">
                        <Routes>
                          {/* Representante routes */}
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/cobranca" element={<Cobranca />} />
                          <Route path="/cobranca-diaria" element={<CobrancaDiaria />} />
                          <Route path="/kits" element={<Kits />} />
                          <Route path="/encomendas" element={<EncomendaRepresentante />} />
                          
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
                            <ProtectedRoute requiredRole="producao">
                              <DistribuicaoKits />
                            </ProtectedRoute>
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
                          <Route path="/juridico" element={
                            <ProtectedRoute requiredRole="admin">
                              <Juridico />
                            </ProtectedRoute>
                          } />
                          
                          {/* Default redirect */}
                          <Route path="/" element={<Dashboard />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;