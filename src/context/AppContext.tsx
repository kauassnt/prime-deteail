import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback, ReactNode } from 'react';
import { INTERNAL_ROUTE_SLUGS, isInternalPath, moduleFromPathname, normalizeSlug, pathForModule } from '../core/appRouter';
import { companyDisplayName } from '../utils/company';

import {
  User,
  UserRole,
  Client,
  Motorcycle,
  ServiceItem,
  Product,
  StockMovement,
  ServiceOrder,
  Appointment,
  Expense,
  CashRegister,
  CommissionRecord,
  LoyaltyCoupon,
  AuditLog,
  CompanySettings,
  OSStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentTransaction,
  WhatsAppAutomationConfig,
  WhatsAppMessageLog,
  CustomerPortalConfig,
  MotoCatalogState,
  MotoCatalogBrand,
  MotoCatalogModel,
  MotoCatalogVersion,
  MotoCategory
} from '../types';
import { StorageService, RolePermissions, DEFAULT_ROLE_PERMISSIONS, DEFAULT_PORTAL_CONFIG } from '../services/storageService';
import { playOnlineBookingAlert } from '../services/onlineBookingSound';
import { initInternalRealtime, initPublicRealtime } from '../services/realtimeService';
import { purgeSessionArtifacts } from '../services/privacyCleanup';
import {
  MOTO_CATALOG_STORAGE_KEY,
  FipeSyncProgress,
  upsertCatalogBrand as upsertCatalogBrandHelper,
  toggleCatalogBrandActive as toggleCatalogBrandActiveHelper,
  upsertCatalogModel as upsertCatalogModelHelper,
  toggleCatalogModelActive as toggleCatalogModelActiveHelper,
  syncBrandsFromFipe as syncBrandsFromFipeHelper,
  syncModelsForBrandFromFipe as syncModelsForBrandFromFipeHelper,
  syncYearsForModelFromFipe as syncYearsForModelFromFipeHelper,
  syncFullFipeCatalog as syncFullFipeCatalogHelper,
  clearMotoCatalogCache as clearMotoCatalogCacheHelper
} from '../services/motorcycleCatalogService';
import { INITIAL_WHATSAPP_CONFIG } from '../data/initialData';
import { useCurrentDate, getLocalDateStr, getLocalDateKey, isDateStrInPeriod } from '../utils/dateUtils';
import { buildWhatsappLink, normalizeBrazilWhatsappDigits } from '../utils/whatsappUtils';
import {
  DEFAULT_WASH_DURATION_MINUTES,
  findConflictingAppointment,
  isSlotWithinBusinessHours,
  minutesToTime,
  timeToMinutes
} from '../utils/schedulingUtils';
// Confetti carregado sob demanda: mantém o bundle inicial leve.
type ConfettiModule = { default: (options?: Record<string, unknown>) => unknown };
let confettiModule: Promise<ConfettiModule> | null = null;
function fireConfetti(options: Record<string, unknown>): void {
  confettiModule ??= import('canvas-confetti') as unknown as Promise<ConfettiModule>;
  void confettiModule
    .then(mod => {
      try {
        mod.default(options);
      } catch {
        /* efeito opcional */
      }
    })
    .catch(() => undefined);
}
import {
  ErrorReporter,
  NetworkError,
  sanitizeHttpUrl
} from '../core/errorHandler';
import { brandIdentityEngine } from '../core/brandIdentityEngine';
import {
  clearAuthSession,
  fetchServerSession,
  hasAuthSession,
  logoutOnServer,
  startAuthSession,
  verifyAdminPin,
} from '../utils/authSession';
import { resetRealtime } from '../services/realtimeService';

export type AppModule =
  | 'dashboard'
  | 'patio'
  | 'ordens'
  | 'orcamentos'
  | 'vitrine'
  | 'posvenda'
  | 'metas'
  | 'agenda'
  | 'clientes'
  | 'servicos'
  | 'financeiro'
  | 'funcionarios'
  | 'whatsapp'
  | 'relatorios'
  | 'instalar'
  | 'mensagens'
  | 'suporte'
  | 'empresa'
  | 'permissions';

export interface DashboardKPIs {
  revenueToday: number;
  revenueYesterday: number;
  revenueWeekly: number;
  revenueMonthly: number;
  receivedMonthly: number;
  pendingReceivables: number;
  expensesPaidMonthly: number;
  expensesPendingMonthly: number;
  netProfitMonthly: number;
  profitMarginPercent: number;
  averageTicket: number;
  patioToStart: number;
  patioInService: number;
  patioCompleted: number;
  appointmentsToday: number;
  upcomingAppointments: number;
  overdueOrdersCount: number;
  canceledOrdersCount: number;
}

export interface AppContextType {
  activeModule: AppModule;
  setActiveModule: (m: AppModule) => void;
  users: User[];
  currentUser: User;
  setCurrentUserById: (id: string) => void;
  isSessionLoggedOut: boolean;
  logoutOperator: () => void;
  loginOperator: () => void;
  logAudit: (action: string, moduleName: string, details: string) => void;
  clients: Client[];
  motorcycles: Motorcycle[];
  services: ServiceItem[];
  serviceCategories: string[];
  products: Product[];
  stockMovements: StockMovement[];
  orders: ServiceOrder[];
  appointments: Appointment[];
  expenses: Expense[];
  cashRegister: CashRegister;
  cashHistory: CashRegister[];
  commissions: CommissionRecord[];
  coupons: LoyaltyCoupon[];
  settings: CompanySettings;
  auditLogs: AuditLog[];
  whatsappConfig: WhatsAppAutomationConfig;
  whatsappLogs: WhatsAppMessageLog[];
  activeWhatsappPrompt: WhatsAppMessageLog | null;
  rolePermissions: RolePermissions;
  updateRolePermission: (role: UserRole, module: AppModule, allowed: boolean) => void;
  canAccessModule: (module: AppModule) => boolean;
  hasInternalSiteAccess: boolean;

  // Customer Portal Configuration & Client-Only Isolation
  portalConfig: CustomerPortalConfig;
  updatePortalConfig: (cfg: CustomerPortalConfig) => void;
  resetPortalConfig: () => void;
  isPublicPortalUrl: boolean;
  clientPortalOnly: boolean;
  enterClientOnlyMode: (persistLock?: boolean) => void;
  exitClientOnlyMode: (pin: string) => Promise<boolean>;
  
  // Computed KPIs for dashboard & financial
  kpis: DashboardKPIs;

  // Quick action state
  quickActionOpen: boolean;
  setQuickActionOpen: (open: boolean) => void;
  quickActionType: 'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento' | null;
  quickActionTab: 'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento' | null;
  openQuickAction: (type: 'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento') => void;
  
  // Selected OS for modal/print
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  viewingOrderId: string | null;
  setViewingOrderId: (id: string | null) => void;

  // Global search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Actions
  createOrder: (order: Partial<ServiceOrder> & Omit<ServiceOrder, 'id' | 'commissionCalculated' | 'commissionAmount' | 'commissionPaid' | 'pendingBalance' | 'paymentTransactions'>) => ServiceOrder;
  updateOrder: (orderOrId: ServiceOrder | string, updates?: Partial<ServiceOrder>) => void;
  updateOrderStatus: (orderId: string, newStatus: OSStatus) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
  duplicateOrder: (orderId: string) => void;
  addPaymentToOrder: (
    orderId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string,
    dateISO?: string
  ) => void;
  
  createAppointment: (apt: Omit<Appointment, 'id'>) => Appointment | null;
  updateAppointment: (aptOrId: Appointment | string, updates?: Partial<Appointment>) => void;
  convertAppointmentToOS: (appointmentId: string) => ServiceOrder | null;
  convertAppointmentToOrder: (appointmentId: string) => string | null;
  cancelAppointment: (appointmentId: string) => void;

  createClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitsCount' | 'loyaltyPoints' | 'loyaltyTier' | 'tags'>) => Client;
  updateClient: (clientOrId: Client | string, updates?: Partial<Client>) => void;
  deleteClient: (clientId: string) => void;

  createUser: (user: Omit<User, 'id'>) => User;
  updateUser: (userOrId: User | string, updates?: Partial<User>) => void;
  deleteUser: (userId: string) => boolean;

  createMotorcycle: (moto: Omit<Motorcycle, 'id'>) => Motorcycle;
  updateMotorcycle: (motoOrId: Motorcycle | string, updates?: Partial<Motorcycle>) => void;
  deleteMotorcycle: (motoId: string) => void;

  motoCatalog: MotoCatalogState;
  upsertCatalogBrand: (input: {
    id?: string;
    name: string;
    country?: string;
    brandColor?: string;
    monogram?: string;
    logoUrl?: string;
    active?: boolean;
    isCustom?: boolean;
    popular?: boolean;
  }) => { brand: MotoCatalogBrand; created: boolean };
  toggleCatalogBrandActive: (brandId: string) => void;
  upsertCatalogModel: (input: {
    id?: string;
    brandId: string;
    name: string;
    popularNames?: string[];
    cc: number;
    category: MotoCategory;
    years: number[];
    versions?: MotoCatalogVersion[];
    active?: boolean;
    isCustom?: boolean;
  }) => { model: MotoCatalogModel; created: boolean };
  toggleCatalogModelActive: (modelId: string) => void;
  syncCatalogBrandsFromFipe: () => Promise<{ addedBrands: number; matchedBrands: number; sourceUsed: string }>;
  syncCatalogModelsForBrand: (brandId: string, signal?: AbortSignal) => Promise<{ importedCount: number; brandName: string }>;
  syncCatalogYearsForModel: (modelId: string, signal?: AbortSignal) => Promise<MotoCatalogModel | null>;
  syncFullMotoCatalogFromFipe: (
    onProgress?: (progress: FipeSyncProgress) => void,
    signal?: AbortSignal
  ) => Promise<MotoCatalogState>;
  resetMotoCatalogCache: () => void;

  createService: (srv: Omit<ServiceItem, 'id'>) => ServiceItem;
  updateService: (srvOrId: ServiceItem | string, updates?: Partial<ServiceItem>) => void;
  toggleServiceActive: (serviceId: string) => void;
  deleteService: (serviceId: string) => void;
  addServiceCategory: (name: string) => boolean;
  renameServiceCategory: (oldName: string, newName: string) => boolean;
  deleteServiceCategory: (name: string, fallbackCategory?: string) => boolean;
  reorderServiceCategories: (orderedCategories: string[]) => void;

  createProduct: (prd: Omit<Product, 'id' | 'lastRestockedAt'>) => Product;
  updateProduct: (prdOrId: Product | string, updates?: Partial<Product>) => void;
  restockProduct: (productId: string, quantityToAdd: number, costPrice?: number, supplier?: string) => void;
  recordStockMovement: (productId: string, type: StockMovement['type'], quantity: number, reason: string) => void;
  registerStockMovement: (productId: string, type: StockMovement['type'], quantity: number, reason: string) => void;

  createExpense: (expense: Omit<Expense, 'id'>) => Expense;
  payExpense: (expenseId: string, method: PaymentMethod) => void;
  deleteExpense: (expenseId: string) => void;

  openCashRegister: (initialBalance: number, notes?: string) => void;
  closeCashRegister: (actualCounted: number, notes?: string) => void;
  openCash: (initialBalance: number, notes?: string) => void;
  closeCash: (actualCounted: number, notes?: string) => void;
  addCashMovement: (type: 'suprimento' | 'sangria' | 'despesa', amount: number, method: PaymentMethod, description: string) => void;

  createCommission: (rec: Omit<CommissionRecord, 'id'>) => CommissionRecord;
  updateCommission: (recOrId: CommissionRecord | string, updates?: Partial<CommissionRecord>) => void;
  deleteCommission: (id: string) => void;
  approveCommission: (id: string) => void;
  payCommission: (id: string) => void;

  createCoupon: (cpn: Omit<LoyaltyCoupon, 'id' | 'timesUsed'>) => LoyaltyCoupon;
  toggleCoupon: (couponId: string) => void;
  toggleCouponActive: (couponId: string) => void;

  updateSettings: (s: CompanySettings) => void;
  updateWhatsappConfig: (cfg: WhatsAppAutomationConfig) => void;
  resetWhatsappConfig: () => void;
  sendWhatsappForOrderStatus: (orderId: string, statusOverride?: OSStatus, customMessage?: string) => WhatsAppMessageLog | null;
  logManualWhatsappMessage: (payload: {
    clientId: string;
    clientName: string;
    clientPhone: string;
    orderId?: string;
    templateLabel: string;
    message: string;
    whatsappUrl: string;
  }) => WhatsAppMessageLog;
  markWhatsappLogSent: (logId: string) => void;
  retryWhatsappWebhook: (logId: string) => Promise<boolean>;
  clearWhatsappLogs: () => void;
  dismissWhatsappPrompt: () => void;
  resetDatabase: () => void;
  restoreDatabase: (json: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState(() => StorageService.loadAll());
  // Módulo inicial vem da URL (ex.: /relatorios) para permitir link direto e recarregar.
  const [activeModule, setActiveModuleState] = useState<AppModule>(
    () => moduleFromPathname(typeof window === 'undefined' ? '/' : window.location.pathname) ?? 'dashboard'
  );
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento' | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWhatsappPrompt, setActiveWhatsappPrompt] = useState<WhatsAppMessageLog | null>(null);
  const { now: liveNow, todayStr, yesterdayStr } = useCurrentDate();

  // Espelho dos agendamentos atuais, usado para detectar reservas novas vindas de outra aba.
  const appointmentsRef = useRef(data.appointments);
  appointmentsRef.current = data.appointments;

  const [kioskClientOnly, setKioskClientOnly] = useState<boolean>(() => StorageService.getClientOnlyLock());
  // A tela de login é exibida quando não há sessão ativa nesta aba.
  const [isSessionLoggedOut, setIsSessionLoggedOut] = useState<boolean>(() => !hasAuthSession());

  // Navegação por URL (History API): cada módulo tem seu caminho, ex. /relatorios.
  const setActiveModule = useCallback((next: AppModule) => {
    setActiveModuleState(next);
    if (typeof window === 'undefined' || !isInternalPath(window.location.pathname)) return;
    const target = pathForModule(next);
    if (window.location.pathname.replace(/\/+$/, '') === target) return;
    window.history.pushState({ module: next }, '', target);
  }, []);

  // Voltar/avançar do navegador troca o módulo ativo. Se o histórico apontar
  // para um caminho desconhecido, a URL volta para o módulo atual.
  const activeModuleRef = useRef(activeModule);
  activeModuleRef.current = activeModule;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const moduleFromUrl = moduleFromPathname(window.location.pathname);
      if (moduleFromUrl) {
        setActiveModuleState(moduleFromUrl);
        return;
      }
      window.history.replaceState(null, '', pathForModule(activeModuleRef.current));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A sessão real vive no servidor (cookie HttpOnly). O cache local é só uma pista.
  useEffect(() => {
    let cancelled = false;
    void fetchServerSession().then(result => {
      if (cancelled) return;
      if (result.authenticated && result.user) {
        const serverUser = result.user;
        StorageService.saveCurrentUserId(serverUser.id);
        setData(prev => (prev.currentUserId === serverUser.id ? prev : { ...prev, currentUserId: serverUser.id }));
        startAuthSession();
        setIsSessionLoggedOut(false);
      } else {
        clearAuthSession();
        setIsSessionLoggedOut(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorageSync = (e: StorageEvent) => {
      // Qualquer dado do app alterado em outra aba/dispositivo entra aqui:
      // OS, despesas, clientes, agenda, caixa... tudo fica sincronizado em tempo real.
      const shouldSync = Boolean(
        e.key &&
          (e.key.startsWith('pk_detail_') || e.key === MOTO_CATALOG_STORAGE_KEY)
      );
      if (!shouldSync) return;

      const fresh = StorageService.loadAll();
      if (e.key === 'pk_detail_appointments_v1') {
        // Vitrine aberta em outra aba/dispositivo: toca o alerta para cada reserva online nova.
        const knownIds = new Set(appointmentsRef.current.map(apt => apt.id));
        if (fresh.appointments.some(apt => apt.isOnlineBooking && !knownIds.has(apt.id))) {
          playOnlineBookingAlert();
        }
      }
      setData(prev => ({ ...prev, ...fresh }));
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Tempo real entre dispositivos: hidrata do servidor e escuta alterações via SSE.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    const params = new URLSearchParams(window.location.search);
    const explicitPortal =
      params.get('portal') === '1' ||
      params.get('portal') === 'true' ||
      params.get('cliente') === '1' ||
      params.get('modo') === 'cliente' ||
      window.location.hash === '#portal';
    const portalSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    // Rotas internas (/dashboard, /mensagens, ...) NUNCA são o portal público.
    // Sem esta checagem, recarregar uma página interna iniciava o modo público
    // e o app parava de publicar as alterações no Supabase.
    const configuredSlug = normalizeSlug(data.portalConfig?.storefront?.slug || '');
    const companySlug = normalizeSlug(companyDisplayName(data.settings));
    const publicView =
      explicitPortal ||
      (!isInternalPath(window.location.pathname) &&
        /^[a-z0-9][a-z0-9-]{2,39}$/.test(portalSlug) &&
        (portalSlug === configuredSlug || portalSlug === companySlug));

    const handleRealtimeSync = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys || [];
      const fresh = StorageService.loadAll();
      if (keys.includes('pk_detail_appointments_v1')) {
        const knownIds = new Set(appointmentsRef.current.map(apt => apt.id));
        if (fresh.appointments.some(apt => apt.isOnlineBooking && !knownIds.has(apt.id))) {
          playOnlineBookingAlert();
        }
      }
      if (!disposed) {
        setData(prev => ({ ...prev, ...fresh }));
      }
    };

    window.addEventListener('pk:realtime-state', handleRealtimeSync);
    if (publicView) {
      void initPublicRealtime();
    } else if (!isSessionLoggedOut) {
      void initInternalRealtime(() => {
        StorageService.saveAll(StorageService.loadAll());
      });
    }

    return () => {
      disposed = true;
      window.removeEventListener('pk:realtime-state', handleRealtimeSync);
    };
  }, [isSessionLoggedOut]);

  const isPublicPortalUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('portal') === '1' ||
      params.get('portal') === 'true' ||
      params.get('cliente') === '1' ||
      params.get('modo') === 'cliente' ||
      window.location.hash === '#portal'
    ) {
      return true;
    }
    // Link da Vitrine: /<slug> abre o portal público (ex.: /pk-detail).
    // Rotas internas (/relatorios, /login, ...) nunca são tratadas como portal,
    // e um slug qualquer desconhecido também não: só o slug configurado da
    // Vitrine (ou o nome da empresa) abre o portal. Assim /qualquer-coisa cai
    // no redirecionamento interno em vez de virar portal.
    const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (INTERNAL_ROUTE_SLUGS.has(slug)) return false;
    const configuredSlug = normalizeSlug(data.portalConfig?.storefront?.slug || '');
    const companySlug = normalizeSlug(companyDisplayName(data.settings));
    const isConfiguredStoreLink = slug === configuredSlug || slug === companySlug;
    return isConfiguredStoreLink && /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug);
  }, [data.portalConfig?.storefront?.slug, data.settings]);

  useEffect(() => {
    void brandIdentityEngine.refresh();
  }, []);

  // Active user
  const currentUser = data.users.find(u => u.id === data.currentUserId) || data.users[0];
  const rolePermissions = data.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
  const portalConfig = data.portalConfig || DEFAULT_PORTAL_CONFIG;

  const canAccessModule = (module: AppModule): boolean => {
    if (module === 'permissions') {
      return currentUser.role === 'admin';
    }
    if (currentUser.role === 'admin') return true;
    const perms = rolePermissions[currentUser.role];
    if (!perms) return true;
    return perms[module] !== false;
  };


  const INTERNAL_MODULES: AppModule[] = [
    'dashboard',
    'patio',
    'ordens',
    'orcamentos',
    'vitrine',
    'posvenda',
    'metas',
    'agenda',
    'clientes',
    'servicos',
    'financeiro',
    'funcionarios',
    'whatsapp',
    'relatorios',
    'instalar',
    'mensagens',
    'suporte',
    'empresa',
    'permissions',
  ];

  const hasInternalSiteAccess =
    currentUser.role === 'admin' || INTERNAL_MODULES.some(m => canAccessModule(m));

  const clientPortalOnly = isPublicPortalUrl || kioskClientOnly || !hasInternalSiteAccess;

  const enterClientOnlyMode = (persistLock = true) => {
    setKioskClientOnly(true);
    if (persistLock) {
      StorageService.setClientOnlyLock(true);
    }
    logAudit('ATIVAR_MODO_CLIENTE', 'Portal do Cliente', 'Modo exclusivo do cliente ativado (site interno isolado)');
  };

  const exitClientOnlyMode = async (pin: string): Promise<boolean> => {
    const expectedPin = (portalConfig.kioskPin || '1234').trim();
    const localOk = pin.trim() === expectedPin;
    // Revalidação no servidor para operações críticas (quando há sessão ativa).
    const serverOk = localOk ? false : await verifyAdminPin(pin);
    if (!localOk && !serverOk) {
      return false;
    }
    setKioskClientOnly(false);
    StorageService.setClientOnlyLock(false);
    // If the currently active user has zero internal access, switch back to primary admin upon valid Admin PIN
    if (!hasInternalSiteAccess) {
      const adminUser = data.users.find(u => u.role === 'admin' && u.active) || data.users[0];
      if (adminUser) {
        setCurrentUserById(adminUser.id);
      }
    }
    logAudit('DESBLOQUEAR_MODO_ADMIN', 'Portal do Cliente', 'Saída do modo exclusivo do cliente via PIN administrativo');
    return true;
  };

  const updatePortalConfig = (cfg: CustomerPortalConfig) => {
    setData(prev => {
      StorageService.savePortalConfig(cfg);
      return { ...prev, portalConfig: cfg };
    });
    logAudit('CONFIGURAR_PORTAL', 'Portal do Cliente', `Configurações do Portal do Cliente atualizadas (${cfg.portalEnabled ? 'Ativo' : 'Pausado'})`);
  };

  const resetPortalConfig = () => {
    setData(prev => {
      StorageService.savePortalConfig(DEFAULT_PORTAL_CONFIG);
      return { ...prev, portalConfig: DEFAULT_PORTAL_CONFIG };
    });
    logAudit('RESTAURAR_PORTAL', 'Portal do Cliente', 'Configurações do Portal do Cliente restauradas para o padrão');
  };

  const updateRolePermission = (role: UserRole, module: AppModule, allowed: boolean) => {
    setData(prev => {
      const currentPerms = prev.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
      const updatedPerms = {
        ...currentPerms,
        [role]: {
          ...(currentPerms[role] || {}),
          [module]: allowed
        }
      };
      StorageService.saveRolePermissions(updatedPerms);
      return { ...prev, rolePermissions: updatedPerms };
    });
    logAudit('ATUALIZAR_PERMISSAO', 'Configurações', `Permissão do cargo ${role} para o módulo ${module} alterada para ${allowed ? 'Permitido' : 'Bloqueado'}`);
  };

  const logAudit = (action: string, moduleName: string, details: string) => {
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module: moduleName,
      details
    };
    const updated = [newLog, ...data.auditLogs].slice(0, 200);
    setData(prev => {
      const next = { ...prev, auditLogs: updated };
      StorageService.saveAuditLogs(updated);
      return next;
    });
  };

  const openQuickAction = (type: 'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento') => {
    setQuickActionType(type);
    setQuickActionOpen(true);
  };

  const setCurrentUserById = (id: string) => {
    setData(prev => {
      StorageService.saveCurrentUserId(id);
      return { ...prev, currentUserId: id };
    });
    const usr = data.users.find(u => u.id === id);
    if (usr) {
      logAudit('LOGIN_OPERADOR', 'Sistema', `Operador alternado para ${usr.name} (${usr.role})`);
    }
    void brandIdentityEngine.refresh();
  };

  const logoutOperator = () => {
    setIsSessionLoggedOut(true);
    clearAuthSession();
    resetRealtime();
    void logoutOnServer();
    logAudit('LOGOUT_OPERADOR', 'Sistema', `Sessão encerrada por ${currentUser.name}`);
    void purgeSessionArtifacts();
  };

  const loginOperator = () => {
    setIsSessionLoggedOut(false);
    startAuthSession();
    void brandIdentityEngine.refresh();
  };

  // --- DYNAMIC KPIS (Auto-updates when day changes) ---
  const kpis: DashboardKPIs = useMemo(() => {
    const today = todayStr;
    const yesterday = yesterdayStr;
    const activeOrders = data.orders.filter(o => o.status !== 'cancelado');

    const revenueToday = activeOrders
      .filter(o => getLocalDateKey(o.entryDateTime) === today)
      .reduce((sum, o) => sum + o.total, 0);

    const revenueYesterday = activeOrders
      .filter(o => getLocalDateKey(o.entryDateTime) === yesterday)
      .reduce((sum, o) => sum + o.total, 0);

    const revenueWeekly = activeOrders
      .filter(o => isDateStrInPeriod(o.entryDateTime, '7dias', liveNow))
      .reduce((sum, o) => sum + o.total, 0);

    const monthlyOrders = activeOrders.filter(o => isDateStrInPeriod(o.entryDateTime, 'mes_atual', liveNow));
    const revenueMonthly = monthlyOrders.reduce((sum, o) => sum + o.total, 0);
    const receivedMonthly = monthlyOrders.reduce((sum, o) => sum + o.amountPaid, 0);
    const pendingReceivables = monthlyOrders.reduce((sum, o) => sum + o.pendingBalance, 0);

    const monthlyExpenses = data.expenses.filter(e =>
      isDateStrInPeriod(e.paymentDate || e.dueDate, 'mes_atual', liveNow)
    );
    const expensesPaidMonthly = monthlyExpenses
      .filter(e => e.status === 'pago')
      .reduce((sum, e) => sum + e.amount, 0);

    const expensesPendingMonthly = monthlyExpenses
      .filter(e => e.status === 'pendente')
      .reduce((sum, e) => sum + e.amount, 0);

    const netProfitMonthly = receivedMonthly - expensesPaidMonthly;
    const profitMarginPercent = revenueMonthly > 0
      ? Math.round((netProfitMonthly / revenueMonthly) * 100)
      : 0;

    const averageTicket = monthlyOrders.length > 0
      ? Math.round(revenueMonthly / monthlyOrders.length)
      : 0;

    const patioToStart = data.orders.filter(o => o.status === 'para_fazer').length;
    const patioInService = data.orders.filter(o => o.status === 'em_servico').length;
    const patioCompleted = data.orders.filter(o => o.status === 'concluido').length;

    const appointmentsToday = data.appointments.filter(a => a.date === today && a.status !== 'cancelado').length;
    const upcomingAppointments = data.appointments.filter(a => a.date >= today && a.status !== 'cancelado').length;

    const overdueOrdersCount = data.orders.filter(o => {
      if (o.status === 'concluido' || o.status === 'entregue' || o.status === 'cancelado') return false;
      if (!o.promisedDateTime) return false;
      return new Date(o.promisedDateTime).getTime() < Date.now();
    }).length;

    const canceledOrdersCount = data.orders.filter(o => o.status === 'cancelado').length;

    return {
      revenueToday,
      revenueYesterday,
      revenueWeekly,
      revenueMonthly,
      receivedMonthly,
      pendingReceivables,
      expensesPaidMonthly,
      expensesPendingMonthly,
      netProfitMonthly,
      profitMarginPercent,
      averageTicket,
      patioToStart,
      patioInService,
      patioCompleted,
      appointmentsToday,
      upcomingAppointments,
      overdueOrdersCount,
      canceledOrdersCount
    };
  }, [data.orders, data.expenses, data.appointments, todayStr, yesterdayStr, liveNow]);

  // --- ORDER OPERATIONS ---
  const createOrder = (orderInput: Partial<ServiceOrder> & Omit<ServiceOrder, 'id' | 'commissionCalculated' | 'commissionAmount' | 'commissionPaid' | 'pendingBalance' | 'paymentTransactions'>): ServiceOrder => {
    const nextSeq = data.orders.length + 1;
    const year = new Date().getFullYear();
    const id = `OS-${year}-${String(nextSeq).padStart(3, '0')}`;
    
    const total = orderInput.total || 0;
    const employee = data.users.find(u => u.id === orderInput.assignedEmployeeId);
    const commissionsEnabled = data.settings.commissionsEnabled !== false;
    let commissionAmount = 0;
    if (commissionsEnabled && employee && employee.commissionType === 'percent') {
      commissionAmount = (total * employee.commissionValue) / 100;
    } else if (commissionsEnabled && employee && employee.commissionType === 'fixed') {
      commissionAmount = employee.commissionValue;
    }

    const rawTxs = orderInput.paymentTransactions || [];
    const paymentTransactions = rawTxs.map(tx => ({
      ...tx,
      serviceOrderId: id
    }));
    const actualAmountPaid = paymentTransactions.reduce((sum, t) => sum + t.amount, 0) || orderInput.amountPaid || 0;
    const finalPending = Math.max(0, total - actualAmountPaid);
    const finalPaymentStatus: PaymentStatus = finalPending === 0 ? 'pago' : actualAmountPaid > 0 ? 'parcial' : 'pendente';


    const newOrder: ServiceOrder = {
      id,
      clientId: orderInput.clientId || '',
      clientName: orderInput.clientName || '',
      clientPhone: orderInput.clientPhone || '',
      clientWhatsapp: orderInput.clientWhatsapp || '',
      motorcycleId: orderInput.motorcycleId || '',
      motorcycleBrand: orderInput.motorcycleBrand || '',
      motorcycleModel: orderInput.motorcycleModel || '',
      motorcycleVersion: orderInput.motorcycleVersion,
      motorcycleYear: orderInput.motorcycleYear,
      motorcycleCategory: orderInput.motorcycleCategory,
      motorcyclePlate: orderInput.motorcyclePlate || '',
      status: orderInput.status || 'para_fazer',
      paymentStatus: orderInput.paymentStatus || finalPaymentStatus,
      assignedEmployeeId: orderInput.assignedEmployeeId || '',
      assignedEmployeeName: orderInput.assignedEmployeeName || '',
      entryDateTime: orderInput.entryDateTime || new Date().toISOString(),
      services: orderInput.services || [],
      productsConsumed: orderInput.productsConsumed || [],
      subtotal: orderInput.subtotal || total,
      discount: orderInput.discount || 0,
      addition: orderInput.addition || 0,
      total,
      amountPaid: actualAmountPaid,
      pendingBalance: finalPending,
      paymentTransactions: paymentTransactions.length > 0 ? paymentTransactions : (actualAmountPaid > 0 ? [{
        id: `tx_${Date.now()}`,
        serviceOrderId: id,
        amount: actualAmountPaid,
        method: 'pix' as const,
        date: new Date().toISOString(),
        operatorName: currentUser.name,
        status: 'confirmado' as const
      }] : []),
      checklist: orderInput.checklist || {
        entryDate: new Date().toISOString(),
        fuelLevel: '1/2',
        accessoriesLeft: [],
        items: []
      },
      photosBefore: orderInput.photosBefore || [],
      photosAfter: orderInput.photosAfter || [],
      notes: orderInput.notes || '',
      commissionCalculated: true,
      commissionAmount,
      commissionPaid: false
    };

    // Auto deduct stock if configured
    if (data.settings.autoStockDeduction && orderInput.productsConsumed && orderInput.productsConsumed.length > 0) {
      const updatedProducts = [...data.products];
      const newMovements: StockMovement[] = [];

      orderInput.productsConsumed.forEach(pc => {
        const pIndex = updatedProducts.findIndex(p => p.id === pc.productId);
        if (pIndex >= 0) {
          const prevQty = updatedProducts[pIndex].currentQuantity;
          const newQty = Math.max(0, prevQty - pc.quantity);
          updatedProducts[pIndex] = { ...updatedProducts[pIndex], currentQuantity: newQty };

          newMovements.push({
            id: `stk_${Date.now()}_${pc.productId}`,
            productId: pc.productId,
            productName: pc.productName,
            type: 'consumo_os',
            quantity: pc.quantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Consumo na ${id}`,
            serviceOrderId: id,
            operatorName: currentUser.name,
            date: new Date().toISOString()
          });
        }
      });

      setData(prev => {
        const nextProducts = updatedProducts;
        const nextMovements = [...newMovements, ...prev.stockMovements];
        StorageService.saveProducts(nextProducts);
        StorageService.saveStockMovements(nextMovements);
        return { ...prev, products: nextProducts, stockMovements: nextMovements };
      });
    }

    let updatedCash = { ...data.cashRegister };
    if (updatedCash.status === 'aberto' && newOrder.paymentTransactions.length > 0) {
      newOrder.paymentTransactions.forEach(tx => {
        const newCashMov = {
          id: `csh_mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'entrada_os' as const,
          amount: tx.amount,
          paymentMethod: tx.method,
          description: `Recebimento OS ${id} (${newOrder.clientName})`,
          relatedOrderId: id,
          operatorName: currentUser.name
        };
        updatedCash.totalIn += tx.amount;
        if (tx.method === 'dinheiro') updatedCash.expectedBalance += tx.amount;
        updatedCash.movements = [newCashMov, ...updatedCash.movements];
      });
      StorageService.saveCashRegister(updatedCash);
    }

    const updatedOrders = [newOrder, ...data.orders];
    let updatedCommissions = data.commissions;
    if (employee && commissionAmount > 0) {
      const rateLabel =
        employee.commissionType === 'percent'
          ? `${employee.commissionValue}%`
          : `R$ ${employee.commissionValue.toFixed(2)}`;
      const newCommission: CommissionRecord = {
        id: `com_${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        serviceOrderId: id,
        orderNumber: id,
        serviceNames: (orderInput.services || []).map(s => s.serviceName).join(' + ') || 'Serviço PK Detail',
        orderTotal: total,
        commissionRate: rateLabel,
        commissionAmount,
        date: getLocalDateStr(),
        status: 'aprovada'
      };
      updatedCommissions = [newCommission, ...data.commissions];
    }

    setData(prev => {
      StorageService.saveOrders(updatedOrders);
      if (updatedCommissions !== prev.commissions) {
        StorageService.saveCommissions(updatedCommissions);
      }
      return {
        ...prev,
        orders: updatedOrders,
        commissions: updatedCommissions,
        cashRegister: updatedCash
      };
    });

    logAudit('CRIAR_ORDEM_SERVICO', 'Ordens de Serviço', `Criada ordem ${id} para ${newOrder.clientName} (${newOrder.motorcyclePlate})`);
    dispatchAutoWhatsappForOrder(newOrder, newOrder.status);

    try {
      fireConfetti({ particleCount: 30, spread: 60, origin: { y: 0.8 }, disableForReducedMotion: true });
    } catch {}

    return newOrder;
  };

  const getOsStatusLabel = (status: OSStatus): string => {
    switch (status) {
      case 'para_fazer': return 'Aguardando Início';
      case 'em_servico': return 'Em Serviço';
      case 'concluido': return 'Concluído';
      case 'entregue': return 'Entregue';
      case 'cancelado': return 'Cancelado';
    }
  };

  const formatOsWhatsappMessage = (order: ServiceOrder, status: OSStatus, customTemplate?: string): string => {
    const cfg = data.whatsappConfig || INITIAL_WHATSAPP_CONFIG;
    const rawTemplate = customTemplate || cfg.templates?.[status] || INITIAL_WHATSAPP_CONFIG.templates[status];
    const motoDesc = `${order.motorcycleBrand} ${order.motorcycleModel}`.trim();
    const servicosDesc = order.services.map(s => s.serviceName).join(', ') || 'Serviço PK Detail';

    return rawTemplate
      .replace(/\{cliente\}/g, order.clientName)
      .replace(/\{os\}/g, order.id)
      .replace(/\{moto\}/g, motoDesc)
      .replace(/\{placa\}/g, order.motorcyclePlate)
      .replace(/\{servicos\}/g, servicosDesc)
      .replace(/\{total\}/g, order.total.toFixed(2))
      .replace(/\{saldo\}/g, order.pendingBalance.toFixed(2))
      .replace(/\{empresa\}/g, companyDisplayName(data.settings))
      .replace(/\{horario_fechamento\}/g, data.settings.closingTime || '17:00')
      .replace(/\{status\}/g, getOsStatusLabel(status));
  };

  const buildWhatsappDirectLink = (phone: string, message: string): string => {
    return buildWhatsappLink(phone, message);
  };

  const executeWebhookDispatch = async (logEntry: WhatsAppMessageLog, cfg: WhatsAppAutomationConfig): Promise<boolean> => {
    const rawUrl = (cfg.webhookUrl || '').trim();
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (!safeUrl) {
      const errMsg = rawUrl
        ? 'URL do Webhook inválida (apenas HTTP/HTTPS permitido).'
        : 'URL do Webhook / API WhatsApp não configurada.';
      setData(prev => {
        const updated = (prev.whatsappLogs || []).map(l =>
          l.id === logEntry.id ? { ...l, deliveryStatus: 'erro' as const, errorMessage: errMsg } : l
        );
        StorageService.saveWhatsappLogs(updated);
        return { ...prev, whatsappLogs: updated };
      });
      setActiveWhatsappPrompt(prev =>
        !prev || prev.id === logEntry.id ? { ...logEntry, deliveryStatus: 'erro', errorMessage: errMsg } : prev
      );
      return false;
    }

    const normalizedPhone = normalizeBrazilWhatsappDigits(logEntry.clientPhone) || logEntry.clientPhone.replace(/\D/g, '');
    const studioWhatsapp = normalizeBrazilWhatsappDigits(data.settings.whatsapp || data.settings.phone);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.webhookToken?.trim()) {
        headers['Authorization'] = `Bearer ${cfg.webhookToken.trim()}`;
      }
      const res = await fetch(safeUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          event: 'os_status_updated',
          orderId: logEntry.orderId,
          status: logEntry.statusTrigger,
          clientId: logEntry.clientId,
          clientName: logEntry.clientName,
          phone: normalizedPhone,
          rawPhone: logEntry.clientPhone,
          studioWhatsapp,
          message: logEntry.message,
          whatsappUrl: logEntry.whatsappUrl,
          timestamp: logEntry.timestamp,
        }),
      });
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status}`, `Webhook retornou HTTP ${res.status}.`, res.status);
      }
      setData(prev => {
        const updated = (prev.whatsappLogs || []).map(l =>
          l.id === logEntry.id ? { ...l, deliveryStatus: 'enviada' as const, errorMessage: undefined } : l
        );
        StorageService.saveWhatsappLogs(updated);
        return { ...prev, whatsappLogs: updated };
      });
      setActiveWhatsappPrompt(prev =>
        prev?.id === logEntry.id ? { ...prev, deliveryStatus: 'enviada', errorMessage: undefined } : prev
      );
      return true;
    } catch (err) {
      ErrorReporter.report(err, { action: 'executeWebhookDispatch', orderId: logEntry.orderId });
      const errMsg = err instanceof Error ? err.message : 'Falha na requisição ao webhook';
      setData(prev => {
        const updated = (prev.whatsappLogs || []).map(l =>
          l.id === logEntry.id ? { ...l, deliveryStatus: 'erro' as const, errorMessage: errMsg } : l
        );
        StorageService.saveWhatsappLogs(updated);
        return { ...prev, whatsappLogs: updated };
      });
      setActiveWhatsappPrompt(prev =>
        !prev || prev.id === logEntry.id ? { ...logEntry, deliveryStatus: 'erro', errorMessage: errMsg } : prev
      );
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const sendWhatsappForOrderStatus = (
    orderId: string,
    statusOverride?: OSStatus,
    customMessage?: string,
    targetOrderOverride?: ServiceOrder
  ): WhatsAppMessageLog | null => {
    const order = targetOrderOverride || data.orders.find(o => o.id === orderId);
    if (!order) return null;

    const status = statusOverride || order.status;
    const cfg = data.whatsappConfig || INITIAL_WHATSAPP_CONFIG;
    const phone = order.clientWhatsapp || order.clientPhone || '';
    const message = customMessage ?? formatOsWhatsappMessage(order, status);
    const whatsappUrl = buildWhatsappDirectLink(phone, message);
    const hasWebhookUrl = Boolean(cfg.webhookUrl?.trim());
    const hasValidPhone = whatsappUrl !== '#';

    let initialStatus: WhatsAppMessageLog['deliveryStatus'] = 'pronta_para_envio';
    let initialError: string | undefined;

    if (!hasValidPhone) {
      initialStatus = 'erro';
      initialError = 'Telefone/WhatsApp do cliente inválido ou sem DDD.';
    } else if (cfg.deliveryMode === 'webhook_api') {
      if (hasWebhookUrl) {
        initialStatus = 'enviando';
      } else {
        initialStatus = 'erro';
        initialError = 'Modo Webhook ativo, mas sem URL configurada. Use "Enviar no WhatsApp" ou configure a URL.';
      }
    }

    const logEntry: WhatsAppMessageLog = {
      id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orderId: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: phone,
      statusTrigger: status,
      templateLabel: `Status OS: ${getOsStatusLabel(status)}`,
      message,
      whatsappUrl,
      mode: cfg.deliveryMode,
      deliveryStatus: initialStatus,
      errorMessage: initialError,
      timestamp: new Date().toISOString(),
    };

    setData(prev => {
      const updated = [logEntry, ...(prev.whatsappLogs || [])].slice(0, 150);
      StorageService.saveWhatsappLogs(updated);
      return { ...prev, whatsappLogs: updated };
    });

    setActiveWhatsappPrompt(logEntry);

    if (hasValidPhone && cfg.deliveryMode === 'webhook_api' && hasWebhookUrl) {
      void executeWebhookDispatch(logEntry, cfg);
    }

    return logEntry;
  };

  const dispatchAutoWhatsappForOrder = (order: ServiceOrder, newStatus: OSStatus) => {
    const cfg = data.whatsappConfig || INITIAL_WHATSAPP_CONFIG;
    if (!cfg.autoSendOnStatusChange) return;
    if (!cfg.enabledStatuses?.[newStatus]) return;

    const logEntry = sendWhatsappForOrderStatus(order.id, newStatus, undefined, order);
    if (logEntry) {
      logAudit('WHATSAPP_STATUS_OS', 'WhatsApp', `Disparo de status "${newStatus}" para ${order.clientName} (${order.id})`);
    }
  };

  const updateOrder = (orderOrId: ServiceOrder | string, updates?: Partial<ServiceOrder>) => {
    const commissionsEnabled = data.settings.commissionsEnabled !== false;
    const commissionUpdates: { order: ServiceOrder; amount: number; rate: string }[] = [];

    const updated = data.orders.map(o => {
      let next = o;
      if (typeof orderOrId === 'string') {
        if (o.id === orderOrId && updates) next = { ...o, ...updates };
      } else if (o.id === orderOrId.id) {
        next = { ...o, ...orderOrId };
      }
      if (next === o) return o;

      // O valor da OS mudou e o chamador não recalculou o saldo: refaz pela
      // soma dos pagamentos confirmados, para "A receber" não ficar defasado.
      if (
        typeof orderOrId === 'string' &&
        updates &&
        next.total !== o.total &&
        updates.pendingBalance === undefined
      ) {
        const confirmedTotal = (next.paymentTransactions || [])
          .filter(tx => tx.status === 'confirmado')
          .reduce((sum, tx) => sum + tx.amount, 0);
        const paid = (next.paymentTransactions || []).length > 0 ? confirmedTotal : next.amountPaid || 0;
        const pending = Math.max(0, next.total - paid);
        next = {
          ...next,
          amountPaid: paid,
          pendingBalance: pending,
          paymentStatus: pending <= 0.005 ? 'pago' : paid > 0 ? 'parcial' : 'pendente',
        };
      }

      // Valor ou responsável mudou: a comissão precisa acompanhar a OS.
      if (next.total === o.total && next.assignedEmployeeId === o.assignedEmployeeId) return next;

      const employee = data.users.find(u => u.id === next.assignedEmployeeId);
      let amount = 0;
      let rate = '—';
      if (commissionsEnabled && employee && employee.commissionType === 'percent') {
        amount = (next.total * employee.commissionValue) / 100;
        rate = `${employee.commissionValue}%`;
      } else if (commissionsEnabled && employee && employee.commissionType === 'fixed') {
        amount = employee.commissionValue;
        rate = `R$ ${employee.commissionValue.toFixed(2)}`;
      }

      const adjusted: ServiceOrder = { ...next, commissionAmount: amount, commissionCalculated: true };
      commissionUpdates.push({ order: adjusted, amount, rate });
      return adjusted;
    });

    let updatedCommissions = data.commissions;
    commissionUpdates.forEach(({ order, amount, rate }) => {
      const existing = updatedCommissions.find(c => c.serviceOrderId === order.id);
      const serviceNames = order.services.map(s => s.serviceName).join(' + ') || 'Serviço PK Detail';

      if (amount > 0) {
        if (existing) {
          updatedCommissions = updatedCommissions.map(c =>
            c.id === existing.id
              ? {
                  ...c,
                  employeeId: order.assignedEmployeeId,
                  employeeName: order.assignedEmployeeName || c.employeeName,
                  orderTotal: order.total,
                  commissionRate: rate,
                  commissionAmount: amount,
                  serviceNames,
                }
              : c
          );
        } else {
          updatedCommissions = [
            {
              id: `com_${Date.now()}_${order.id}`,
              employeeId: order.assignedEmployeeId,
              employeeName: order.assignedEmployeeName || 'Funcionário',
              serviceOrderId: order.id,
              orderNumber: order.id,
              serviceNames,
              orderTotal: order.total,
              commissionRate: rate,
              commissionAmount: amount,
              date: getLocalDateStr(),
              status: 'aprovada',
            },
            ...updatedCommissions,
          ];
        }
      } else if (existing) {
        updatedCommissions = updatedCommissions.filter(c => c.id !== existing.id);
      }
    });

    setData(prev => {
      StorageService.saveOrders(updated);
      if (updatedCommissions !== prev.commissions) StorageService.saveCommissions(updatedCommissions);
      return { ...prev, orders: updated, commissions: updatedCommissions };
    });
  };

  const updateOrderStatus = (orderId: string, newStatus: OSStatus) => {
    const existing = data.orders.find(o => o.id === orderId);
    const updatedFields: Partial<ServiceOrder> = {
      status: newStatus,
      completedDateTime: newStatus === 'concluido' ? new Date().toISOString() : existing?.completedDateTime,
      deliveredDateTime: newStatus === 'entregue' ? new Date().toISOString() : existing?.deliveredDateTime,
    };
    updateOrder(orderId, updatedFields);
    // Pós-Venda depende da data do último atendimento: sincroniza o cadastro do cliente.
    if (existing && (newStatus === 'concluido' || newStatus === 'entregue')) {
      const client = data.clients.find(c => c.id === existing.clientId);
      const visitKey = getLocalDateKey(
        newStatus === 'entregue' ? updatedFields.deliveredDateTime : updatedFields.completedDateTime
      );
      if (client && visitKey) {
        const currentKey = client.lastVisitDate ? getLocalDateKey(client.lastVisitDate) : '';
        const firstConclusion = existing.status !== 'concluido' && existing.status !== 'entregue';
        updateClient(client.id, {
          lastVisitDate: visitKey > currentKey ? visitKey : client.lastVisitDate,
          visitsCount: firstConclusion ? client.visitsCount + 1 : client.visitsCount,
        });
      }
    }
    logAudit('ALTERAR_STATUS_OS', 'Pátio', `Status da ordem ${orderId} alterado para "${newStatus}"`);
    if (existing && existing.status !== newStatus) {
      dispatchAutoWhatsappForOrder({ ...existing, ...updatedFields }, newStatus);
    }
    if (newStatus === 'concluido') {
      try {
        fireConfetti({ particleCount: 45, spread: 70, origin: { y: 0.7 }, disableForReducedMotion: true });
      } catch {}
    }
  };

  const cancelOrder = (orderId: string, reason?: string) => {
    const existing = data.orders.find(o => o.id === orderId);
    const updatedFields: Partial<ServiceOrder> = {
      status: 'cancelado',
      notes: `[Cancelado: ${reason || 'Não especificado'}]`
    };
    updateOrder(orderId, updatedFields);
    logAudit('CANCELAR_ORDEM_SERVICO', 'Ordens de Serviço', `Cancelada ordem ${orderId}`);
    if (existing && existing.status !== 'cancelado') {
      dispatchAutoWhatsappForOrder({ ...existing, ...updatedFields }, 'cancelado');
    }
  };

  const duplicateOrder = (orderId: string) => {
    const original = data.orders.find(o => o.id === orderId);
    if (!original) return;
    // A cópia nasce sem pagamentos: reaproveitar transações duplicaria receita e caixa.
    const {
      paymentTransactions: _ignoredTransactions,
      amountPaid: _ignoredPaid,
      pendingBalance: _ignoredPending,
      paymentStatus: _ignoredStatus,
      ...copy
    } = original;
    createOrder({
      ...copy,
      status: 'para_fazer',
      paymentStatus: 'pendente',
      amountPaid: 0,
      notes: `Duplicada a partir da ${original.id}`
    });
  };

  const addPaymentToOrder = (
    orderId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string,
    dateISO?: string
  ) => {
    const target = data.orders.find(o => o.id === orderId);
    if (!target) return;
    const paidAt = dateISO || new Date().toISOString();

    const newTx: PaymentTransaction = {
      id: `tx_${Date.now()}`,
      serviceOrderId: orderId,
      amount,
      method,
      date: paidAt,
      operatorName: currentUser.name,
      notes,
      status: 'confirmado'
    };

    const newAmountPaid = target.amountPaid + amount;
    const newPendingBalance = Math.max(0, target.total - newAmountPaid);
    const newPaymentStatus: PaymentStatus = newPendingBalance === 0 ? 'pago' : 'parcial';

    const updatedOrders = data.orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          amountPaid: newAmountPaid,
          pendingBalance: newPendingBalance,
          paymentStatus: newPaymentStatus,
          paymentTransactions: [...o.paymentTransactions, newTx]
        };
      }
      return o;
    });

    let updatedCash = { ...data.cashRegister };
    if (updatedCash.status === 'aberto') {
      const newCashMov = {
        id: `csh_mov_${Date.now()}`,
        timestamp: paidAt,
        type: 'entrada_os' as const,
        amount,
        paymentMethod: method,
        description: `Recebimento ${orderId} (${target.clientName})`,
        relatedOrderId: orderId,
        operatorName: currentUser.name
      };
      updatedCash.totalIn += amount;
      if (method === 'dinheiro') updatedCash.expectedBalance += amount;
      updatedCash.movements = [newCashMov, ...updatedCash.movements];
      StorageService.saveCashRegister(updatedCash);
    }

    setData(prev => {
      StorageService.saveOrders(updatedOrders);
      return {
        ...prev,
        orders: updatedOrders,
        cashRegister: updatedCash
      };
    });

    logAudit('REGISTRAR_PAGAMENTO', 'Financeiro', `Recebimento de R$ ${amount.toFixed(2)} via ${method} para ${orderId}`);
    try {
      fireConfetti({ particleCount: 30, spread: 50, origin: { y: 0.6 }, disableForReducedMotion: true });
    } catch {}
  };

  // --- APPOINTMENTS ---
  const createAppointment = (aptInput: Omit<Appointment, 'id'>): Appointment | null => {
    const startMins = timeToMinutes(aptInput.startTime);
    const blockMinutes = Math.max(
      DEFAULT_WASH_DURATION_MINUTES,
      aptInput.durationMinutes || DEFAULT_WASH_DURATION_MINUTES
    );

    if (startMins < 0 || !isSlotWithinBusinessHours(aptInput.startTime, blockMinutes)) {
      return null;
    }

    const persistedAppointments = StorageService.loadAll().appointments;
    const baseAppointments =
      persistedAppointments.length > 0 || data.appointments.length === 0
        ? persistedAppointments
        : data.appointments;

    if (
      aptInput.status !== 'cancelado' &&
      (findConflictingAppointment(baseAppointments, aptInput.date, aptInput.startTime, blockMinutes) ||
        findConflictingAppointment(data.appointments, aptInput.date, aptInput.startTime, blockMinutes))
    ) {
      if (persistedAppointments !== data.appointments) {
        setData(prev => ({ ...prev, appointments: persistedAppointments }));
      }
      return null;
    }

    const id = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const normalizedEndTime = minutesToTime(startMins + blockMinutes);
    const newApt: Appointment = {
      ...aptInput,
      durationMinutes: blockMinutes,
      endTime: normalizedEndTime,
      id,
    };
    const updated = [newApt, ...baseAppointments];
    setData(prev => {
      StorageService.saveAppointments(updated);
      return { ...prev, appointments: updated };
    });
    logAudit('CRIAR_AGENDAMENTO', 'Agenda', `Agendado para ${aptInput.clientName} em ${aptInput.date} às ${aptInput.startTime}`);
    // Agendamento vindo da vitrine/portal online: aviso sonoro imediato.
    if (aptInput.isOnlineBooking) {
      playOnlineBookingAlert();
    }
    return newApt;
  };

  const updateAppointment = (aptOrId: Appointment | string, updates?: Partial<Appointment>) => {
    const targetId = typeof aptOrId === 'string' ? aptOrId : aptOrId.id;
    const existing = data.appointments.find(a => a.id === targetId);
    if (!existing) return;

    const merged: Appointment =
      typeof aptOrId === 'string'
        ? { ...existing, ...(updates || {}) }
        : { ...existing, ...aptOrId };

    if (merged.status !== 'cancelado') {
      const blockMinutes = Math.max(
        DEFAULT_WASH_DURATION_MINUTES,
        merged.durationMinutes || DEFAULT_WASH_DURATION_MINUTES
      );
      if (!isSlotWithinBusinessHours(merged.startTime, blockMinutes)) return;
      if (findConflictingAppointment(data.appointments, merged.date, merged.startTime, blockMinutes, merged.id)) {
        return;
      }
      const startMins = timeToMinutes(merged.startTime);
      merged.durationMinutes = blockMinutes;
      merged.endTime = minutesToTime(startMins + blockMinutes);
    }

    const updated = data.appointments.map(a => (a.id === targetId ? merged : a));

    setData(prev => {
      StorageService.saveAppointments(updated);
      return { ...prev, appointments: updated };
    });
  };

  const convertAppointmentToOS = (appointmentId: string): ServiceOrder | null => {
    const apt = data.appointments.find(a => a.id === appointmentId);
    if (!apt) return null;

    const client = data.clients.find(c => c.id === apt.clientId) || data.clients[0];
    const motorcycle = data.motorcycles.find(m => m.plate === apt.motorcyclePlate) || {
      id: `mot_${Date.now()}`,
      clientId: client.id,
      brand: 'Desconhecida',
      model: apt.motorcycleModel,
      plate: apt.motorcyclePlate,
      color: 'Padrão',
      cc: 160,
      year: new Date().getFullYear()
    };

    const selectedServices = data.services
      .filter(s => apt.serviceIds.includes(s.id))
      .map(s => ({
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        estimatedMinutes: s.estimatedMinutes
      }));

    const subtotal = selectedServices.reduce((acc, s) => acc + s.price, 0);

    const createdOS = createOrder({
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientWhatsapp: client.whatsapp,
      motorcycleId: motorcycle.id,
      motorcycleBrand: motorcycle.brand || apt.motorcycleBrand || 'Motocicleta',
      motorcycleModel: motorcycle.model,
      motorcycleVersion: motorcycle.version || apt.motorcycleVersion,
      motorcycleYear: motorcycle.year || apt.motorcycleYear,
      motorcycleCategory: motorcycle.category || apt.motorcycleCategory,
      motorcyclePlate: motorcycle.plate,
      status: 'para_fazer',
      paymentStatus: 'pendente',
      assignedEmployeeId: apt.assignedEmployeeId || currentUser.id,
      assignedEmployeeName: apt.assignedEmployeeName || currentUser.name,
      entryDateTime: new Date().toISOString(),
      services: selectedServices,
      productsConsumed: [],
      subtotal,
      discount: 0,
      addition: 0,
      total: subtotal,
      amountPaid: 0,
      checklist: {
        entryDate: new Date().toISOString(),
        fuelLevel: '1/2',
        accessoriesLeft: [],
        items: []
      },
      photosBefore: [],
      photosAfter: [],
      notes: `Origem: Agendamento ${apt.date} ${apt.startTime}. ${apt.notes || ''}`
    });

    updateAppointment(appointmentId, {
      status: 'em_atendimento',
      serviceOrderId: createdOS.id
    });

    logAudit('CONVERTER_AGENDAMENTO_OS', 'Agenda', `Agendamento ${appointmentId} convertido em OS ${createdOS.id}`);
    return createdOS;
  };

  const convertAppointmentToOrder = (appointmentId: string): string | null => {
    const os = convertAppointmentToOS(appointmentId);
    return os ? os.id : null;
  };

  const cancelAppointment = (appointmentId: string) => {
    updateAppointment(appointmentId, { status: 'cancelado' });
    logAudit('CANCELAR_AGENDAMENTO', 'Agenda', `Cancelado agendamento ${appointmentId}`);
  };

  // --- CLIENTS ---
  const createClient = (clientInput: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitsCount' | 'loyaltyPoints' | 'loyaltyTier' | 'tags'>): Client => {
    const newClient: Client = {
      ...clientInput,
      id: `cli_${Date.now()}`,
      createdAt: getLocalDateStr(),
      totalSpent: 0,
      visitsCount: 0,
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      tags: ['novo']
    };
    const updated = [newClient, ...data.clients];
    setData(prev => {
      StorageService.saveClients(updated);
      return { ...prev, clients: updated };
    });
    logAudit('CRIAR_CLIENTE', 'CRM', `Cadastrado cliente ${newClient.name} (${newClient.phone})`);
    return newClient;
  };

  const updateClient = (clientOrId: Client | string, updates?: Partial<Client>) => {
    setData(prev => {
      const updatedClients = prev.clients.map(c => {
        if (typeof clientOrId === 'string') {
          if (c.id === clientOrId && updates) return { ...c, ...updates };
        } else {
          if (c.id === clientOrId.id) return { ...c, ...clientOrId };
        }
        return c;
      });
      const targetId = typeof clientOrId === 'string' ? clientOrId : clientOrId.id;
      const updatedTarget = updatedClients.find(c => c.id === targetId);
      const updatedMotos = updatedTarget
        ? prev.motorcycles.map(m => (m.clientId === targetId ? { ...m, clientName: updatedTarget.name } : m))
        : prev.motorcycles;

      StorageService.saveClients(updatedClients);
      StorageService.saveMotorcycles(updatedMotos);
      return { ...prev, clients: updatedClients, motorcycles: updatedMotos };
    });
    logAudit('ATUALIZAR_CLIENTE', 'CRM', `Atualizado cadastro do cliente`);
  };

  const deleteClient = (clientId: string) => {
    const updated = data.clients.filter(c => c.id !== clientId);
    // Remove também os veículos do cliente para não deixar motos órfãs nos seletores.
    const updatedMotos = data.motorcycles.filter(m => m.clientId !== clientId);
    setData(prev => {
      StorageService.saveClients(updated);
      StorageService.saveMotorcycles(updatedMotos);
      return { ...prev, clients: updated, motorcycles: updatedMotos };
    });
    logAudit('EXCLUIR_CLIENTE', 'CRM', `Excluído cliente ${clientId} (LGPD)`);
  };

  // --- USERS / TEAM ---
  const createUser = (userInput: Omit<User, 'id'>): User => {
    const newUser: User = {
      ...userInput,
      id: `usr_${Date.now()}`
    };
    setData(prev => {
      const updated = [...prev.users, newUser];
      StorageService.saveUsers(updated);
      return { ...prev, users: updated };
    });
    logAudit('CRIAR_FUNCIONARIO', 'Equipe', `Adicionado membro ${newUser.name} (${newUser.role})`);
    return newUser;
  };

  const updateUser = (userOrId: User | string, updates?: Partial<User>) => {
    setData(prev => {
      const updated = prev.users.map(u => {
        if (typeof userOrId === 'string') {
          if (u.id === userOrId && updates) return { ...u, ...updates };
        } else {
          if (u.id === userOrId.id) return { ...u, ...userOrId };
        }
        return u;
      });
      StorageService.saveUsers(updated);
      return { ...prev, users: updated };
    });
    logAudit('ATUALIZAR_FUNCIONARIO', 'Equipe', `Atualizados dados de integrante da equipe`);
  };

  const deleteUser = (userId: string): boolean => {
    if (data.users.length <= 1) return false;
    setData(prev => {
      if (prev.users.length <= 1) return prev;
      const updated = prev.users.filter(u => u.id !== userId);
      const nextCurrentUserId =
        prev.currentUserId === userId ? updated[0]?.id || '' : prev.currentUserId;
      StorageService.saveUsers(updated);
      if (nextCurrentUserId !== prev.currentUserId) {
        StorageService.saveCurrentUserId(nextCurrentUserId);
      }
      return { ...prev, users: updated, currentUserId: nextCurrentUserId };
    });
    logAudit('REMOVER_FUNCIONARIO', 'Equipe', `Removido integrante ${userId} da equipe`);
    return true;
  };

  // --- MOTORCYCLES ---
  const createMotorcycle = (motoInput: Omit<Motorcycle, 'id'>): Motorcycle => {
    const newMoto: Motorcycle = { ...motoInput, id: `mot_${Date.now()}` };
    const updated = [newMoto, ...data.motorcycles];
    setData(prev => {
      StorageService.saveMotorcycles(updated);
      return { ...prev, motorcycles: updated };
    });
    logAudit('CRIAR_MOTO', 'Motocicletas', `Cadastrada moto ${newMoto.model} placa ${newMoto.plate}`);
    return newMoto;
  };

  const updateMotorcycle = (motoOrId: Motorcycle | string, updates?: Partial<Motorcycle>) => {
    setData(prev => {
      const updatedMotos = prev.motorcycles.map(m => {
        if (typeof motoOrId === 'string') {
          if (m.id === motoOrId && updates) return { ...m, ...updates };
        } else {
          if (m.id === motoOrId.id) return { ...m, ...motoOrId };
        }
        return m;
      });
      StorageService.saveMotorcycles(updatedMotos);
      return { ...prev, motorcycles: updatedMotos };
    });
    logAudit('ATUALIZAR_MOTO', 'Motocicletas', `Atualizados dados da motocicleta`);
  };

  const deleteMotorcycle = (motoId: string) => {
    setData(prev => {
      const updated = prev.motorcycles.filter(m => m.id !== motoId);
      StorageService.saveMotorcycles(updated);
      return { ...prev, motorcycles: updated };
    });
    logAudit('EXCLUIR_MOTO', 'Motocicletas', `Removida motocicleta ${motoId}`);
  };

  // --- MOTORCYCLE CATALOG (MARCAS / MODELOS / FIPE CACHE) ---
  const upsertCatalogBrand = (input: Parameters<typeof upsertCatalogBrandHelper>[1]) => {
    const res = upsertCatalogBrandHelper(data.motoCatalog, input);
    setData(prev => ({ ...prev, motoCatalog: res.catalog }));
    logAudit(
      res.created ? 'CRIAR_MARCA_CATALOGO' : 'EDITAR_MARCA_CATALOGO',
      'Catálogo de Motos',
      `${res.created ? 'Adicionada' : 'Atualizada'} marca "${res.brand.name}" no catálogo`
    );
    return { brand: res.brand, created: res.created };
  };

  const toggleCatalogBrandActive = (brandId: string) => {
    const next = toggleCatalogBrandActiveHelper(data.motoCatalog, brandId);
    setData(prev => ({ ...prev, motoCatalog: next }));
    logAudit('ALTERAR_STATUS_MARCA', 'Catálogo de Motos', `Alterado status de ativação da marca ${brandId}`);
  };

  const upsertCatalogModel = (input: Parameters<typeof upsertCatalogModelHelper>[1]) => {
    const res = upsertCatalogModelHelper(data.motoCatalog, input);
    setData(prev => ({ ...prev, motoCatalog: res.catalog }));
    logAudit(
      res.created ? 'CRIAR_MODELO_CATALOGO' : 'EDITAR_MODELO_CATALOGO',
      'Catálogo de Motos',
      `${res.created ? 'Adicionado' : 'Atualizado'} modelo "${res.model.brandName} ${res.model.name}" no catálogo`
    );
    return { model: res.model, created: res.created };
  };

  const toggleCatalogModelActive = (modelId: string) => {
    const next = toggleCatalogModelActiveHelper(data.motoCatalog, modelId);
    setData(prev => ({ ...prev, motoCatalog: next }));
    logAudit('ALTERAR_STATUS_MODELO', 'Catálogo de Motos', `Alterado status de ativação do modelo ${modelId}`);
  };

  const syncCatalogBrandsFromFipe = async () => {
    const res = await syncBrandsFromFipeHelper(data.motoCatalog);
    setData(prev => ({ ...prev, motoCatalog: res.catalog }));
    logAudit(
      'SINCRONIZAR_MARCAS_FIPE',
      'Catálogo de Motos',
      `Marcas sincronizadas via ${res.sourceUsed}: ${res.addedBrands} novas, ${res.matchedBrands} vinculadas`
    );
    return {
      addedBrands: res.addedBrands,
      matchedBrands: res.matchedBrands,
      sourceUsed: res.sourceUsed,
    };
  };

  const syncCatalogModelsForBrand = async (brandId: string, signal?: AbortSignal) => {
    const res = await syncModelsForBrandFromFipeHelper(data.motoCatalog, brandId, signal);
    if (!signal?.aborted) {
      setData(prev => ({ ...prev, motoCatalog: res.catalog }));
      logAudit(
        'SINCRONIZAR_MODELOS_FIPE',
        'Catálogo de Motos',
        `Modelos FIPE de ${res.brandName} atualizados (${res.importedCount} novos)`
      );
    }
    return { importedCount: res.importedCount, brandName: res.brandName };
  };

  const syncCatalogYearsForModel = async (modelId: string, signal?: AbortSignal) => {
    const res = await syncYearsForModelFromFipeHelper(data.motoCatalog, modelId, signal);
    if (!signal?.aborted) {
      setData(prev => ({ ...prev, motoCatalog: res.catalog }));
    }
    return res.model;
  };

  const syncFullMotoCatalogFromFipe = async (
    onProgress?: (progress: FipeSyncProgress) => void,
    signal?: AbortSignal
  ) => {
    const finalCatalog = await syncFullFipeCatalogHelper(data.motoCatalog, onProgress, signal);
    setData(prev => ({ ...prev, motoCatalog: finalCatalog }));
    logAudit(
      'SINCRONIZAR_CATALOGO_COMPLETO_FIPE',
      'Catálogo de Motos',
      finalCatalog.lastSyncNote || 'Sincronização completa da Tabela FIPE executada'
    );
    return finalCatalog;
  };

  const resetMotoCatalogCache = () => {
    const fresh = clearMotoCatalogCacheHelper();
    setData(prev => ({ ...prev, motoCatalog: fresh }));
    logAudit('RESTAURAR_CATALOGO_MOTOS', 'Catálogo de Motos', 'Cache local do catálogo restaurado para base inicial');
  };

  // --- SERVICES ---
  const createService = (srvInput: Omit<ServiceItem, 'id'>): ServiceItem => {
    const cleanCategory = srvInput.category.trim() || 'Outros Serviços';
    const newSrv: ServiceItem = { ...srvInput, category: cleanCategory, id: `srv_${Date.now()}` };
    setData(prev => {
      const updated = [...prev.services, newSrv];
      const nextCategories = prev.serviceCategories.includes(cleanCategory)
        ? prev.serviceCategories
        : [...prev.serviceCategories, cleanCategory];
      StorageService.saveServices(updated);
      if (nextCategories !== prev.serviceCategories) {
        StorageService.saveServiceCategories(nextCategories);
      }
      return { ...prev, services: updated, serviceCategories: nextCategories };
    });
    logAudit('CRIAR_SERVICO', 'Serviços', `Cadastrado serviço ${newSrv.name} - R$ ${newSrv.price}`);
    return newSrv;
  };

  const updateService = (srvOrId: ServiceItem | string, updates?: Partial<ServiceItem>) => {
    setData(prev => {
      const updated = prev.services.map(s => {
        if (typeof srvOrId === 'string') {
          if (s.id === srvOrId && updates) return { ...s, ...updates };
        } else {
          if (s.id === srvOrId.id) return { ...s, ...srvOrId };
        }
        return s;
      });
      let nextCategories = prev.serviceCategories;
      updated.forEach(s => {
        if (s.category && !nextCategories.includes(s.category)) {
          nextCategories = [...nextCategories, s.category];
        }
      });
      StorageService.saveServices(updated);
      if (nextCategories !== prev.serviceCategories) {
        StorageService.saveServiceCategories(nextCategories);
      }
      return { ...prev, services: updated, serviceCategories: nextCategories };
    });
  };

  const toggleServiceActive = (serviceId: string) => {
    const target = data.services.find(s => s.id === serviceId);
    if (target) {
      updateService(serviceId, { active: !target.active });
    }
  };

  const deleteService = (serviceId: string) => {
    const target = data.services.find(s => s.id === serviceId);
    setData(prev => {
      const updated = prev.services.filter(s => s.id !== serviceId);
      StorageService.saveServices(updated);
      return { ...prev, services: updated };
    });
    if (target) {
      logAudit('EXCLUIR_SERVICO', 'Serviços', `Removido serviço ${target.name} - R$ ${target.price}`);
    }
  };

  const addServiceCategory = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = data.serviceCategories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) return false;
    setData(prev => {
      if (prev.serviceCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev.serviceCategories, trimmed];
      StorageService.saveServiceCategories(updated);
      return { ...prev, serviceCategories: updated };
    });
    logAudit('CRIAR_CATEGORIA_SERVICO', 'Serviços', `Criada categoria de serviço "${trimmed}"`);
    return true;
  };

  const renameServiceCategory = (oldName: string, newName: string): boolean => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    const duplicate = data.serviceCategories.some(
      c => c !== oldName && c.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) return false;

    setData(prev => {
      const updatedCategories = prev.serviceCategories.map(c => (c === oldName ? trimmed : c));
      const updatedServices = prev.services.map(s =>
        s.category === oldName ? { ...s, category: trimmed } : s
      );
      StorageService.saveServiceCategories(updatedCategories);
      StorageService.saveServices(updatedServices);
      return { ...prev, serviceCategories: updatedCategories, services: updatedServices };
    });
    logAudit('RENOMEAR_CATEGORIA_SERVICO', 'Serviços', `Categoria "${oldName}" renomeada para "${trimmed}"`);
    return true;
  };

  const deleteServiceCategory = (name: string, fallbackCategory?: string): boolean => {
    if (data.serviceCategories.length <= 1) return false;
    const remaining = data.serviceCategories.filter(c => c !== name);
    const targetCategory =
      fallbackCategory && remaining.includes(fallbackCategory)
        ? fallbackCategory
        : remaining[remaining.length - 1];

    setData(prev => {
      const nextCats = prev.serviceCategories.filter(c => c !== name);
      if (nextCats.length === 0) return prev;
      const safeTarget =
        fallbackCategory && nextCats.includes(fallbackCategory)
          ? fallbackCategory
          : nextCats[nextCats.length - 1];
      const nextServices = prev.services.map(s =>
        s.category === name ? { ...s, category: safeTarget } : s
      );
      StorageService.saveServiceCategories(nextCats);
      StorageService.saveServices(nextServices);
      return { ...prev, serviceCategories: nextCats, services: nextServices };
    });
    logAudit(
      'EXCLUIR_CATEGORIA_SERVICO',
      'Serviços',
      `Categoria "${name}" removida (serviços movidos para "${targetCategory}")`
    );
    return true;
  };

  const reorderServiceCategories = (orderedCategories: string[]) => {
    setData(prev => {
      StorageService.saveServiceCategories(orderedCategories);
      return { ...prev, serviceCategories: orderedCategories };
    });
  };

  // --- PRODUCTS & INVENTORY ---
  const createProduct = (prdInput: Omit<Product, 'id' | 'lastRestockedAt'>): Product => {
    const newPrd: Product = {
      ...prdInput,
      id: `prd_${Date.now()}`,
      lastRestockedAt: getLocalDateStr()
    };
    const updated = [...data.products, newPrd];
    setData(prev => {
      StorageService.saveProducts(updated);
      return { ...prev, products: updated };
    });
    logAudit('CRIAR_PRODUTO', 'Estoque', `Cadastrado produto ${newPrd.name}`);
    return newPrd;
  };

  const updateProduct = (prdOrId: Product | string, updates?: Partial<Product>) => {
    const updated = data.products.map(p => {
      if (typeof prdOrId === 'string') {
        if (p.id === prdOrId && updates) return { ...p, ...updates };
      } else {
        if (p.id === prdOrId.id) return { ...p, ...prdOrId };
      }
      return p;
    });

    setData(prev => {
      StorageService.saveProducts(updated);
      return { ...prev, products: updated };
    });
  };

  const restockProduct = (productId: string, quantityToAdd: number, costPrice?: number, supplier?: string) => {
    const prd = data.products.find(p => p.id === productId);
    if (!prd) return;

    const prevQty = prd.currentQuantity;
    const newQty = prevQty + quantityToAdd;
    updateProduct(productId, {
      currentQuantity: newQty,
      costPrice: costPrice !== undefined ? costPrice : prd.costPrice,
      supplier: supplier || prd.supplier,
      lastRestockedAt: getLocalDateStr()
    });

    const newMov: StockMovement = {
      id: `stk_mov_${Date.now()}`,
      productId,
      productName: prd.name,
      type: 'entrada',
      quantity: quantityToAdd,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason: 'Entrada / Reposição de estoque',
      operatorName: currentUser.name,
      date: new Date().toISOString()
    };

    setData(prev => {
      const nextMovs = [newMov, ...prev.stockMovements];
      StorageService.saveStockMovements(nextMovs);
      return { ...prev, stockMovements: nextMovs };
    });
  };

  const recordStockMovement = (productId: string, type: StockMovement['type'], quantity: number, reason: string) => {
    const prd = data.products.find(p => p.id === productId);
    if (!prd) return;

    const prevQty = prd.currentQuantity;
    let newQty = prevQty;
    if (type === 'entrada') newQty += quantity;
    else newQty = Math.max(0, prevQty - quantity);

    updateProduct(productId, { currentQuantity: newQty });

    const newMov: StockMovement = {
      id: `stk_mov_${Date.now()}`,
      productId,
      productName: prd.name,
      type,
      quantity,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason,
      operatorName: currentUser.name,
      date: new Date().toISOString()
    };

    setData(prev => {
      const nextMovs = [newMov, ...prev.stockMovements];
      StorageService.saveStockMovements(nextMovs);
      return { ...prev, stockMovements: nextMovs };
    });
  };

  const registerStockMovement = recordStockMovement;

  // --- EXPENSES ---
  const createExpense = (expenseInput: Omit<Expense, 'id'>): Expense => {
    const newExp: Expense = { ...expenseInput, id: `exp_${Date.now()}` };
    const updated = [newExp, ...data.expenses];

    let updatedCash = { ...data.cashRegister };
    if (newExp.status === 'pago' && updatedCash.status === 'aberto') {
      const method = newExp.paymentMethod || 'pix';
      const newMov = {
        id: `csh_mov_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'despesa' as const,
        amount: newExp.amount,
        paymentMethod: method,
        description: `Despesa: ${newExp.description}`,
        relatedExpenseId: newExp.id,
        operatorName: currentUser.name
      };
      updatedCash.totalOut += newExp.amount;
      if (method === 'dinheiro') {
        updatedCash.expectedBalance = Math.max(0, updatedCash.expectedBalance - newExp.amount);
      }
      updatedCash.movements = [newMov, ...updatedCash.movements];
      StorageService.saveCashRegister(updatedCash);
    }

    setData(prev => {
      StorageService.saveExpenses(updated);
      return { ...prev, expenses: updated, cashRegister: updatedCash };
    });
    logAudit('CRIAR_DESPESA', 'Financeiro', `Lançada despesa "${newExp.description}" de R$ ${newExp.amount.toFixed(2)}`);
    return newExp;
  };

  const payExpense = (expenseId: string, method: PaymentMethod) => {
    const targetExp = data.expenses.find(e => e.id === expenseId);
    const updatedExpenses = data.expenses.map(e => {
      if (e.id === expenseId) {
        return {
          ...e,
          status: 'pago' as const,
          paymentDate: getLocalDateStr(),
          paymentMethod: method
        };
      }
      return e;
    });

    let updatedCash = { ...data.cashRegister };
    if (targetExp && targetExp.status === 'pendente' && updatedCash.status === 'aberto') {
      const newMov = {
        id: `csh_mov_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'despesa' as const,
        amount: targetExp.amount,
        paymentMethod: method,
        description: `Pagamento Despesa: ${targetExp.description}`,
        relatedExpenseId: targetExp.id,
        operatorName: currentUser.name
      };
      updatedCash.totalOut += targetExp.amount;
      if (method === 'dinheiro') {
        updatedCash.expectedBalance = Math.max(0, updatedCash.expectedBalance - targetExp.amount);
      }
      updatedCash.movements = [newMov, ...updatedCash.movements];
      StorageService.saveCashRegister(updatedCash);
    }

    setData(prev => {
      StorageService.saveExpenses(updatedExpenses);
      return { ...prev, expenses: updatedExpenses, cashRegister: updatedCash };
    });
    if (targetExp) {
      logAudit('PAGAR_DESPESA', 'Financeiro', `Despesa "${targetExp.description}" liquidada via ${method.toUpperCase()}`);
    }
  };

  const deleteExpense = (expenseId: string) => {
    const target = data.expenses.find(e => e.id === expenseId);
    const updated = data.expenses.filter(e => e.id !== expenseId);

    // Excluir uma despesa paga não pode deixar a saída órfã no caixa aberto.
    let updatedCash = { ...data.cashRegister };
    if (target && target.status === 'pago' && updatedCash.status === 'aberto') {
      const linked = updatedCash.movements.filter(
        mov =>
          mov.relatedExpenseId === expenseId ||
          (!mov.relatedExpenseId &&
            (mov.description === `Despesa: ${target.description}` ||
              mov.description === `Pagamento Despesa: ${target.description}`))
      );
      if (linked.length > 0) {
        const refundedCash = linked
          .filter(mov => mov.paymentMethod === 'dinheiro')
          .reduce((sum, mov) => sum + mov.amount, 0);
        const removed = linked.reduce((sum, mov) => sum + mov.amount, 0);
        updatedCash = {
          ...updatedCash,
          totalOut: Math.max(0, updatedCash.totalOut - removed),
          expectedBalance: updatedCash.expectedBalance + refundedCash,
          movements: updatedCash.movements.filter(mov => !linked.some(item => item.id === mov.id)),
        };
        StorageService.saveCashRegister(updatedCash);
      }
    }

    setData(prev => {
      StorageService.saveExpenses(updated);
      return { ...prev, expenses: updated, cashRegister: updatedCash };
    });
    if (target) {
      logAudit('EXCLUIR_DESPESA', 'Financeiro', `Despesa "${target.description}" excluída`);
    }
  };

  // --- CASH REGISTER ---
  const openCashRegister = (initialBalance: number, notes?: string) => {
    const newCash: CashRegister = {
      id: `csh_${Date.now()}`,
      openedAt: new Date().toISOString(),
      status: 'aberto',
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      initialBalance,
      totalIn: 0,
      totalOut: 0,
      expectedBalance: initialBalance,
      movements: [
        {
          id: `csh_mov_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'abertura',
          amount: initialBalance,
          paymentMethod: 'saldo_inicial',
          description: `Abertura de Caixa por ${currentUser.name}`,
          operatorName: currentUser.name
        }
      ],
      notes
    };

    setData(prev => {
      StorageService.saveCashRegister(newCash);
      return { ...prev, cashRegister: newCash };
    });

    logAudit('ABERTURA_CAIXA', 'Caixa', `Abertura de caixa com R$ ${initialBalance.toFixed(2)}`);
  };

  const closeCashRegister = (actualCounted: number, notes?: string) => {
    const diff = actualCounted - data.cashRegister.expectedBalance;
    const closed: CashRegister = {
      ...data.cashRegister,
      status: 'fechado',
      closedAt: new Date().toISOString(),
      actualCountedBalance: actualCounted,
      difference: diff,
      notes: `${data.cashRegister.notes || ''} [Conferido: R$ ${actualCounted.toFixed(2)}]`
    };

    const nextHistory = [closed, ...data.cashHistory];

    setData(prev => {
      StorageService.saveCashRegister(closed);
      StorageService.saveCashHistory(nextHistory);
      return { ...prev, cashRegister: closed, cashHistory: nextHistory };
    });

    logAudit('FECHAMENTO_CAIXA', 'Caixa', `Fechamento de caixa com saldo R$ ${actualCounted.toFixed(2)}`);
  };

  const openCash = openCashRegister;
  const closeCash = closeCashRegister;

  const addCashMovement = (type: 'suprimento' | 'sangria' | 'despesa', amount: number, method: PaymentMethod, description: string) => {
    const isOut = type === 'sangria' || type === 'despesa';
    const newMov = {
      id: `csh_mov_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      amount,
      paymentMethod: method,
      description,
      operatorName: currentUser.name
    };

    const updatedCash: CashRegister = {
      ...data.cashRegister,
      totalIn: isOut ? data.cashRegister.totalIn : data.cashRegister.totalIn + amount,
      totalOut: isOut ? data.cashRegister.totalOut + amount : data.cashRegister.totalOut,
      expectedBalance: isOut
        ? Math.max(0, data.cashRegister.expectedBalance - amount)
        : data.cashRegister.expectedBalance + amount,
      movements: [newMov, ...data.cashRegister.movements]
    };

    setData(prev => {
      StorageService.saveCashRegister(updatedCash);
      return { ...prev, cashRegister: updatedCash };
    });
  };

  // --- COMMISSIONS ---
  const createCommission = (recInput: Omit<CommissionRecord, 'id'>): CommissionRecord => {
    const newRec: CommissionRecord = {
      ...recInput,
      id: `com_${Date.now()}`
    };
    setData(prev => {
      const updated = [newRec, ...prev.commissions];
      StorageService.saveCommissions(updated);
      return { ...prev, commissions: updated };
    });
    logAudit('CRIAR_COMISSAO', 'Comissões', `Lançada comissão de R$ ${newRec.commissionAmount.toFixed(2)} para ${newRec.employeeName}`);
    return newRec;
  };

  const updateCommission = (recOrId: CommissionRecord | string, updates?: Partial<CommissionRecord>) => {
    setData(prev => {
      const updated = prev.commissions.map(c => {
        if (typeof recOrId === 'string') {
          if (c.id === recOrId && updates) return { ...c, ...updates };
        } else {
          if (c.id === recOrId.id) return { ...c, ...recOrId };
        }
        return c;
      });
      StorageService.saveCommissions(updated);
      return { ...prev, commissions: updated };
    });
    logAudit('ATUALIZAR_COMISSAO', 'Comissões', `Alterada comissão registrada`);
  };

  const deleteCommission = (id: string) => {
    setData(prev => {
      const updated = prev.commissions.filter(c => c.id !== id);
      StorageService.saveCommissions(updated);
      return { ...prev, commissions: updated };
    });
    logAudit('EXCLUIR_COMISSAO', 'Comissões', `Removida comissão ${id}`);
  };

  const approveCommission = (id: string) => {
    setData(prev => {
      const updated = prev.commissions.map(c => c.id === id ? { ...c, status: 'aprovada' as const, paidAt: undefined } : c);
      StorageService.saveCommissions(updated);
      return { ...prev, commissions: updated };
    });
  };

  const payCommission = (id: string) => {
    setData(prev => {
      const updated = prev.commissions.map(c => c.id === id ? { ...c, status: 'paga' as const, paidAt: new Date().toISOString() } : c);
      StorageService.saveCommissions(updated);
      return { ...prev, commissions: updated };
    });
  };

  // --- COUPONS ---
  const createCoupon = (cpnInput: Omit<LoyaltyCoupon, 'id' | 'timesUsed'>): LoyaltyCoupon => {
    const newCpn: LoyaltyCoupon = {
      ...cpnInput,
      id: `cpn_${Date.now()}`,
      code: cpnInput.code.toUpperCase().trim(),
      timesUsed: 0
    };
    const updated = [...data.coupons, newCpn];
    setData(prev => {
      StorageService.saveCoupons(updated);
      return { ...prev, coupons: updated };
    });
    return newCpn;
  };

  const toggleCoupon = (couponId: string) => {
    const updated = data.coupons.map(c => c.id === couponId ? { ...c, active: !c.active } : c);
    setData(prev => {
      StorageService.saveCoupons(updated);
      return { ...prev, coupons: updated };
    });
  };

  const toggleCouponActive = toggleCoupon;

  // --- SETTINGS ---
  const updateSettings = (s: CompanySettings) => {
    setData(prev => {
      StorageService.saveSettings(s);
      return { ...prev, settings: s };
    });
  };

  const resetDatabase = () => {
    const reset = StorageService.resetToDefaults();
    setData(reset);
  };

  const restoreDatabase = (json: string): boolean => {
    const success = StorageService.importDatabaseBackup(json);
    if (success) {
      setData(StorageService.loadAll());
    }
    return success;
  };

  const contextValue = useMemo<AppContextType>(
    () => ({
      activeModule,
      setActiveModule,
        users: data.users,
        currentUser,
        setCurrentUserById,
        isSessionLoggedOut,
        logoutOperator,
        loginOperator,
        logAudit,
        clients: data.clients,
        motorcycles: data.motorcycles,
        services: data.services,
        serviceCategories: data.serviceCategories,
        products: data.products,
        stockMovements: data.stockMovements,
        orders: data.orders,
        appointments: data.appointments,
        expenses: data.expenses,
        cashRegister: data.cashRegister,
        cashHistory: data.cashHistory,
        commissions: data.commissions,
        coupons: data.coupons,
        settings: data.settings,
        auditLogs: data.auditLogs,
        whatsappConfig: data.whatsappConfig || INITIAL_WHATSAPP_CONFIG,
        whatsappLogs: data.whatsappLogs || [],
        activeWhatsappPrompt,

        kpis,

        quickActionOpen,
        setQuickActionOpen,
        quickActionType,
        quickActionTab: quickActionType,
        openQuickAction,

        selectedOrderId,
        setSelectedOrderId,
        viewingOrderId: selectedOrderId,
        setViewingOrderId: setSelectedOrderId,

        searchQuery,
        setSearchQuery,

        createOrder,
        updateOrder,
        updateOrderStatus,
        cancelOrder,
        duplicateOrder,
        addPaymentToOrder,

        createAppointment,
        updateAppointment,
        convertAppointmentToOS,
        convertAppointmentToOrder,
        cancelAppointment,

        createClient,
        updateClient,
        deleteClient,

        createUser,
        updateUser,
        deleteUser,

        createMotorcycle,
        updateMotorcycle,
        deleteMotorcycle,

        motoCatalog: data.motoCatalog,
        upsertCatalogBrand,
        toggleCatalogBrandActive,
        upsertCatalogModel,
        toggleCatalogModelActive,
        syncCatalogBrandsFromFipe,
        syncCatalogModelsForBrand,
        syncCatalogYearsForModel,
        syncFullMotoCatalogFromFipe,
        resetMotoCatalogCache,

        createService,
        updateService,
        toggleServiceActive,
        deleteService,
        addServiceCategory,
        renameServiceCategory,
        deleteServiceCategory,
        reorderServiceCategories,

        createProduct,
        updateProduct,
        restockProduct,
        recordStockMovement,
        registerStockMovement,

        createExpense,
        payExpense,
        deleteExpense,

        openCashRegister,
        closeCashRegister,
        openCash,
        closeCash,
        addCashMovement,

        createCommission,
        updateCommission,
        deleteCommission,
        approveCommission,
        payCommission,

        createCoupon,
        toggleCoupon,
        toggleCouponActive,

      updateSettings,
      updateWhatsappConfig: (cfg: WhatsAppAutomationConfig) => {
        setData(prev => {
          StorageService.saveWhatsappConfig(cfg);
          return { ...prev, whatsappConfig: cfg };
        });
        logAudit('CONFIGURAR_WHATSAPP', 'WhatsApp', `Automação WhatsApp ${cfg.autoSendOnStatusChange ? 'ativada' : 'pausada'} (${cfg.deliveryMode})`);
      },
      resetWhatsappConfig: () => {
        setData(prev => {
          StorageService.saveWhatsappConfig(INITIAL_WHATSAPP_CONFIG);
          return { ...prev, whatsappConfig: INITIAL_WHATSAPP_CONFIG };
        });
        logAudit('RESTAURAR_WHATSAPP', 'WhatsApp', 'Modelos e regras de envio WhatsApp restaurados para padrão');
      },
      sendWhatsappForOrderStatus: (orderId, statusOverride, customMessage) =>
        sendWhatsappForOrderStatus(orderId, statusOverride, customMessage),
      logManualWhatsappMessage: (payload) => {
        const entry: WhatsAppMessageLog = {
          id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          orderId: payload.orderId,
          clientId: payload.clientId,
          clientName: payload.clientName,
          clientPhone: payload.clientPhone,
          statusTrigger: 'manual',
          templateLabel: payload.templateLabel,
          message: payload.message,
          whatsappUrl: payload.whatsappUrl,
          mode: (data.whatsappConfig || INITIAL_WHATSAPP_CONFIG).deliveryMode,
          deliveryStatus: 'enviada',
          timestamp: new Date().toISOString(),
        };
        setData(prev => {
          const updated = [entry, ...(prev.whatsappLogs || [])].slice(0, 150);
          StorageService.saveWhatsappLogs(updated);
          return { ...prev, whatsappLogs: updated };
        });
        logAudit('DISPARO_WHATSAPP_MANUAL', 'WhatsApp', `Mensagem (${payload.templateLabel}) enviada para ${payload.clientName}`);
        return entry;
      },
      markWhatsappLogSent: (logId: string) => {
        setData(prev => {
          const updated = (prev.whatsappLogs || []).map(l =>
            l.id === logId ? { ...l, deliveryStatus: 'enviada' as const } : l
          );
          StorageService.saveWhatsappLogs(updated);
          return { ...prev, whatsappLogs: updated };
        });
        setActiveWhatsappPrompt(prev => (prev?.id === logId ? null : prev));
      },
      retryWhatsappWebhook: async (logId: string) => {
        const target = (data.whatsappLogs || []).find(l => l.id === logId);
        if (!target) return false;
        return executeWebhookDispatch(target, data.whatsappConfig || INITIAL_WHATSAPP_CONFIG);
      },
      clearWhatsappLogs: () => {
        setData(prev => {
          StorageService.saveWhatsappLogs([]);
          return { ...prev, whatsappLogs: [] };
        });
        logAudit('LIMPAR_HISTORICO_WHATSAPP', 'WhatsApp', 'Histórico de envios WhatsApp limpo');
      },
      rolePermissions,
      canAccessModule,
      updateRolePermission,
      hasInternalSiteAccess,
      portalConfig,
      updatePortalConfig,
      resetPortalConfig,
      isPublicPortalUrl,
      clientPortalOnly,
      enterClientOnlyMode,
      exitClientOnlyMode,
      dismissWhatsappPrompt: () => setActiveWhatsappPrompt(null),
      resetDatabase,
      restoreDatabase
    }),
    // Recompute provider value when stateful data, route/UI selection, or derived KPIs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data,
      activeModule,
      quickActionOpen,
      quickActionType,
      selectedOrderId,
      searchQuery,
      activeWhatsappPrompt,
      kpis,
      kioskClientOnly,
      isPublicPortalUrl,
      isSessionLoggedOut,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
