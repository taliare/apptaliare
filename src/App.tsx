import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PWAUpdateNotification } from "@/components/PWAUpdateNotification";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { MobileTopbar } from "@/components/MobileTopbar";
import { MobileDrawer } from "@/components/MobileDrawer";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";

const queryClient = new QueryClient();

const App = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdateNotification />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/setup" element={<Setup />} />
                
                <Route path="/*" element={
                  <ProtectedRoute>
                    <SidebarProvider>
                      <div className="flex flex-col min-h-screen w-full">
                        {/* Desktop Header - fixed on top */}
                        <AppHeader />

                        <div className="flex flex-1 w-full">
                          {/* Desktop Sidebar - hidden on mobile */}
                          <div className="hidden md:block">
                            <AppSidebar />
                          </div>

                          {/* Mobile Topbar - visible only on mobile */}
                          <MobileTopbar onMenuClick={() => setShowMobileMenu(true)} />

                          {/* Mobile Drawer */}
                          <MobileDrawer open={showMobileMenu} onOpenChange={setShowMobileMenu} />

                          {/* Main Content with Page Transitions */}
                          <main className="flex-1 px-2.5 xs:px-4 py-3 xs:py-4 md:p-6 bg-background w-full pt-16 xs:pt-20 md:pt-6 overflow-x-hidden">
                            <AnimatedRoutes />
                          </main>
                        </div>
                      </div>
                    </SidebarProvider>
                  </ProtectedRoute>
                } />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
