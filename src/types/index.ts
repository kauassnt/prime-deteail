export type UserRole = 'admin' | 'gerente' | 'atendente' | 'operacional';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  active: boolean;
  hireDate: string;
  specialties: string[];
  commissionType: 'percent' | 'fixed' | 'none';
  commissionValue: number; // e.g. 15 for 15%, or 25.00 for R$ 25
}

export type LoyaltyTier = 'Bronze' | 'Prata' | 'Ouro' | 'Black';

export interface Client {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  document?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  totalSpent: number;
  visitsCount: number;
  lastVisitDate?: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  tags: ('vip' | 'frequente' | 'inativo' | 'novo')[];
}

export type MotoCategory =
  | 'Street'
  | 'Cub / Scooter'
  | 'Trail'
  | 'Big Trail'
  | 'Naked'
  | 'Esportiva'
  | 'Custom / Cruiser'
  | 'Touring'
  | 'Off-Road'
  | 'Elétrica'
  | 'Outro';

export interface MotoCatalogVersion {
  id: string;
  name: string;
  cc?: number;
  years: number[];
  fipeYearCodes?: string[];
}

export interface MotoCatalogBrand {
  id: string;
  name: string;
  normalizedName: string;
  country: string;
  popular?: boolean;
  fipeCode?: string;
  brandColor: string;
  monogram: string;
  logoUrl?: string;
  active: boolean;
  isCustom: boolean;
  source: 'seed' | 'fipe' | 'custom';
  modelsSyncedAt?: string;
}

export interface MotoCatalogModel {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  normalizedName: string;
  popularNames?: string[];
  cc: number;
  category: MotoCategory;
  years: number[];
  versions: MotoCatalogVersion[];
  fipeCode?: string;
  active: boolean;
  isCustom: boolean;
  source: 'seed' | 'fipe' | 'custom';
  yearsSyncedAt?: string;
}

export interface MotoCatalogState {
  brands: MotoCatalogBrand[];
  models: MotoCatalogModel[];
  lastSyncedAt?: string;
  sourceName: string;
  fipeBrandsCount: number;
  fipeModelsCount: number;
  lastSyncNote?: string;
}

export interface Motorcycle {
  id: string;
  clientId: string;
  clientName?: string;
  brand: string;
  model: string;
  version?: string;
  plate: string;
  color: string;
  cc: number;
  year: number;
  manufactureYear?: number;
  modelYear?: number;
  category?: MotoCategory | string;
  mileage?: number;
  notes?: string;
  photoUrl?: string;
  catalogBrandId?: string;
  catalogModelId?: string;
  isManualEntry?: boolean;
  catalogSource?: string;
}

export type ServiceCategory = string;

export interface ServiceProductUsage {
  productId: string;
  productName: string;
  estimatedQty: number;
  unit: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  price: number;
  estimatedMinutes: number;
  active: boolean;
  productsUsed: ServiceProductUsage[];
  warrantyDays: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  unit: 'ml' | 'L' | 'un' | 'g' | 'kg';
  costPrice: number;
  supplier: string;
  lastRestockedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'saida' | 'ajuste' | 'perda' | 'consumo_os';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  serviceOrderId?: string;
  operatorName: string;
  date: string;
}

export type OSStatus = 'para_fazer' | 'em_servico' | 'concluido' | 'entregue' | 'cancelado';
export type PaymentStatus = 'pendente' | 'parcial' | 'pago' | 'estornado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'transferencia';

export interface PaymentTransaction {
  id: string;
  serviceOrderId: string;
  amount: number;
  method: PaymentMethod;
  installments?: number;
  date: string;
  operatorName: string;
  notes?: string;
  status: 'confirmado' | 'estornado';
}

export interface ChecklistItemStatus {
  item: string;
  entryStatus: 'ok' | 'avaria' | 'sujo' | 'ausente';
  exitStatus?: 'ok' | 'avaria' | 'limpo';
  notes?: string;
}

export type InspectionPhotoAngle = 'dianteira' | 'traseira' | 'lado_esquerdo' | 'lado_direito';

export interface InspectionAnglePhotos {
  dianteira?: string;
  traseira?: string;
  lado_esquerdo?: string;
  lado_direito?: string;
}

export interface InspectionChecklist {
  entryDate: string;
  exitDate?: string;
  fuelLevel: 'reserva' | '1/4' | '1/2' | '3/4' | 'cheio';
  odometer?: number;
  items: ChecklistItemStatus[];
  accessoriesLeft: string[];
  entryNotes?: string;
  exitNotes?: string;
  inspectorName?: string;
  customerSignatureConfirmed?: boolean;
  anglePhotosBefore?: InspectionAnglePhotos;
}

export interface ServiceOrder {
  id: string; // e.g. OS-2026-001
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  motorcycleId: string;
  motorcycleBrand: string;
  motorcycleModel: string;
  motorcycleVersion?: string;
  motorcycleYear?: number;
  motorcycleCategory?: string;
  motorcyclePlate: string;
  status: OSStatus;
  paymentStatus: PaymentStatus;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  entryDateTime: string;
  promisedDateTime?: string;
  completedDateTime?: string;
  deliveredDateTime?: string;
  services: {
    serviceId: string;
    serviceName: string;
    price: number;
    estimatedMinutes: number;
  }[];
  productsConsumed: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    cost: number;
  }[];
  subtotal: number;
  discount: number;
  addition: number;
  total: number;
  amountPaid: number;
  pendingBalance: number;
  paymentTransactions: PaymentTransaction[];
  checklist: InspectionChecklist;
  photosBefore: string[];
  photosAfter: string[];
  notes?: string;
  warrantyUntil?: string;
  commissionCalculated: boolean;
  commissionAmount: number;
  commissionPaid: boolean;
  includePhotosInPdf?: boolean;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  motorcycleId?: string;
  motorcyclePlate: string;
  motorcycleBrand?: string;
  motorcycleModel: string;
  motorcycleVersion?: string;
  motorcycleYear?: number;
  motorcycleCategory?: string;
  serviceIds: string[];
  serviceNames: string[];
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  status: 'agendado' | 'confirmado' | 'em_atendimento' | 'concluido' | 'cancelado' | 'nao_compareceu';
  notes?: string;
  serviceOrderId?: string;
  isOnlineBooking?: boolean;
  requestedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  photos?: string[];
  checklistItems?: string[];
  includePhotosInPdf?: boolean;
}

export type ExpenseCategory =
  | 'Produtos'
  | 'Materiais'
  | 'Equipamentos'
  | 'Água'
  | 'Energia'
  | 'Aluguel'
  | 'Internet'
  | 'Manutenção'
  | 'Funcionários'
  | 'Marketing'
  | 'Outros';

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: 'pendente' | 'pago';
  paymentMethod?: PaymentMethod;
  receiptName?: string;
  notes?: string;
}

export interface CashMovement {
  id: string;
  timestamp: string;
  type: 'abertura' | 'entrada_os' | 'suprimento' | 'sangria' | 'despesa' | 'fechamento';
  amount: number;
  paymentMethod: PaymentMethod | 'saldo_inicial';
  description: string;
  relatedOrderId?: string;
  relatedExpenseId?: string;
  operatorName: string;
}

export interface CashRegister {
  id: string;
  openedAt: string;
  closedAt?: string;
  status: 'aberto' | 'fechado';
  operatorId: string;
  operatorName: string;
  initialBalance: number;
  totalIn: number;
  totalOut: number;
  expectedBalance: number;
  actualCountedBalance?: number;
  difference?: number;
  movements: CashMovement[];
  notes?: string;
}

export interface CommissionRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  serviceOrderId: string;
  orderNumber: string;
  serviceNames: string;
  orderTotal: number;
  commissionRate: string;
  commissionAmount: number;
  date: string;
  status: 'aprovada' | 'paga' | 'cancelada';
  paidAt?: string;
}

export interface WarrantyClaim {
  id: string;
  originalOrderId: string;
  clientName: string;
  clientPhone: string;
  motorcyclePlate: string;
  reportedDate: string;
  problemDescription: string;
  photos: string[];
  status: 'em_analise' | 'aprovada' | 'recusada' | 'concluida';
  resolutionNotes?: string;
  assignedEmployeeName?: string;
  resolvedAt?: string;
}

export interface LoyaltyCoupon {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  expiryDate: string;
  timesUsed: number;
  maxUses?: number;
  active: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
}

export interface CompanySettings {
  name: string;
  fantasyName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  openingTime: string;
  closingTime: string;
  operatingDays: string[];
  autoStockDeduction: boolean;
  commissionsEnabled?: boolean;
  loyaltyPointsPerReal: number;
  theme: 'light' | 'dark';
  state?: string;
  documentColor?: string;
  showServiceDescriptions?: boolean;
}

export type WhatsAppDeliveryMode = 'link_direto' | 'webhook_api';

export interface WhatsAppAutomationConfig {
  autoSendOnStatusChange: boolean;
  deliveryMode: WhatsAppDeliveryMode;
  webhookUrl: string;
  webhookToken: string;
  enabledStatuses: Record<OSStatus, boolean>;
  templates: Record<OSStatus, string>;
}

export interface WhatsAppMessageLog {
  id: string;
  orderId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  statusTrigger: OSStatus | 'manual';
  templateLabel: string;
  message: string;
  whatsappUrl: string;
  mode: WhatsAppDeliveryMode;
  deliveryStatus: 'enviando' | 'enviada' | 'pronta_para_envio' | 'erro';
  timestamp: string;
  errorMessage?: string;
}

export interface PortalHighlightCard {
  title: string;
  description: string;
}

export interface StorefrontBusinessHour {
  day: string;
  open: boolean;
  start: string;
  end: string;
}

export interface StorefrontSettings {
  slug: string;
  accentColor: string;
  description: string;
  googleMapsUrl: string;
  publishedServiceIds: string[];
  state: string;
  hours: StorefrontBusinessHour[];
}

export interface CustomerPortalConfig {
  storefront?: StorefrontSettings;
  portalEnabled: boolean;
  maintenanceMessage: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  promoNotice: string;
  showHeroImage: boolean;
  heroImageUrl: string;
  allowOnlineBooking: boolean;
  allowOrderTracking: boolean;
  allowServicesCatalog: boolean;
  showPrices: boolean;
  showBeforeAfterPhotos: boolean;
  showPaymentSummaryInTracking: boolean;
  showLocationAndHours: boolean;
  showWhatsappButton: boolean;
  showStudioHighlights: boolean;
  bookingConfirmationMessage: string;
  availableTimeSlots: string[];
  highlightCards: PortalHighlightCard[];
  kioskPin: string;
}

export type BrandLogoFormat = 'PNG' | 'JPG' | 'JPEG' | 'WEBP' | 'SVG';

export interface BrandLogoRecord {
  id: string;
  filePath: string;
  assetUrl: string;
  fileName: string;
  format: BrandLogoFormat;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  updatedBy: string;
  updatedById: string;
  updatedByRole: UserRole | string;
  version: number;
}

export interface BrandIdentityAuditEvent {
  id: string;
  action: 'ANEXAR_LOGO' | 'ALTERAR_LOGO' | 'REMOVER_LOGO';
  logoId?: string;
  fileName?: string;
  format?: BrandLogoFormat;
  version: number;
  timestamp: string;
  userName: string;
  userRole: string;
  details: string;
}

export interface BrandIdentityState {
  activeLogo: BrandLogoRecord | null;
  version: number;
  isDefault: boolean;
  updatedAt: string;
  audit: BrandIdentityAuditEvent[];
}
