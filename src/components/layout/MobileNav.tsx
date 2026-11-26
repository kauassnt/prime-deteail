import React, { useState, useCallback } from 'react';

import { useApp, AppModule } from '../../context/AppContext';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import { useCurrentDate } from '../../utils/dateUtils';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { alertDialog } from '../../services/dialogService';
import {
  Calendar,
  Plus,
  FileText,
  FileCheck,
  X,
  Smartphone,
  PlayCircle,
  PhoneCall,
  Building2,
  LogOut,
  ClipboardList,
  Store,
  Target,
  Wrench,
  LayoutDashboard,
  Users,
  DollarSign,
  UserCheck,
  Gift,
  MessageCircle,
  BarChart3,
  ShieldCheck,
  Car,
  MoreHorizontal
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activeModule, setActiveModule, canAccessModule, orders, appointments, openQuickAction, settings, logoutOperator } = useApp();
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [quickMenuClosing, setQuickMenuClosing] = useState(false);

  const closeQuickMenu = useCallback(() => {
    setQuickMenuClosing(true);
    window.setTimeout(() => {
      setShowQuickMenu(false);
      setQuickMenuClosing(false);
    }, 150);
  }, []);

  const toggleQuickMenu = useCallback(() => {
    if (showQuickMenu) {
      closeQuickMenu();
      return;
    }
    setQuickMenuClosing(false);
    setShowQuickMenu(true);
  }, [showQuickMenu, closeQuickMenu]);
  const canQuickAction =
    canAccessModule('ordens') || canAccessModule('agenda') || canAccessModule('clientes') || canAccessModule('financeiro');

  const runQuickAction = (type: 'os' | 'agenda' | 'cliente' | 'recebimento') => {
    setShowQuickMenu(false);
    openQuickAction(type);
  };

  const openModuleWithAction = (module: AppModule, flag: string, eventName: string) => {
    setShowQuickMenu(false);
    setActiveModule(module);
    try {
      sessionStorage.setItem(flag, '1');
    } catch {
      // sem sessionStorage: o evento resolve quando o módulo já está montado
    }
    // Se o módulo já estiver montado, o evento abre o formulário e limpa a flag.
    window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 60);
  };

  const canQuickAdd = canAccessModule('ordens') || canAccessModule('agenda') || canAccessModule('orcamentos');

  const closeMoreMenu = useCallback(() => setShowMoreMenu(false), []);
  const { overlayProps, modalProps, modalClasses } = useModalResponsive({
    isOpen: showMoreMenu,
    onClose: closeMoreMenu,
    ariaLabel: 'Todos os Módulos PK Detail',
  });

  const activeBikesCount = orders.filter(o => o.status === 'em_servico' || o.status === 'para_fazer').length;
  const { todayStr } = useCurrentDate();
  const todayAptsCount = appointments.filter(a => a.date === todayStr && a.status !== 'cancelado').length;

  const navigateTo = (mod: AppModule) => {
    setActiveModule(mod);
    setShowMoreMenu(false);
    setShowQuickMenu(false);
  };

  type MenuEntry = {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    module?: AppModule;
    badge?: string;
    count?: number;
    danger?: boolean;
    onClick?: () => void;
  };

  const openSupport = (message: string) => {
    setShowMoreMenu(false);
    window.open(
      buildWhatsappLink(settings.whatsapp || settings.phone, message),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleInstallApp = async () => {
    setShowMoreMenu(false);
    if (isInstallable) {
      await install();
      return;
    }
    if (isIOS) {
      await alertDialog('No iPhone/iPad: toque em Compartilhar → Adicionar à Tela de Início.', {
        title: 'Instalar o app'
      });
      return;
    }
    await alertDialog('Abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.', {
      title: 'Instalar o app'
    });
  };

  const menuSections: { title: string; items: MenuEntry[] }[] = [
    {
      title: 'Operação',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
        { key: 'patio', label: 'Pátio', icon: Car, module: 'patio' },
        { key: 'ordens', label: 'Ordem de Serviço', icon: ClipboardList, module: 'ordens' },
        { key: 'agenda', label: 'Agenda', icon: Calendar, module: 'agenda', count: todayAptsCount },
        { key: 'orcamentos', label: 'Orçamentos', icon: FileText, module: 'orcamentos' },
        { key: 'servicos', label: 'Serviços', icon: Wrench, module: 'servicos' },
        { key: 'vitrine', label: 'Vitrine Online', icon: Store, module: 'vitrine', badge: 'NOVO' },
      ],
    },
    {
      title: 'Clientes',
      items: [
        { key: 'clientes', label: 'Clientes', icon: Users, module: 'clientes' },
        { key: 'posvenda', label: 'Pós-Venda', icon: Gift, module: 'posvenda' },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { key: 'financeiro', label: 'Finanças', icon: DollarSign, module: 'financeiro' },
        { key: 'metas', label: 'Metas', icon: Target, module: 'metas', badge: 'NOVO' },
        { key: 'relatorios', label: 'Relatórios', icon: BarChart3, module: 'relatorios' },
        { key: 'funcionarios', label: 'Funcionários', icon: UserCheck, module: 'funcionarios', badge: 'NOVO' },
      ],
    },
    {
      title: 'Outros módulos',
      items: [
        { key: 'whatsapp', label: 'Mensagens WhatsApp', icon: MessageCircle, module: 'mensagens' },
        { key: 'permissions', label: 'Permissões', icon: ShieldCheck, module: 'permissions' },
      ],
    },
    {
      title: 'Suporte & Recursos',
      items: [
        { key: 'instalar', label: 'Instalar o App', icon: Smartphone, onClick: handleInstallApp },
        {
          key: 'tutoriais',
          label: 'Tutoriais',
          icon: PlayCircle,
          onClick: () => openSupport('Olá! Gostaria de acessar os tutoriais do sistema.'),
        },
        {
          key: 'grupo',
          label: 'Grupo no WhatsApp',
          icon: MessageCircle,
          onClick: () => openSupport('Olá! Quero participar do grupo no WhatsApp.'),
        },
        {
          key: 'suporte',
          label: 'Suporte',
          icon: PhoneCall,
          onClick: () => openSupport('Olá! Preciso de suporte no sistema PK Detail.'),
        },
      ],
    },
    {
      title: 'Minha Conta',
      items: [
        { key: 'empresa', label: 'Minha Empresa', icon: Building2, module: 'empresa' },
        {
          key: 'sair',
          label: 'Sair',
          icon: LogOut,
          danger: true,
          onClick: () => {
            setShowMoreMenu(false);
            logoutOperator();
          },
        },
      ],
    },
  ];

  const visibleMenuSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.module || canAccessModule(item.module)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* FIXED BOTTOM NAVIGATION BAR (Mobile < md) */}
      <nav
        aria-label="Navegação principal mobile"
        className="mobile-bottom-nav no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden safe-area-bottom"
      >
        <div className="grid grid-cols-5 items-center h-[56px] px-1 sm:px-2">
          {/* 1. DASHBOARD */}
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center py-0.5 relative transition-colors ${
              activeModule === 'dashboard' ? 'text-[#EA580C] font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">Dashboard</span>
          </button>

          {/* 2. PÁTIO */}
          <button
            type="button"
            onClick={() => navigateTo('patio')}
            className={`min-h-[44px] flex flex-col items-center justify-center py-0.5 relative transition-colors ${
              activeModule === 'patio' ? 'text-[#EA580C] font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <Car className="w-5 h-5 stroke-[2.2]" />
              {activeBikesCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#EA580C] text-white text-[10px] font-extrabold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                  {activeBikesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">Pátio</span>
          </button>

          {/* 3. ELEVATED CENTRAL (+) QUICK ACTION BUTTON */}
          {canQuickAction && (
            <div className="flex justify-center -mt-4">
              <button
                type="button"
                onClick={toggleQuickMenu}
                aria-expanded={showQuickMenu}
                className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform border-[3px] border-white hover:scale-105 active:scale-95 ${
                  showQuickMenu
                    ? 'bg-[#9A3412] text-white shadow-orange-500/40'
                    : 'bg-gradient-to-tr from-[#9A3412] to-[#EA580C] text-white shadow-orange-500/35'
                }`}
                title={showQuickMenu ? 'Fechar ações rápidas' : 'Nova Ação Rápida'}
                aria-label={showQuickMenu ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
              >
                {showQuickMenu ? <X className="w-6 h-6 stroke-[3]" /> : <Plus className="w-6 h-6 stroke-[3]" />}
              </button>
            </div>
          )}

          {/* 4. AGENDA */}
          <button
            type="button"
            onClick={() => navigateTo('agenda')}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 relative transition-colors ${
              activeModule === 'agenda' ? 'text-[#EA580C] font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
              <span className="absolute -top-1.5 -right-2 bg-[#EA580C] text-white text-[10px] font-extrabold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                {todayAptsCount}
              </span>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">Agenda</span>
          </button>

          {/* 5. MAIS MENU */}
          <button
            type="button"
            onClick={() => {
              setShowQuickMenu(false);
              setShowMoreMenu(true);
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 relative transition-colors ${
              showMoreMenu ? 'text-[#EA580C] font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">Mais</span>
          </button>
        </div>
      </nav>

      {/* RADIAL QUICK ACTIONS (opens from the central + button) */}
      {showQuickMenu && canQuickAdd && (
        <>
          <div
            className={`md:hidden fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[2px] ${
              quickMenuClosing ? 'pk-fade-exit' : 'pk-fade-enter'
            }`}
            onClick={closeQuickMenu}
            aria-hidden="true"
          />

          <div
            className={`md:hidden fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] w-[min(340px,calc(100vw-24px))] flex flex-col gap-2 ${
              quickMenuClosing ? 'pk-quick-panel-exit' : 'pk-quick-panel-enter'
            }`}
          >
            {/* Cada ação em sua própria linha, sem sobreposição */}
            {canAccessModule('ordens') && (
              <button
                type="button"
                onClick={() => runQuickAction('os')}
                className="w-full min-h-[54px] flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-xl shadow-slate-900/12 active:scale-[0.985] transition-transform"
              >
                <span className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </span>
                <span className="text-[13px] font-extrabold text-slate-900 leading-none whitespace-nowrap truncate">
                  Nova OS
                </span>
              </button>
            )}

            {canAccessModule('agenda') && (
              <button
                type="button"
                onClick={() => openModuleWithAction('agenda', 'pk_open_new_appointment', 'pk:new-appointment')}
                className="w-full min-h-[54px] flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-xl shadow-slate-900/12 active:scale-[0.985] transition-transform"
              >
                <span className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </span>
                <span className="text-[13px] font-extrabold text-slate-900 leading-none whitespace-nowrap truncate">
                  Novo Agendamento
                </span>
              </button>
            )}

            {canAccessModule('orcamentos') && (
              <button
                type="button"
                onClick={() => openModuleWithAction('orcamentos', 'pk_open_new_quote', 'pk:new-quote')}
                className="w-full min-h-[54px] flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-xl shadow-slate-900/12 active:scale-[0.985] transition-transform"
              >
                <span className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5 stroke-[2.2]" />
                </span>
                <span className="text-[13px] font-extrabold text-slate-900 leading-none whitespace-nowrap truncate">
                  Novo Orçamento
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {/* MOBILE "MAIS" DRAWER SHEET */}
      {showMoreMenu && (
        <div
          {...overlayProps}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end md:hidden pk-fade-enter"
        >
          <div
            {...modalProps}
            className={`bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh] h-[90dvh] safe-area-bottom pk-sheet-enter ${modalClasses}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <span className="w-10 h-1 rounded-full bg-slate-200" aria-hidden="true" />
            </div>

            {/* Sheet header */}
            <div className="px-4 pb-3 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] font-black tracking-[0.18em] uppercase text-slate-400">
                Mais opções
              </span>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                aria-label="Fechar menu"
                className="min-w-[34px] min-h-[34px] rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto pk-scroll-compact px-4 pb-8 space-y-5">
              {visibleMenuSections.map(section => (
                <div key={section.title} className="space-y-1">
                  <div className="flex items-center gap-2 px-1 pb-0.5">
                    <p className="text-[10px] font-black tracking-[0.18em] uppercase text-slate-400">
                      {section.title}
                    </p>
                    <span className="flex-1 h-px bg-slate-200/80" aria-hidden="true" />
                  </div>

                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isCurrent = item.key === activeModule;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          if (item.onClick) {
                            item.onClick();
                            return;
                          }
                          if (item.module) navigateTo(item.module);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition active:scale-[0.99] min-w-0 min-h-[48px] ${
                          isCurrent
                            ? 'bg-[#EA580C] text-white'
                            : item.danger
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 ${
                            isCurrent ? 'text-slate-900' : item.danger ? 'text-rose-500' : 'text-slate-400'
                          }`}
                        />
                        <span
                          className={`flex-1 text-sm leading-tight truncate ${
                            isCurrent ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.count !== undefined && (
                          <span
                            className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-extrabold shrink-0 flex items-center justify-center tabular-nums ${
                              isCurrent
                                ? 'bg-white text-[#9A3412]'
                                : 'bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA]'
                            }`}
                            title={`${item.count} agendamento(s) hoje`}
                          >
                            {item.count}
                          </span>
                        )}
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
