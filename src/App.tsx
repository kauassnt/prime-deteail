/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { initOnlineBookingSound } from './services/onlineBookingSound';
import { useGlobalScrollLock } from './hooks/useGlobalScrollLock';
// Tela de login sob demanda: o app autenticado não baixa o chunk/CSS do Lumina.
const LuminaLoginScreen = lazy(() =>
  import('./components/login/LuminaLoginScreen').then(m => ({ default: m.LuminaLoginScreen }))
);
import { PwaStatusLayer } from './components/common/PwaStatusLayer';
import { DialogHost } from './components/ui/DialogHost';
import { useKeyboardVisibility } from './hooks/useKeyboardVisibility';
import { LOGIN_PATH, isErrorPath, isLoginPath, isUnknownInternalPath, moduleFromPathname, pathForModule } from './core/appRouter';
import { ErrorPage } from './components/common/ErrorPage';

// Critical Path Code Splitting: lazy load secondary modules & heavy modals
const DashboardModule = lazy(() =>
  import('./components/modules/DashboardModule').then(m => ({ default: m.DashboardModule }))
);
const PatioModule = lazy(() =>
  import('./components/modules/PatioModule').then(m => ({ default: m.PatioModule }))
);
const ServiceOrdersModule = lazy(() =>
  import('./components/modules/ServiceOrdersModule').then(m => ({ default: m.ServiceOrdersModule }))
);
const QuotesModule = lazy(() =>
  import('./components/modules/QuotesModule').then(m => ({ default: m.QuotesModule }))
);
const StorefrontModule = lazy(() =>
  import('./components/modules/StorefrontModule').then(m => ({ default: m.StorefrontModule }))
);
const AfterSalesModule = lazy(() =>
  import('./components/modules/AfterSalesModule').then(m => ({ default: m.AfterSalesModule }))
);
const GoalsModule = lazy(() =>
  import('./components/modules/GoalsModule').then(m => ({ default: m.GoalsModule }))
);
const AppointmentsModule = lazy(() =>
  import('./components/modules/AppointmentsModule').then(m => ({ default: m.AppointmentsModule }))
);
const ClientsModule = lazy(() =>
  import('./components/modules/ClientsModule').then(m => ({ default: m.ClientsModule }))
);
const ServicesCatalogModule = lazy(() =>
  import('./components/modules/ServicesCatalogModule').then(m => ({ default: m.ServicesCatalogModule }))
);
const FinancialModule = lazy(() =>
  import('./components/modules/FinancialModule').then(m => ({ default: m.FinancialModule }))
);
const EmployeesModule = lazy(() =>
  import('./components/modules/EmployeesModule').then(m => ({ default: m.EmployeesModule }))
);
const CustomerPortalModule = lazy(() =>
  import('./components/modules/CustomerPortalModule').then(m => ({ default: m.CustomerPortalModule }))
);
const MyCompanyModule = lazy(() =>
  import('./components/modules/MyCompanyModule').then(m => ({ default: m.MyCompanyModule }))
);
const SupportCenterModule = lazy(() =>
  import('./components/modules/SupportCenterModule').then(m => ({ default: m.SupportCenterModule }))
);
const MessageTemplatesModule = lazy(() =>
  import('./components/modules/MessageTemplatesModule').then(m => ({ default: m.MessageTemplatesModule }))
);
const InstallAppModule = lazy(() =>
  import('./components/modules/InstallAppModule').then(m => ({ default: m.InstallAppModule }))
);
const ReportsModule = lazy(() =>
  import('./components/modules/ReportsModule').then(m => ({ default: m.ReportsModule }))
);
const PermissionsModule = lazy(() =>
  import('./components/modules/PermissionsModule').then(m => ({ default: m.PermissionsModule }))
);

const QuickActionModal = lazy(() =>
  import('./components/common/QuickActionModal').then(m => ({ default: m.QuickActionModal }))
);
const AutoWhatsappBanner = lazy(() =>
  import('./components/common/AutoWhatsappBanner').then(m => ({ default: m.AutoWhatsappBanner }))
);
const ServiceOrderModal = lazy(() =>
  import('./components/modules/ServiceOrderModal').then(m => ({ default: m.ServiceOrderModal }))
);

function MainContent() {
  const {
    activeModule,
    setActiveModule,
    canAccessModule,
    selectedOrderId,
    setSelectedOrderId,
    clientPortalOnly,
    isSessionLoggedOut,
    loginOperator,
    quickActionOpen,
    activeWhatsappPrompt,
  } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);

  useKeyboardVisibility();
  // Trava a rolagem do fundo sempre que houver modal/overlay aberto.
  useGlobalScrollLock();

  // Alerta sonoro só no app interno: o portal público não baixa o áudio.
  React.useEffect(() => {
    if (clientPortalOnly || isSessionLoggedOut) return;
    initOnlineBookingSound();
  }, [clientPortalOnly, isSessionLoggedOut]);

  // Warm the QuickActionModal chunk during browser idle time so opening "Nova OS" is instant
  React.useEffect(() => {
    if (clientPortalOnly || typeof window === 'undefined') return;
    const prefetch = () => {
      void import('./components/common/QuickActionModal');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = globalThis.setTimeout(prefetch, 1200);
    return () => globalThis.clearTimeout(timer);
  }, [clientPortalOnly]);

  React.useEffect(() => {
    if (clientPortalOnly) return;
    if (!canAccessModule(activeModule)) {
      const fallbackOrder = [
        'dashboard',
        'patio',
        'ordens',
        'agenda',
        'clientes',
        'servicos',
      ] as const;
      const firstAllowed = fallbackOrder.find(m => canAccessModule(m)) || 'dashboard';
      setActiveModule(firstAllowed);
    }
  }, [activeModule, canAccessModule, setActiveModule, clientPortalOnly]);

  // Mantém a URL coerente com a tela atual: /login sem sessão, /<módulo> com sessão.
  React.useEffect(() => {
    if (clientPortalOnly || typeof window === 'undefined') return;
    const current = window.location.pathname.replace(/\/+$/, '') || '/';
    // A rota de erro tem URL própria e não deve ser reescrita.
    if (isErrorPath(current)) return;
    if (isSessionLoggedOut) {
      if (!isLoginPath(current)) window.history.replaceState(null, '', LOGIN_PATH);
      return;
    }
    const target = pathForModule(activeModule);
    const knownModule = moduleFromPathname(current);
    // Sai de /login ou da raiz; corrige módulo divergente do estado; caminhos
    // internos desconhecidos (ex.: /relatorios/xyz, /qualquer-coisa) voltam
    // para o módulo atual. Links da Vitrine nem chegam aqui (clientPortalOnly).
    if (current !== target && (isLoginPath(current) || current === '/' || knownModule || isUnknownInternalPath(current))) {
      window.history.replaceState(null, '', target);
    }
  }, [activeModule, isSessionLoggedOut, clientPortalOnly]);

  // Página de erro com URL própria (/erro), acessível a qualquer momento.
  if (isErrorPath(window.location.pathname)) {
    return (
      <ErrorPage
        code="404"
        // Navegação completa: o módulo ativo já é 'dashboard', então só trocar
        // o estado não sairia da página de erro.
        onHome={() => window.location.assign('/dashboard')}
      />
    );
  }

  // Strict Client-Only Mode: renders ONLY the Customer Portal with zero access to the internal management system
  if (clientPortalOnly) {
    return (
      <div className="min-h-dvh w-full max-w-full bg-[#FAF8F5] text-[#171717] font-sans antialiased keyboard-safe-scroll">
        <AppErrorBoundary scopeName="Portal do Cliente">
          <Suspense fallback={null}>
            <CustomerPortalModule isStandalone />
          </Suspense>
        </AppErrorBoundary>
      </div>
    );
  }

  // Operator Login Screen (shown when operator explicitly logs out)
  if (isSessionLoggedOut) {
    return (
      <Suspense fallback={null}>
        <LuminaLoginScreen onAuthenticated={loginOperator} />
      </Suspense>
    );
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'patio':
        return <PatioModule />;
      case 'ordens':
        return <ServiceOrdersModule />;
      case 'orcamentos':
        return <QuotesModule />;
      case 'vitrine':
        return <StorefrontModule />;
      case 'posvenda':
        return <AfterSalesModule />;
      case 'metas':
        return <GoalsModule />;
      case 'agenda':
        return <AppointmentsModule />;
      case 'clientes':
        return <ClientsModule />;
      case 'servicos':
        return <ServicesCatalogModule />;
      case 'financeiro':
        return <FinancialModule />;
      case 'funcionarios':
        return <EmployeesModule />;
      case 'whatsapp':
        return <MessageTemplatesModule />;
      case 'mensagens':
        return <MessageTemplatesModule />;
      case 'suporte':
        return <SupportCenterModule />;
      case 'empresa':
        return <MyCompanyModule />;
      case 'instalar':
        return <InstallAppModule />;
      case 'relatorios':
        return <ReportsModule />;
      case 'permissions':
        return <PermissionsModule />;
      default:
        return <PatioModule />;
    }
  };

  return (
    <>
      <div
        className={`${
          selectedOrderId ? 'no-print ' : ''
        }flex min-h-dvh w-full max-w-full bg-[#FFFBF7] text-[#171717] font-sans antialiased`}
      >
        {/* Desktop Collapsible Sidebar (lg+) & Tablet Slide-over Drawer (md..lg) */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          drawerOpen={tabletDrawerOpen}
          onCloseDrawer={() => setTabletDrawerOpen(false)}
          onOpenDrawer={() => setTabletDrawerOpen(true)}
        />

        {/* Main App Container */}
        <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
          {/* Scrollable Module Workspace (fills full available screen width cleanly with ultrawide cap) */}
          <main className="keyboard-safe-scroll flex-1 min-w-0 pk-main-shell">
            <AppErrorBoundary
              scopeName={`módulo ${activeModule}`}
              resetKey={activeModule}
              onResetNavigate={() => setActiveModule('patio')}
            >
              <Suspense fallback={null}>
                <div key={activeModule} className="pk-content-max min-w-0 pk-module-enter">
                  {renderActiveModule()}
                </div>
              </Suspense>
            </AppErrorBoundary>
          </main>

          {/* Mobile Navigation Bar (Bottom fixed on < md) */}
          <MobileNav />

          {/* Deferred Heavy Modals / Banners (loaded on demand) */}
          {quickActionOpen && (
            <Suspense fallback={null}>
              <QuickActionModal />
            </Suspense>
          )}

          {activeWhatsappPrompt && (
            <Suspense fallback={null}>
              <AutoWhatsappBanner />
            </Suspense>
          )}
        </div>
      </div>

      {/* Full-Screen Service Order & Official A4 PDF Workspace */}
      {selectedOrderId && (
        <Suspense fallback={null}>
          <ServiceOrderModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
          />
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <MainContent />
        <PwaStatusLayer />
        <DialogHost />
      </AppProvider>
    </AppErrorBoundary>
  );
}
