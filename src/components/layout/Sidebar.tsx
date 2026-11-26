import React, { useCallback } from 'react';
import { companyDisplayName } from '../../utils/company';

import { useApp, AppModule } from '../../context/AppContext';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import { useCurrentDate } from '../../utils/dateUtils';
import { BrandLogo } from '../common/BrandLogo';
import {
  LayoutDashboard,
  Layers,
  FileText,
  ReceiptText,
  Store,
  Calendar,
  Users,
  Sparkles,
  DollarSign,
  Target,
  UserCheck,
  Gift,
  MessageCircle,
  BarChart3,
  Smartphone,
  Headphones,
  Building2,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
  onOpenDrawer?: () => void;
}

type NavItem = {
  id: AppModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  alwaysShowBadge?: boolean;
  isNew?: boolean;
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  drawerOpen = false,
  onCloseDrawer,
  onOpenDrawer
}) => {
  const {
    activeModule,
    setActiveModule,
    canAccessModule,
    orders,
    appointments,
    settings,
    logoutOperator
  } = useApp();

  const handleCloseDrawer = useCallback(() => {
    if (onCloseDrawer) onCloseDrawer();
  }, [onCloseDrawer]);

  const { overlayProps, modalProps } = useModalResponsive({
    isOpen: drawerOpen,
    onClose: handleCloseDrawer,
    maxHeight: '100dvh',
    ariaLabel: 'Menu lateral PK Detail',
  });

  const activePatioCount = orders.filter(o => o.status === 'em_servico' || o.status === 'para_fazer').length;
  const { todayStr } = useCurrentDate();
  const todayAptsCount = appointments.filter(a => a.date === todayStr && a.status !== 'cancelado').length;

  const rawSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Operação',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'patio', label: 'Pátio', icon: Layers, badge: activePatioCount },
        { id: 'ordens', label: 'Ordem de Serviço', icon: FileText },
        { id: 'agenda', label: 'Agenda', icon: Calendar, badge: todayAptsCount, alwaysShowBadge: true },
        { id: 'orcamentos', label: 'Orçamentos', icon: ReceiptText },
        { id: 'servicos', label: 'Serviços', icon: Sparkles },
        { id: 'vitrine', label: 'Vitrine Online', icon: Store, isNew: true },
      ]
    },
    {
      title: 'Clientes',
      items: [
        { id: 'clientes', label: 'Clientes', icon: Users },
        { id: 'posvenda', label: 'Pós-Venda', icon: Gift },
        { id: 'mensagens', label: 'Mensagens WhatsApp', icon: MessageCircle },
      ]
    },
    {
      title: 'Gestão',
      items: [
        { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
        { id: 'metas', label: 'Metas', icon: Target, isNew: true },
        { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
        { id: 'funcionarios', label: 'Funcionários', icon: UserCheck, isNew: true },
        { id: 'permissions', label: 'Permissões', icon: ShieldCheck },
      ]
    },
    {
      title: 'Suporte e recursos',
      items: [
        { id: 'instalar', label: 'Instalar o App', icon: Smartphone },
        { id: 'suporte', label: 'Suporte', icon: Headphones },
      ]
    },
    {
      title: 'Minha conta',
      items: [{ id: 'empresa', label: 'Minha Empresa', icon: Building2 }]
    }
  ];

  const sections = rawSections
    .map(sec => ({
      ...sec,
      items: sec.items.filter(item => canAccessModule(item.id))
    }))
    .filter(sec => sec.items.length > 0);

  const handleSelectModule = (id: AppModule) => {
    setActiveModule(id);
    if (onCloseDrawer) onCloseDrawer();
  };

  const renderNavContent = (isCompact: boolean, isDrawer: boolean) => (
    <>
      {/* Brand header */}
      {isCompact ? (
        <div className="flex flex-col items-center gap-1 px-2 pt-4 pb-2 shrink-0">
          <BrandLogo variant="sidebar" compact companyName={companyDisplayName(settings)} />
          {!isDrawer && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
              className="w-9 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative flex items-center justify-center px-3 pt-4 pb-3 shrink-0">
          <BrandLogo variant="sidebar" compact companyName={companyDisplayName(settings)} />

          {isDrawer && onCloseDrawer ? (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Fechar menu"
              className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center shrink-0 transition"
            >
              <X className="w-4 h-4" />
            </button>
          ) : onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
              className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[34px] min-h-[34px] rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center shrink-0 transition"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      )}

      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto pk-scroll-compact px-2.5 pt-2 pb-4 space-y-4">
        {sections.map(section => (
          <div key={section.title} className="space-y-0.5">
            {!isCompact && (
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <h2 className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 shrink-0">
                  {section.title}
                </h2>
                <span className="flex-1 h-px bg-slate-200/90" aria-hidden="true" />
              </div>
            )}

            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectModule(item.id)}
                  title={isCompact ? item.label : undefined}
                  className={`w-full min-h-[42px] flex items-center gap-2.5 rounded-xl text-[12.5px] transition-colors duration-150 relative ${
                    isCompact ? 'justify-center px-2' : 'px-2.5 text-left'
                  } ${
                    isActive
                      ? 'bg-[#EA580C] text-white font-bold'
                      : 'text-slate-700 font-medium hover:bg-slate-100/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />

                  {!isCompact && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>

                      {item.isNew && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-600">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                          NOVO
                        </span>
                      )}

                      {item.badge !== undefined && (item.badge > 0 || item.alwaysShowBadge) && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums ${
                            isActive ? 'bg-slate-900/10 text-slate-900' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {isCompact && item.badge !== undefined && (item.badge > 0 || item.alwaysShowBadge) && (
                    <span className="absolute top-1 right-1 bg-[#EA580C] text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Sign out */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              logoutOperator();
              if (onCloseDrawer) onCloseDrawer();
            }}
            title={isCompact ? 'Sair' : undefined}
            className={`w-full min-h-[42px] flex items-center gap-2.5 rounded-xl text-[12.5px] font-medium text-red-600 hover:bg-red-50 transition-colors ${
              isCompact ? 'justify-center px-2' : 'px-2.5 text-left'
            }`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!isCompact && <span className="truncate">Sair</span>}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* TABLET MENU TRIGGER (md..lg) - a barra superior foi removida */}
      {onOpenDrawer && (
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Abrir menu lateral"
          className="no-print fixed top-3 left-3 z-40 hidden md:flex lg:hidden min-w-[42px] min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* DESKTOP SIDEBAR (lg+ >= 1024px) - Collapsible */}
      <aside
        className={`no-print hidden lg:flex flex-col bg-white border-r border-slate-200/80 h-dvh sticky top-0 shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'w-[72px]' : 'w-60 xl:w-[256px]'
        }`}
      >
        {renderNavContent(collapsed, false)}
      </aside>

      {/* TABLET & SMALL DESKTOP SLIDE-OVER DRAWER (< lg) */}
      {drawerOpen && (
        <div
          {...overlayProps}
          className="fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-xs flex pk-fade-enter"
        >
          <aside
            {...modalProps}
            className="w-[280px] max-w-[85vw] bg-white h-dvh shadow-2xl flex flex-col border-r border-slate-200 safe-area-bottom pk-slide-left-enter"
          >
            {renderNavContent(false, true)}
          </aside>
        </div>
      )}
    </>
  );
};
