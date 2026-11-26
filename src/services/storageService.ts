import {
  User,
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
  WhatsAppAutomationConfig,
  WhatsAppMessageLog,
  CustomerPortalConfig,
  MotoCatalogState
} from '../types';
import {
  loadMotoCatalog,
  saveMotoCatalog as persistMotoCatalog
} from './motorcycleCatalogService';
import {
  DEFAULT_APPOINTMENT_SLOTS,
  isSlotWithinBusinessHours
} from '../utils/schedulingUtils';
import {
  ErrorReporter,
  StorageError,
  safeJsonParse,
  sanitizeImageUrl,
  stripDangerousKeys
} from '../core/errorHandler';
import { notifyRealtimeKey } from './realtimeService';
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_MOTORCYCLES,
  INITIAL_SERVICES,
  DEFAULT_SERVICE_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_APPOINTMENTS,
  INITIAL_EXPENSES,
  INITIAL_CASH_REGISTER,
  INITIAL_COMMISSIONS,
  INITIAL_COUPONS,
  INITIAL_SETTINGS,
  INITIAL_AUDIT_LOGS,
  INITIAL_WHATSAPP_CONFIG
} from '../data/initialData';

const STORAGE_KEYS = {
  USERS: 'pk_detail_users_v1',
  CLIENTS: 'pk_detail_clients_v1',
  MOTORCYCLES: 'pk_detail_motorcycles_v1',
  SERVICES: 'pk_detail_services_v1',
  PRODUCTS: 'pk_detail_products_v1',
  STOCK_MOVEMENTS: 'pk_detail_stock_movs_v1',
  ORDERS: 'pk_detail_orders_v1',
  APPOINTMENTS: 'pk_detail_appointments_v1',
  EXPENSES: 'pk_detail_expenses_v1',
  CASH_REGISTER: 'pk_detail_cash_register_v1',
  CASH_HISTORY: 'pk_detail_cash_history_v1',
  COMMISSIONS: 'pk_detail_commissions_v1',
  COUPONS: 'pk_detail_coupons_v1',
  SETTINGS: 'pk_detail_settings_v1',
  AUDIT: 'pk_detail_audit_logs_v1',
  CURRENT_USER_ID: 'pk_detail_current_user_id_v1',
  WHATSAPP_CONFIG: 'pk_detail_whatsapp_config_v1',
  WHATSAPP_LOGS: 'pk_detail_whatsapp_logs_v1',
  ROLE_PERMISSIONS: 'pk_detail_role_permissions_v1',
  PORTAL_CONFIG: 'pk_detail_portal_config_v1',
  CLIENT_ONLY_LOCK: 'pk_detail_client_only_lock_v1',
  SERVICE_CATEGORIES: 'pk_detail_service_categories_v1'
};

export const DEFAULT_PORTAL_CONFIG: CustomerPortalConfig = {
  portalEnabled: true,
  maintenanceMessage:
    'Nosso portal de agendamentos está passando por uma rápida atualização. Entre em contato pelo WhatsApp para agendar ou acompanhar sua motocicleta.',
  heroBadge: 'Estúdio Especializado em Motocicletas',
  heroTitle: 'Cuidado técnico e proteção de alto padrão para a sua moto.',
  heroSubtitle:
    'Agende sua lavagem detalhada, descontaminação ou vitrificação online e acompanhe cada etapa do atendimento em tempo real pela placa.',
  promoNotice: '',
  showHeroImage: true,
  heroImageUrl: '',
  allowOnlineBooking: true,
  allowOrderTracking: true,
  allowServicesCatalog: true,
  showPrices: true,
  showBeforeAfterPhotos: true,
  showPaymentSummaryInTracking: true,
  showLocationAndHours: true,
  showWhatsappButton: true,
  showStudioHighlights: true,
  bookingConfirmationMessage:
    'Sua solicitação foi registrada na nossa agenda. Nossa equipe confirmará o horário selecionado via WhatsApp em poucos minutos.',
  availableTimeSlots: [...DEFAULT_APPOINTMENT_SLOTS],
  highlightCards: [
    {
      title: 'Produtos pH Neutro & Zero Abrasão',
      description: 'Lavagem segura para pinturas foscas, peças anodizadas, plásticos e fibra de carbono sem risco de manchas.',
    },
    {
      title: 'Checklist Digital & Registro Fotográfico',
      description: 'Inspeção completa de entrada e saída com fotos do Antes e Depois disponíveis diretamente no seu acompanhamento.',
    },
    {
      title: 'Qualidade & Padronização Técnica',
      description: 'Cada lavagem segue padrão técnico de detalhamento, inspeção completa e histórico registrado da sua motocicleta.',
    },
  ],
  kioskPin: '1234',
};

export type RolePermissions = Record<string, Record<string, boolean>>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: {
    dashboard: true, patio: true, ordens: true, agenda: true, clientes: true, servicos: true, financeiro: true, funcionarios: true, whatsapp: true, portal: true, relatorios: true
  },
  gerente: {
    dashboard: true, patio: true, ordens: true, agenda: true, clientes: true, servicos: true, financeiro: true, funcionarios: false, whatsapp: true, portal: true, relatorios: true
  },
  atendente: {
    dashboard: true, patio: true, ordens: true, agenda: true, clientes: true, servicos: true, financeiro: false, funcionarios: false, whatsapp: true, portal: true, relatorios: false
  },
  operacional: {
    dashboard: false, patio: true, ordens: true, agenda: true, clientes: false, servicos: true, financeiro: false, funcionarios: false, whatsapp: false, portal: false, relatorios: false
  }
};

function getItemSafe<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (!val) return fallback;
    return safeJsonParse<T>(val, fallback);
  } catch (err) {
    ErrorReporter.report(
      new StorageError(`Erro ao ler ${key}`, 'Não foi possível carregar dados locais salvos.', err),
      { key }
    );
    return fallback;
  }
}

function setItemSafe<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    // Publica a alteração para outros dispositivos em tempo real.
    notifyRealtimeKey(key, serialized);
  } catch (err) {
    ErrorReporter.report(
      new StorageError(`Erro ao gravar ${key}`, 'Armazenamento local cheio ou indisponível.', err),
      { key }
    );
  }
}

export interface AppDataSnapshot {
  users: User[];
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
  currentUserId: string;
  whatsappConfig: WhatsAppAutomationConfig;
  whatsappLogs: WhatsAppMessageLog[];
  rolePermissions: RolePermissions;
  portalConfig: CustomerPortalConfig;
  motoCatalog: MotoCatalogState;
}

export const StorageService = {
  // Initialization & Load
  loadAll() {
    const rawSettings = getItemSafe<CompanySettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    let normalizedSettings: CompanySettings =
      rawSettings.openingTime === '08:00' && rawSettings.closingTime === '18:30'
        ? { ...rawSettings, openingTime: '09:00', closingTime: '17:00' }
        : { ...rawSettings };

    if (normalizedSettings.phone === '(11) 3280-9940') {
      normalizedSettings = { ...normalizedSettings, phone: '(75) 98807-7173' };
    }
    if (normalizedSettings.whatsapp === '5511987654321' || !normalizedSettings.whatsapp) {
      normalizedSettings = { ...normalizedSettings, whatsapp: '5575988077173' };
    }

    const rawPortal = getItemSafe<Partial<CustomerPortalConfig>>(STORAGE_KEYS.PORTAL_CONFIG, DEFAULT_PORTAL_CONFIG);
    const legacySlotsKeys = [
      '08:00,09:00,10:00,11:00,13:00,14:00,15:00,16:00,17:00',
      '09:00,11:00,13:00,15:00',
    ];
    const loadedSlots = Array.isArray(rawPortal.availableTimeSlots)
      ? rawPortal.availableTimeSlots
      : DEFAULT_APPOINTMENT_SLOTS;
    const validSlots = legacySlotsKeys.includes(loadedSlots.join(','))
      ? [...DEFAULT_APPOINTMENT_SLOTS]
      : loadedSlots.filter(s => isSlotWithinBusinessHours(s));

    const loadedServices = getItemSafe<ServiceItem[]>(STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
    const savedCategories = getItemSafe<string[] | null>(STORAGE_KEYS.SERVICE_CATEGORIES, null);
    const mergedCategories =
      Array.isArray(savedCategories) && savedCategories.length > 0
        ? [...savedCategories]
        : [...DEFAULT_SERVICE_CATEGORIES];
    loadedServices.forEach(s => {
      if (s.category && !mergedCategories.includes(s.category)) {
        mergedCategories.push(s.category);
      }
    });

    return {
      users: getItemSafe<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS),
      clients: getItemSafe<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS),
      motorcycles: getItemSafe<Motorcycle[]>(STORAGE_KEYS.MOTORCYCLES, INITIAL_MOTORCYCLES),
      services: loadedServices,
      serviceCategories: mergedCategories,
      products: getItemSafe<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
      stockMovements: getItemSafe<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []),
      orders: getItemSafe<ServiceOrder[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS),
      appointments: getItemSafe<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS),
      expenses: getItemSafe<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
      cashRegister: getItemSafe<CashRegister>(STORAGE_KEYS.CASH_REGISTER, INITIAL_CASH_REGISTER),
      cashHistory: getItemSafe<CashRegister[]>(STORAGE_KEYS.CASH_HISTORY, []),
      commissions: getItemSafe<CommissionRecord[]>(STORAGE_KEYS.COMMISSIONS, INITIAL_COMMISSIONS),
      coupons: getItemSafe<LoyaltyCoupon[]>(STORAGE_KEYS.COUPONS, INITIAL_COUPONS),
      settings: normalizedSettings,
      auditLogs: getItemSafe<AuditLog[]>(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS),
      currentUserId: getItemSafe<string>(STORAGE_KEYS.CURRENT_USER_ID, INITIAL_USERS[0].id),
      whatsappConfig: getItemSafe<WhatsAppAutomationConfig>(STORAGE_KEYS.WHATSAPP_CONFIG, INITIAL_WHATSAPP_CONFIG),
      whatsappLogs: getItemSafe<WhatsAppMessageLog[]>(STORAGE_KEYS.WHATSAPP_LOGS, []),
      rolePermissions: getItemSafe<RolePermissions>(STORAGE_KEYS.ROLE_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS),
      portalConfig: {
        ...DEFAULT_PORTAL_CONFIG,
        ...rawPortal,
        availableTimeSlots: validSlots.length > 0 ? validSlots : [...DEFAULT_APPOINTMENT_SLOTS],
      },
      motoCatalog: loadMotoCatalog(),
    };
  },

  // Grava o snapshot completo (usado para semear o servidor de tempo real).
  saveAll(data: AppDataSnapshot) {
    this.saveUsers(data.users);
    this.saveClients(data.clients);
    this.saveMotorcycles(data.motorcycles);
    this.saveServices(data.services);
    this.saveServiceCategories(data.serviceCategories);
    this.saveProducts(data.products);
    this.saveStockMovements(data.stockMovements);
    this.saveOrders(data.orders);
    this.saveAppointments(data.appointments);
    this.saveExpenses(data.expenses);
    this.saveCashRegister(data.cashRegister);
    this.saveCashHistory(data.cashHistory);
    this.saveCommissions(data.commissions);
    this.saveCoupons(data.coupons);
    this.saveSettings(data.settings);
    this.saveAuditLogs(data.auditLogs);
    this.saveWhatsappConfig(data.whatsappConfig);
    this.saveWhatsappLogs(data.whatsappLogs);
    this.saveRolePermissions(data.rolePermissions);
    this.savePortalConfig(data.portalConfig);
    this.saveMotoCatalog(data.motoCatalog);
  },

  // Save specific entities
  saveUsers(users: User[]) { setItemSafe(STORAGE_KEYS.USERS, users); },
  saveClients(clients: Client[]) { setItemSafe(STORAGE_KEYS.CLIENTS, clients); },
  saveMotorcycles(motorcycles: Motorcycle[]) { setItemSafe(STORAGE_KEYS.MOTORCYCLES, motorcycles); },
  saveServices(services: ServiceItem[]) { setItemSafe(STORAGE_KEYS.SERVICES, services); },
  saveServiceCategories(categories: string[]) { setItemSafe(STORAGE_KEYS.SERVICE_CATEGORIES, categories); },
  saveProducts(products: Product[]) { setItemSafe(STORAGE_KEYS.PRODUCTS, products); },
  saveStockMovements(movs: StockMovement[]) { setItemSafe(STORAGE_KEYS.STOCK_MOVEMENTS, movs); },
  saveOrders(orders: ServiceOrder[]) { setItemSafe(STORAGE_KEYS.ORDERS, orders); },
  saveAppointments(apts: Appointment[]) { setItemSafe(STORAGE_KEYS.APPOINTMENTS, apts); },
  saveExpenses(expenses: Expense[]) { setItemSafe(STORAGE_KEYS.EXPENSES, expenses); },
  saveCashRegister(cash: CashRegister) { setItemSafe(STORAGE_KEYS.CASH_REGISTER, cash); },
  saveCashHistory(history: CashRegister[]) { setItemSafe(STORAGE_KEYS.CASH_HISTORY, history); },
  saveCommissions(commissions: CommissionRecord[]) { setItemSafe(STORAGE_KEYS.COMMISSIONS, commissions); },
  saveCoupons(coupons: LoyaltyCoupon[]) { setItemSafe(STORAGE_KEYS.COUPONS, coupons); },
  saveSettings(settings: CompanySettings) { setItemSafe(STORAGE_KEYS.SETTINGS, settings); },
  saveAuditLogs(logs: AuditLog[]) { setItemSafe(STORAGE_KEYS.AUDIT, logs); },
  saveCurrentUserId(id: string) { setItemSafe(STORAGE_KEYS.CURRENT_USER_ID, id); },
  saveWhatsappConfig(config: WhatsAppAutomationConfig) { setItemSafe(STORAGE_KEYS.WHATSAPP_CONFIG, config); },
  saveWhatsappLogs(logs: WhatsAppMessageLog[]) { setItemSafe(STORAGE_KEYS.WHATSAPP_LOGS, logs); },
  saveRolePermissions(perms: RolePermissions) { setItemSafe(STORAGE_KEYS.ROLE_PERMISSIONS, perms); },
  savePortalConfig(config: CustomerPortalConfig) { setItemSafe(STORAGE_KEYS.PORTAL_CONFIG, config); },
  saveMotoCatalog(catalog: MotoCatalogState) { persistMotoCatalog(catalog); },
  getClientOnlyLock(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.CLIENT_ONLY_LOCK) === 'true';
    } catch {
      return false;
    }
  },
  setClientOnlyLock(locked: boolean) {
    try {
      if (locked) localStorage.setItem(STORAGE_KEYS.CLIENT_ONLY_LOCK, 'true');
      else localStorage.removeItem(STORAGE_KEYS.CLIENT_ONLY_LOCK);
    } catch {}
  },

  // Export full JSON database for backup
  exportDatabaseBackup() {
    const data = this.loadAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pk_detail_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Import JSON backup safely (sanitizes prototype-pollution keys and validates object structure)
  importDatabaseBackup(jsonString: string): boolean {
    if (!jsonString || typeof jsonString !== 'string') return false;
    const raw = safeJsonParse<Record<string, unknown> | null>(jsonString, null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }

    const data = stripDangerousKeys(raw);

    if (Array.isArray(data.users)) this.saveUsers(data.users as User[]);
    if (Array.isArray(data.clients)) this.saveClients(data.clients as Client[]);
    if (Array.isArray(data.motorcycles)) this.saveMotorcycles(data.motorcycles as Motorcycle[]);
    if (Array.isArray(data.services)) this.saveServices(data.services as ServiceItem[]);
    if (Array.isArray(data.serviceCategories)) this.saveServiceCategories(data.serviceCategories as string[]);
    if (Array.isArray(data.products)) this.saveProducts(data.products as Product[]);
    if (Array.isArray(data.orders)) this.saveOrders(data.orders as ServiceOrder[]);
    if (Array.isArray(data.appointments)) this.saveAppointments(data.appointments as Appointment[]);
    if (Array.isArray(data.expenses)) this.saveExpenses(data.expenses as Expense[]);
    if (data.cashRegister && typeof data.cashRegister === 'object') {
      this.saveCashRegister(data.cashRegister as CashRegister);
    }
    if (Array.isArray(data.cashHistory)) this.saveCashHistory(data.cashHistory as CashRegister[]);
    if (Array.isArray(data.commissions)) this.saveCommissions(data.commissions as CommissionRecord[]);
    if (Array.isArray(data.coupons)) this.saveCoupons(data.coupons as LoyaltyCoupon[]);
    if (data.settings && typeof data.settings === 'object') {
      this.saveSettings(data.settings as CompanySettings);
    }
    if (Array.isArray(data.auditLogs)) this.saveAuditLogs(data.auditLogs as AuditLog[]);
    if (data.portalConfig && typeof data.portalConfig === 'object') {
      const incomingPortal = data.portalConfig as Partial<CustomerPortalConfig>;
      this.savePortalConfig({
        ...DEFAULT_PORTAL_CONFIG,
        ...incomingPortal,
        heroImageUrl: sanitizeImageUrl(incomingPortal.heroImageUrl) || '',
      });
    }
    if (data.motoCatalog && typeof data.motoCatalog === 'object') {
      this.saveMotoCatalog(data.motoCatalog as MotoCatalogState);
    }
    return true;
  },

  // Reset to initial seed data
  resetToDefaults() {
    // Preserva preferências locais (operador atual, modo cliente, avisos do PWA)
    // e republica os dados padrão no servidor para todos os dispositivos.
    const preserved: Array<[string, string]> = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        const isSyncable = key.startsWith('pk_detail_') && key !== STORAGE_KEYS.CURRENT_USER_ID && key !== STORAGE_KEYS.CLIENT_ONLY_LOCK;
        if (isSyncable) continue;
        const value = localStorage.getItem(key);
        if (value !== null) preserved.push([key, value]);
      }
    } catch {
      // armazenamento indisponível
    }

    try {
      localStorage.clear();
    } catch {
      // armazenamento indisponível
    }

    try {
      preserved.forEach(([key, value]) => localStorage.setItem(key, value));
    } catch {
      // armazenamento indisponível
    }

    const seeded = this.loadAll();
    // saveAll publica cada chave no servidor de tempo real (notifyRealtimeKey).
    this.saveAll(seeded);
    return seeded;
  },

  // Export LGPD customer data report
  exportClientLGPD(clientId: string): void {
    const all = this.loadAll();
    const client = all.clients.find(c => c.id === clientId);
    if (!client) return;
    const motorcycles = all.motorcycles.filter(m => m.clientId === clientId);
    const orders = all.orders.filter(o => o.clientId === clientId);
    const appointments = all.appointments.filter(a => a.clientId === clientId);

    const lgpdPayload = {
      empresa: 'PK Detail Estética Automotiva',
      relatorio: 'Dados Pessoais e Histórico do Titular (LGPD)',
      data_extracao: new Date().toISOString(),
      cliente: client,
      motocicletas: motorcycles,
      historico_ordens: orders,
      agendamentos: appointments
    };

    const blob = new Blob([JSON.stringify(lgpdPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lgpd_dados_${client.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
