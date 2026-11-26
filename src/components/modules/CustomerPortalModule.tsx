import React, { useState, useMemo, useEffect } from 'react';
import { companyDisplayName } from '../../utils/company';

import { useApp } from '../../context/AppContext';
import {
  Bike,
  Calendar,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldCheck,
  Camera,
  SlidersHorizontal,
  Eye,
  Lock,
  Copy,
  Check,
  MessageCircle,
  Wrench,
  AlertCircle,
  Sparkles
} from 'lucide-react';
// Confetti sob demanda (o portal abre mais leve; o efeito carrega só no sucesso).
function firePortalConfetti(): void {
  void import('canvas-confetti')
    .then(mod => {
      try {
        mod.default({ particleCount: 50, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
      } catch {
        /* efeito opcional */
      }
    })
    .catch(() => undefined);
}
import { MonthCalendarCard } from '../common/MonthCalendarCard';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { BrandLogo } from '../common/BrandLogo';
import { CustomerPortalConfigPanel } from './CustomerPortalConfigPanel';
import { useCurrentDate, getLocalDateStr, formatDateBR, parseLocalDate } from '../../utils/dateUtils';
import {
  DEFAULT_WASH_DURATION_MINUTES,
  findConflictingAppointment,
  formatSlotRange,
  getAvailableSlotsForDate,
  minutesToTime,
  timeToMinutes
} from '../../utils/schedulingUtils';
import { StorageService } from '../../services/storageService';
import { submitOnlineBooking } from '../../services/realtimeService';
import { buildWhatsappLink, normalizeBrazilWhatsappDigits } from '../../utils/whatsappUtils';
import defaultStudioHeroImg from '../../assets/images/pk_detail_hero_studio_1794590546785.jpg';
import {
  SmartMotorcycleSelector,
  MotorcycleFormDraft,
} from '../common/SmartMotorcycleSelector';
import { MotoCategory } from '../../types';
import {
  focusElementSafely,
  formatPhoneBR,
  validateMotorcycleDraft,
  validatePersonName,
  validatePhoneBR,
} from '../../utils/inputValidation';

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function createEmptyPortalMotoDraft(): MotorcycleFormDraft {
  const yr = new Date().getFullYear();
  return {
    brand: '',
    model: '',
    version: '',
    year: yr,
    manufactureYear: yr,
    modelYear: yr,
    cc: 160,
    category: 'Street',
    color: 'Padrão',
    plate: '',
    mileage: 0,
    notes: '',
  };
}

interface CustomerPortalModuleProps {
  isStandalone?: boolean;
}

type PortalTab = 'agendar' | 'consultar' | 'servicos';

const ORDER_STEPS = [
  { key: 'para_fazer', label: 'Recebida no Estúdio', shortLabel: 'Recebida', icon: Clock },
  { key: 'em_servico', label: 'Em Execução na Baia', shortLabel: 'Em Serviço', icon: Wrench },
  { key: 'concluido', label: 'Pronta para Retirada', shortLabel: 'Pronta', icon: CheckCircle2 },
  { key: 'entregue', label: 'Entregue ao Cliente', shortLabel: 'Entregue', icon: Bike },
] as const;

export const CustomerPortalModule: React.FC<CustomerPortalModuleProps> = ({ isStandalone = false }) => {
  const {
    currentUser,
    services,
    settings,
    orders,
    appointments,
    portalConfig,
    isPublicPortalUrl,
    enterClientOnlyMode,
    exitClientOnlyMode,
    createAppointment,
    cancelAppointment,
    createClient,
    createMotorcycle
  } = useApp();

  const { todayStr } = useCurrentDate();
  const isAdminPreview = !isStandalone && currentUser.role === 'admin';

  const [adminView, setAdminView] = useState<'preview' | 'config'>('preview');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Determine available tabs based on Admin config
  const enabledTabs = useMemo(() => {
    const list: { id: PortalTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [];
    if (portalConfig.allowOnlineBooking) {
      list.push({ id: 'agendar', label: 'Agendamento Online', shortLabel: 'Agendar', icon: Calendar });
    }
    if (portalConfig.allowOrderTracking) {
      list.push({ id: 'consultar', label: 'Acompanhar Minha Moto', shortLabel: 'Acompanhar', icon: Search });
    }
    if (portalConfig.allowServicesCatalog) {
      list.push({ id: 'servicos', label: 'Serviços & Preços', shortLabel: 'Serviços', icon: Sparkles });
    }
    return list;
  }, [portalConfig.allowOnlineBooking, portalConfig.allowOrderTracking, portalConfig.allowServicesCatalog]);

  const [activeTab, setActiveTab] = useState<PortalTab>(() => enabledTabs[0]?.id || 'agendar');

  useEffect(() => {
    if (enabledTabs.length > 0 && !enabledTabs.some(t => t.id === activeTab)) {
      setActiveTab(enabledTabs[0].id);
    }
  }, [enabledTabs, activeTab]);

  // Hero & gallery image resilience
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedOrderPhotoKeys, setFailedOrderPhotoKeys] = useState<Record<string, boolean>>({});
  const heroImageSrc = portalConfig.heroImageUrl?.trim() ? portalConfig.heroImageUrl : defaultStudioHeroImg;

  useEffect(() => {
    setHeroImgFailed(false);
  }, [heroImageSrc]);

  // Booking State
  const activeServices = useMemo(() => services.filter(s => s.active), [services]);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('Todos');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('Todos');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => activeServices[0]?.id || '');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [motoDraft, setMotoDraft] = useState<MotorcycleFormDraft>(() => createEmptyPortalMotoDraft());
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingDate, setBookingDate] = useState(() => todayStr);
  const [viewMonthDate, setViewMonthDate] = useState(() => todayStr);

  const availableSlotsForSelectedDate = useMemo(
    () =>
      getAvailableSlotsForDate(
        portalConfig.availableTimeSlots,
        appointments,
        bookingDate,
        DEFAULT_WASH_DURATION_MINUTES
      ),
    [portalConfig.availableTimeSlots, appointments, bookingDate]
  );

  const [bookingTime, setBookingTime] = useState(() => availableSlotsForSelectedDate[0] || '');
  const [bookingError, setBookingError] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  // Guarda o horário realmente enviado: os slots são recalculados após a reserva
  // e o resumo não pode mostrar um horário diferente do agendado.
  const [submittedSlot, setSubmittedSlot] = useState<{ date: string; time: string } | null>(null);

  // Mantém bookingTime sempre apontando apenas para um horário realmente disponível na data selecionada
  useEffect(() => {
    if (availableSlotsForSelectedDate.length === 0) {
      if (bookingTime !== '') setBookingTime('');
      return;
    }
    if (!availableSlotsForSelectedDate.includes(bookingTime)) {
      setBookingTime(availableSlotsForSelectedDate[0]);
    }
  }, [availableSlotsForSelectedDate, bookingTime]);

  // Sync bookingDate floor if day rolled over and bookingDate is still before todayStr
  useEffect(() => {
    if (bookingDate < todayStr) {
      setBookingDate(todayStr);
      setViewMonthDate(todayStr);
    }
  }, [todayStr, bookingDate]);

  // Ensure a valid selectedServiceId
  useEffect(() => {
    if (activeServices.length > 0 && !activeServices.some(s => s.id === selectedServiceId)) {
      setSelectedServiceId(activeServices[0].id);
    }
  }, [activeServices, selectedServiceId]);

  const serviceCategories = useMemo(() => {
    const cats = Array.from(new Set(activeServices.map(s => s.category)));
    return ['Todos', ...cats];
  }, [activeServices]);

  const filteredBookingServices = useMemo(() => {
    if (serviceCategoryFilter === 'Todos') return activeServices;
    return activeServices.filter(s => s.category === serviceCategoryFilter);
  }, [activeServices, serviceCategoryFilter]);

  const filteredCatalogServices = useMemo(() => {
    if (catalogCategoryFilter === 'Todos') return activeServices;
    return activeServices.filter(s => s.category === catalogCategoryFilter);
  }, [activeServices, catalogCategoryFilter]);

  const selectedService = activeServices.find(s => s.id === selectedServiceId) || activeServices[0];

  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const apt of appointments) {
      if (apt.status === 'cancelado') continue;
      counts[apt.date] = (counts[apt.date] || 0) + 1;
    }
    return counts;
  }, [appointments]);

  const handleChangeMonth = (deltaMonths: number) => {
    const base = parseLocalDate(`${viewMonthDate.slice(0, 7)}-01`);
    base.setMonth(base.getMonth() + deltaMonths);
    setViewMonthDate(getLocalDateStr(base));
  };

  // Search by Plate or OS ID
  const [plateSearch, setPlateSearch] = useState('');
  const [plateSearchError, setPlateSearchError] = useState('');
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; label: string } | null>(null);

  // Admin Unlock Modal (for standalone kiosk mode only, hidden on ?portal=1)
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const trackedOrder = useMemo(
    () => (trackedOrderId ? orders.find(o => o.id === trackedOrderId) || null : null),
    [orders, trackedOrderId]
  );

  const cleanWhatsappDigits = normalizeBrazilWhatsappDigits(settings.whatsapp || settings.phone);
  const whatsappDirectUrl = buildWhatsappLink(
    settings.whatsapp || settings.phone,
    `Olá! Vim pelo Portal do Cliente da ${companyDisplayName(settings)} e gostaria de atendimento.`
  );

  const publicPortalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?portal=1`
      : '?portal=1';

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicPortalUrl);
    } catch {
      const input = document.createElement('input');
      input.value = publicPortalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const scrollToWorkspace = (targetTab?: PortalTab) => {
    if (targetTab) setActiveTab(targetTab);
    const el = document.getElementById('portal-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [portalShowValidation, setPortalShowValidation] = useState(false);
  const pinInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (unlockModalOpen) {
      focusElementSafely(pinInputRef.current, { skipOnTouch: true });
    }
  }, [unlockModalOpen]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setPortalShowValidation(true);

    const nameCheck = validatePersonName(clientName, 'Nome completo');
    if (!nameCheck.valid) {
      setBookingError(nameCheck.error || 'Informe seu nome completo para identificarmos a reserva.');
      return;
    }

    const phoneCheck = validatePhoneBR(clientPhone, 'WhatsApp', true);
    if (!phoneCheck.valid) {
      setBookingError(phoneCheck.error || 'Informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const motoCheck = validateMotorcycleDraft(motoDraft, { plateRequired: true });
    if (!motoCheck.valid) {
      setBookingError(motoCheck.firstError || 'Verifique os dados da motocicleta.');
      return;
    }

    const cleanName = clientName.trim();
    const phoneDigits = clientPhone.replace(/\D/g, '');
    const cleanPlate = motoDraft.plate.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');

    if (!selectedService) {
      setBookingError('Selecione ao menos um serviço desejado.');
      return;
    }
    if (!bookingTime || !availableSlotsForSelectedDate.includes(bookingTime)) {
      setBookingError('Nenhum horário disponível selecionado para esta data. Escolha outra data ou horário disponível.');
      return;
    }
    const latestAppointments = StorageService.loadAll().appointments;
    const existingConflict =
      findConflictingAppointment(appointments, bookingDate, bookingTime, DEFAULT_WASH_DURATION_MINUTES) ||
      findConflictingAppointment(latestAppointments, bookingDate, bookingTime, DEFAULT_WASH_DURATION_MINUTES);
    if (existingConflict) {
      setBookingError('Este horário já foi reservado. Selecione outro horário disponível.');
      return;
    }

    const blockMinutes = DEFAULT_WASH_DURATION_MINUTES;
    const startMins = timeToMinutes(bookingTime);
    const endTime = minutesToTime(startMins + blockMinutes);

    const newClient = createClient({
      name: cleanName,
      phone: clientPhone.trim(),
      whatsapp: phoneDigits,
      email: `${cleanName.toLowerCase().replace(/\s+/g, '.')}@cliente.com`,
      notes: 'Cadastrado via Portal Online'
    });

    const createdMoto = createMotorcycle({
      clientId: newClient.id,
      clientName: newClient.name,
      brand: motoDraft.brand.trim(),
      model: motoDraft.model.trim() || 'Modelo Informado',
      version: motoDraft.version.trim() || undefined,
      plate: cleanPlate,
      color: motoDraft.color.trim() || 'Padrão',
      cc: Number(motoDraft.cc) || 160,
      year: Number(motoDraft.modelYear || motoDraft.year) || new Date().getFullYear(),
      manufactureYear: Number(motoDraft.manufactureYear || motoDraft.year) || undefined,
      modelYear: Number(motoDraft.modelYear || motoDraft.year) || undefined,
      category: (motoDraft.category as MotoCategory) || 'Street',
      catalogBrandId: motoDraft.catalogBrandId,
      catalogModelId: motoDraft.catalogModelId,
      isManualEntry: motoDraft.isManualEntry,
    });

    const created = createAppointment({
      clientId: newClient.id,
      clientName: cleanName,
      clientPhone: clientPhone.trim(),
      motorcycleId: createdMoto.id,
      motorcyclePlate: cleanPlate,
      motorcycleBrand: motoDraft.brand.trim(),
      motorcycleModel: `${motoDraft.brand.trim()} ${motoDraft.model.trim()}`.trim(),
      motorcycleVersion: motoDraft.version.trim() || undefined,
      motorcycleYear: Number(motoDraft.modelYear || motoDraft.year) || undefined,
      motorcycleCategory: motoDraft.category || undefined,
      serviceIds: [selectedService.id],
      serviceNames: [selectedService.name],
      assignedEmployeeId: '',
      assignedEmployeeName: 'A Distribuir',
      date: bookingDate,
      startTime: bookingTime,
      endTime,
      durationMinutes: blockMinutes,
      status: 'agendado',
      notes: bookingNotes.trim()
        ? `Portal Online: ${bookingNotes.trim()}`
        : 'Solicitação realizada pelo Portal do Cliente Web',
      isOnlineBooking: true
    });

    if (!created) {
      setBookingError('Este horário acabou de ser reservado por outro cliente. Escolha outro horário disponível.');
      return;
    }

    // Envia para o servidor compartilhado: o estúdio recebe a reserva
    // instantaneamente, mesmo que ela tenha sido feita em outro celular.
    const bookingResult = await submitOnlineBooking({
      appointment: created,
      client: newClient,
      motorcycle: createdMoto,
    });
    if (bookingResult === 'conflict') {
      cancelAppointment(created.id);
      setBookingError('Este horário acabou de ser reservado por outro cliente. Escolha outro horário disponível.');
      return;
    }

    setSubmittedSlot({ date: bookingDate, time: bookingTime });
    setSubmittedSuccess(true);
    try {
      firePortalConfetti();
    } catch {}
  };

  const handleSearchPlate = (e: React.FormEvent) => {
    e.preventDefault();
    setPlateSearchError('');
    const clean = plateSearch.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 3) {
      setPlateSearchError('Digite ao menos 3 caracteres da placa (ex: BMW9G82) ou número da OS (ex: OS-2026-001).');
      return;
    }
    const matching = orders
      .filter(
        o =>
          o.motorcyclePlate.replace(/[^A-Z0-9]/g, '') === clean ||
          o.id.toUpperCase().replace(/[^A-Z0-9]/g, '') === clean
      )
      .sort((a, b) => new Date(b.entryDateTime).getTime() - new Date(a.entryDateTime).getTime());
    setTrackedOrderId(matching[0]?.id || null);
    setHasSearched(true);
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await exitClientOnlyMode(pinInput);
    if (!ok) {
      setPinError('PIN administrativo incorreto.');
      return;
    }
    setPinInput('');
    setPinError('');
    setUnlockModalOpen(false);
  };

  const getOrderStageIndex = (status: string): number => {
    switch (status) {
      case 'para_fazer':
        return 0;
      case 'em_servico':
        return 1;
      case 'concluido':
        return 2;
      case 'entregue':
        return 3;
      default:
        return -1;
    }
  };

  // --- ADMIN CONFIGURATION VIEW ---
  if (isAdminPreview && adminView === 'config') {
    return (
      <div className="pk-section-stack text-left min-w-0">
        <div className="bg-white rounded-2xl border border-slate-200/80 pk-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Configuração do Portal do Cliente
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize textos, módulos habilitados, visibilidade de preços e acesso exclusivo para clientes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdminView('preview')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4 shrink-0" />
            <span>Voltar para Prévia do Portal</span>
          </button>
        </div>

        <CustomerPortalConfigPanel onOpenPreview={() => setAdminView('preview')} />
      </div>
    );
  }

  return (
    <div className="min-w-0 flex flex-col min-h-full">
      {/* ADMIN TOOLBAR (Strictly hidden from Clients in Standalone / Restricted Mode) */}
      {isAdminPreview && (
        <div className="mb-3.5 sm:mb-4 bg-white rounded-2xl border border-slate-200/80 pk-card-compact sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0">
            <span className="font-bold text-slate-900">Painel do Administrador — Portal do Cliente</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className={`font-semibold ${portalConfig.portalEnabled ? 'text-[#9A3412]' : 'text-rose-700'}`}>
              {portalConfig.portalEnabled ? 'Portal Online' : 'Em Manutenção'}
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-slate-500 tabular-nums">
              {enabledTabs.length} {enabledTabs.length === 1 ? 'seção ativa' : 'seções ativas'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#EA580C] shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
              <span>{copiedUrl ? 'Link Copiado' : 'Copiar Link Público'}</span>
            </button>

            <button
              type="button"
              onClick={() => enterClientOnlyMode(true)}
              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
              <span>Modo Cliente Exclusivo</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('config')}
              className="min-h-[38px] px-4 py-2 rounded-xl bg-[#9A3412] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Configurar Portal</span>
            </button>
          </div>
        </div>
      )}

      {/* STANDALONE PUBLIC TOP BAR (3-Zone Contract: Wordmark | Single-line Nav Links | Primary CTA) */}
      {isStandalone && (
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 safe-area-top">
          <div className="max-w-[1280px] mx-auto px-3 sm:px-5 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-8">
            {/* Zone 1: Single clean wordmark / official brand logo element */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center shrink-0 text-left"
              aria-label={companyDisplayName(settings)}
            >
              <BrandLogo
                variant="portal"
                companyName={companyDisplayName(settings)}
              />
            </button>

            {/* Zone 2: Concise single-line navigation links */}
            {portalConfig.portalEnabled && enabledTabs.length > 0 && (
              <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
                {enabledTabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => scrollToWorkspace(tab.id)}
                    className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'text-slate-900 border-[#EA580C]'
                        : 'border-transparent hover:text-slate-900'
                    }`}
                  >
                    {tab.shortLabel}
                  </button>
                ))}
                {portalConfig.showLocationAndHours && (
                  <a
                    href="#portal-studio-info"
                    className="py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    Estúdio
                  </a>
                )}
              </nav>
            )}

            {/* Zone 3: 1 primary action */}
            <div className="flex items-center shrink-0">
              {portalConfig.showWhatsappButton && cleanWhatsappDigits ? (
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>WhatsApp</span>
                </a>
              ) : portalConfig.portalEnabled && portalConfig.allowOnlineBooking ? (
                <button
                  type="button"
                  onClick={() => scrollToWorkspace('agendar')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition whitespace-nowrap shrink-0"
                >
                  Agendar Serviço
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                  Atendimento Digital
                </span>
              )}
            </div>
          </div>
        </header>
      )}

      {/* MAIN PORTAL CONTAINER */}
      <div
        className={`flex-1 w-full ${
          isStandalone ? 'max-w-[1280px] mx-auto px-3 sm:px-5 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6' : 'pk-section-stack'
        }`}
      >
        {/* MAINTENANCE MODE VIEW (if Admin paused portal) */}
        {!portalConfig.portalEnabled ? (
          <section className="bg-[#141414] text-white rounded-2xl border border-neutral-800 p-6 sm:p-10 text-center space-y-4">
            <div className="flex justify-center">
              <BrandLogo
                variant="icon"
                companyName={companyDisplayName(settings)}
              />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <span className="text-xs font-semibold text-[#F97316] block">
                {companyDisplayName(settings)}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
                Portal Temporariamente Indisponível
              </h1>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {portalConfig.maintenanceMessage}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {portalConfig.showWhatsappButton && cleanWhatsappDigits && (
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Falar no WhatsApp</span>
                </a>
              )}
              {isAdminPreview && (
                <button
                  type="button"
                  onClick={() => setAdminView('config')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 text-xs sm:text-sm font-bold transition whitespace-nowrap"
                >
                  Reativar Portal nas Configurações
                </button>
              )}
            </div>

            {portalConfig.showLocationAndHours && (
              <p className="text-xs text-neutral-400 pt-4 border-t border-neutral-800 max-w-lg mx-auto">
                {settings.address} · Atendimento das {settings.openingTime} às {settings.closingTime}
              </p>
            )}
          </section>
        ) : (
          <>
            {/* HERO SECTION: 2-Column Editorial Split */}
            <section className="bg-[#141414] text-white rounded-2xl border border-neutral-800 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div
                  className={`${
                    portalConfig.showHeroImage ? 'lg:col-span-7' : 'lg:col-span-12'
                  } p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-4 sm:gap-5 min-w-0`}
                >
                  <div className="space-y-4">
                    {portalConfig.heroBadge && (
                      <span className="text-xs font-semibold text-[#F97316] block">
                        {portalConfig.heroBadge}
                      </span>
                    )}
                    <h1
                      className="font-extrabold tracking-tight leading-[1.12] text-white text-balance max-w-2xl"
                      style={{ fontSize: 'clamp(1.65rem, 3vw, 2.65rem)' }}
                    >
                      {portalConfig.heroTitle}
                    </h1>
                    <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
                      {portalConfig.heroSubtitle}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                      {portalConfig.allowOnlineBooking ? (
                        <button
                          type="button"
                          onClick={() => scrollToWorkspace('agendar')}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
                        >
                          <span>Agendar Serviço Agora</span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                      ) : portalConfig.allowOrderTracking ? (
                        <button
                          type="button"
                          onClick={() => scrollToWorkspace('consultar')}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
                        >
                          <span>Acompanhar Minha Moto</span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                      ) : null}

                      {portalConfig.allowOnlineBooking && portalConfig.allowOrderTracking && (
                        <button
                          type="button"
                          onClick={() => scrollToWorkspace('consultar')}
                          className="min-h-[44px] px-4 py-2.5 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-200 text-xs sm:text-sm font-semibold transition whitespace-nowrap shrink-0"
                        >
                          Consultar Andamento pela Placa
                        </button>
                      )}
                    </div>

                    {portalConfig.showLocationAndHours && (
                      <div className="pt-4 border-t border-neutral-800/90 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-400">
                        <span className="wrap-anywhere">{settings.address}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {settings.openingTime} às {settings.closingTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{settings.phone || settings.whatsapp}</span>
                      </div>
                    )}
                  </div>
                </div>

                {portalConfig.showHeroImage && (
                  <div className="lg:col-span-5 relative min-h-[220px] sm:min-h-[280px] lg:min-h-full bg-neutral-900">
                    {!heroImgFailed ? (
                      <>
                        <img
                          src={heroImageSrc}
                          alt="Estúdio PK Detail com motocicleta após detalhamento técnico"
                          decoding="async"
                          fetchpriority="high"
                          referrerPolicy="no-referrer"
                          onError={() => setHeroImgFailed(true)}
                          className="w-full h-full object-cover lg:absolute lg:inset-0"
                        />
                        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/20 to-transparent pointer-events-none" />
                      </>
                    ) : (
                      <div className="w-full h-full min-h-[240px] bg-gradient-to-br from-neutral-900 via-neutral-800 to-[#9A3412]/40 flex flex-col items-center justify-center p-6 text-center gap-2">
                        <Bike className="w-12 h-12 text-[#F97316]" />
                        <span className="text-xs font-semibold text-neutral-300">
                          {companyDisplayName(settings)} — Estética Especializada
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* OPTIONAL PROMO / ANNOUNCEMENT STRIP */}
            {portalConfig.promoNotice.trim() !== '' && (
              <div className="bg-[#FFFBF7] border border-[#EA580C]/30 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#9A3412]">
                <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
                <span className="leading-relaxed">{portalConfig.promoNotice}</span>
              </div>
            )}

            {/* STUDIO HIGHLIGHTS (3 Editorial Pillars) */}
            {portalConfig.showStudioHighlights && portalConfig.highlightCards.length > 0 && (
              <section className="grid grid-cols-1 md:grid-cols-3 pk-grid-gap">
                {portalConfig.highlightCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-1.5 min-w-0"
                  >
                    <span className="text-xs font-bold text-[#9A3412] tabular-nums block">
                      0{idx + 1}.
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 leading-snug">{card.title}</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>
                  </div>
                ))}
              </section>
            )}

            {/* INTERACTIVE WORKSPACE */}
            {enabledTabs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center space-y-1.5">
                <p className="text-sm font-bold text-slate-900">Nenhuma seção interativa habilitada no momento.</p>
                <p className="text-xs text-slate-500">
                  Entre em contato diretamente pelo WhatsApp para atendimento personalizado.
                </p>
              </div>
            ) : (
              <section id="portal-workspace" className="pk-section-stack scroll-mt-20">
                {/* Segmented Section Tabs */}
                <div className="bg-white p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 grid grid-flow-col auto-cols-fr gap-1 sm:gap-1.5 min-w-0">
                  {enabledTabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-[42px] py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 min-w-0 ${
                          isActive
                            ? 'bg-[#171717] text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-[#F97316]' : 'text-slate-400'}`} />
                        <span className="sm:hidden truncate">{tab.shortLabel}</span>
                        <span className="hidden sm:inline truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: AGENDAMENTO ONLINE */}
                {activeTab === 'agendar' && portalConfig.allowOnlineBooking && (
                  <div className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 w-full min-w-0">
                    {submittedSuccess ? (
                      <div className="py-6 sm:py-8 px-3 max-w-lg mx-auto text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFEDD5] text-[#9A3412] flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-xl font-extrabold text-slate-900">
                            Solicitação Recebida com Sucesso
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {portalConfig.bookingConfirmationMessage}
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Motocicleta / Placa</span>
                            <span className="font-bold text-slate-900 font-mono tabular-nums">
                              {motoDraft.brand} {motoDraft.model}{motoDraft.version ? ` ${motoDraft.version}` : ''} · {motoDraft.plate.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Serviço</span>
                            <span className="font-semibold text-slate-900">{selectedService?.name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Data e Horário</span>
                            <span className="font-bold text-[#9A3412] tabular-nums">
                              {formatDateBR(submittedSlot?.date || bookingDate)} · {submittedSlot?.time || bookingTime}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSubmittedSuccess(false);
                              setBookingNotes('');
                            }}
                            className="min-h-[42px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition whitespace-nowrap"
                          >
                            Fazer Outro Agendamento
                          </button>

                          {portalConfig.showWhatsappButton && cleanWhatsappDigits && (
                            <a
                              href={buildWhatsappLink(
                                settings.whatsapp || settings.phone,
                                `Olá! Acabei de solicitar um agendamento pelo Portal da ${
                                  companyDisplayName(settings)
                                }:\n• Cliente: ${clientName}\n• Moto/Placa: ${motoDraft.brand} ${motoDraft.model} (${motoDraft.plate.toUpperCase()})\n• Serviço: ${
                                  selectedService?.name || ''
                                }\n• Data/Horário: ${formatDateBR(bookingDate)} às ${bookingTime}`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
                            >
                              <MessageCircle className="w-4 h-4 shrink-0" />
                              <span>Confirmar via WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleBookingSubmit} noValidate className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:gap-7 text-xs items-start">
                        {/* Left 7 Cols: Service + Customer + Bike */}
                        <div className="xl:col-span-7 space-y-5 min-w-0">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <h2 className="text-base font-extrabold text-slate-900">
                                01. Escolha o Serviço
                              </h2>
                              <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1 min-w-0">
                                {serviceCategories.map(cat => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setServiceCategoryFilter(cat)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap shrink-0 ${
                                      serviceCategoryFilter === cat
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {filteredBookingServices.map(s => {
                                const isSelected = selectedServiceId === s.id;
                                return (
                                  <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => setSelectedServiceId(s.id)}
                                    className={`text-left p-4 rounded-xl border transition min-w-0 ${
                                      isSelected
                                        ? 'bg-[#FFFBF7] border-[#EA580C] ring-1 ring-[#EA580C]/30'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className={`font-bold text-xs leading-snug ${isSelected ? 'text-[#9A3412]' : 'text-slate-900'}`}>
                                        {s.name}
                                      </span>
                                      <span className="font-mono font-bold text-xs text-slate-900 shrink-0 tabular-nums">
                                        {portalConfig.showPrices ? brl(s.price) : 'Sob consulta'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                                      <span>{s.category}</span>
                                      <span aria-hidden="true">·</span>
                                      <span className="tabular-nums">{s.estimatedMinutes} min</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-3 pt-5 border-t border-slate-100">
                            <h2 className="text-base font-extrabold text-slate-900">02. Seus Dados de Contato</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                                <input
                                  type="text"
                                  autoComplete="name"
                                  value={clientName}
                                  onChange={e => {
                                    setClientName(e.target.value);
                                    setBookingError('');
                                  }}
                                  placeholder="Ex: Marcos Oliveira"
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">WhatsApp para Confirmação *</label>
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  maxLength={16}
                                  value={clientPhone}
                                  onChange={e => {
                                    setClientPhone(formatPhoneBR(e.target.value));
                                    setBookingError('');
                                  }}
                                  placeholder="(11) 99999-9999"
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 pt-5 border-t border-slate-100">
                            <h2 className="text-base font-extrabold text-slate-900">03. Motocicleta</h2>
                            <SmartMotorcycleSelector
                              value={motoDraft}
                              onChange={next => {
                                setMotoDraft(next);
                                setBookingError('');
                              }}
                              registeredMotorcycles={[]}
                              variant="portal"
                              showPlateAndColor
                              showMileageAndNotes={false}
                              allowCatalogSave={false}
                              showValidation={portalShowValidation}
                            />

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                Observações para o Estúdio (opcional)
                              </label>
                              <input
                                type="text"
                                value={bookingNotes}
                                onChange={e => setBookingNotes(e.target.value)}
                                placeholder="Ex: Atenção ao escapamento titânio / avisar 30min antes"
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right 5 Cols: Calendar, Time Slots & Live Summary */}
                        <div className="xl:col-span-5 space-y-5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-base font-extrabold text-slate-900">04. Data e Horário</h2>
                            <span className="text-xs font-bold text-[#9A3412] tabular-nums">
                              {bookingTime
                                ? `${formatDateBR(bookingDate)} · ${formatSlotRange(bookingTime)}`
                                : `${formatDateBR(bookingDate)} · Sem vagas`}
                            </span>
                          </div>

                          <MonthCalendarCard
                            selectedDate={bookingDate}
                            onSelectDate={iso => {
                              setBookingDate(iso);
                              setViewMonthDate(iso);
                              setBookingError('');
                            }}
                            viewMonthDate={viewMonthDate}
                            onChangeMonth={handleChangeMonth}
                            appointmentCounts={appointmentCounts}
                            minDate={todayStr}
                          />

                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                Horários Disponíveis ({availableSlotsForSelectedDate.length})
                              </span>
                              <span className="text-[11px] font-semibold text-[#9A3412] tabular-nums">
                                09:00 às 17:00 · 1h00 por lavagem
                              </span>
                            </div>

                            {availableSlotsForSelectedDate.length === 0 ? (
                              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                                <p className="font-bold">Todos os horários deste dia já foram agendados.</p>
                                <p className="text-[11px] text-amber-800">
                                  Escolha outra data no calendário acima para visualizar os horários livres.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
                                {availableSlotsForSelectedDate.map(slot => {
                                  const isSelected = bookingTime === slot;
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => {
                                        setBookingTime(slot);
                                        setBookingError('');
                                      }}
                                      className={`min-h-[48px] px-3 py-2.5 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center tabular-nums ${
                                        isSelected
                                          ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                                          : 'bg-white text-slate-800 border-slate-200 hover:border-[#EA580C]/60'
                                      }`}
                                    >
                                      <span className="text-sm font-black">{slot}</span>
                                      <span
                                        className={`text-[10px] font-semibold ${
                                          isSelected ? 'text-white/90' : 'text-slate-500'
                                        }`}
                                      >
                                        {formatSlotRange(slot)} (1h00)
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Agendamento único por horário: horários já reservados são removidos automaticamente da lista.
                            </p>
                          </div>

                          {/* Live Summary Box */}
                          {selectedService && (
                            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                Resumo da Reserva
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-600 truncate">{selectedService.name}</span>
                                <span className="font-mono font-bold text-slate-900 shrink-0 tabular-nums">
                                  {portalConfig.showPrices
                                    ? brl(selectedService.price)
                                    : 'Sob consulta'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-slate-500">
                                <span>Duração do atendimento</span>
                                <span className="font-semibold text-slate-700 tabular-nums">1h00 (60 min)</span>
                              </div>
                              {bookingTime && (
                                <div className="flex items-center justify-between gap-2 text-slate-500">
                                  <span>Janela reservada</span>
                                  <span className="font-bold text-[#9A3412] tabular-nums">
                                    {formatSlotRange(bookingTime)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {bookingError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{bookingError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={availableSlotsForSelectedDate.length === 0 || !bookingTime}
                            className="w-full min-h-[46px] py-3.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition"
                          >
                            {availableSlotsForSelectedDate.length === 0
                              ? 'Sem Horários Disponíveis Nesta Data'
                              : 'Confirmar Solicitação de Agendamento'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* TAB 2: ACOMPANHAR MINHA MOTO */}
                {activeTab === 'consultar' && portalConfig.allowOrderTracking && (
                  <div className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 w-full pk-section-stack min-w-0">
                    <div className="space-y-1">
                      <h2 className="text-lg font-extrabold text-slate-900">
                        Acompanhamento de Ordem de Serviço
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Consulte o estágio atual da sua motocicleta digitando a placa ou o número da OS (ex: OS-2026-001).
                      </p>
                    </div>

                    <form onSubmit={handleSearchPlate} noValidate className="space-y-2 max-w-2xl">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={20}
                          value={plateSearch}
                          onChange={e => {
                            setPlateSearch(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20));
                            setPlateSearchError('');
                          }}
                          placeholder="Digite a placa (Ex: BMW9G82) ou OS"
                          className="flex-1 min-w-0 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-mono text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
                        />
                        <button
                          type="submit"
                          className="min-h-[46px] px-6 py-3 rounded-xl bg-[#171717] hover:bg-black text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shrink-0 whitespace-nowrap"
                        >
                          <Search className="w-4 h-4 shrink-0" />
                          <span>Consultar Agora</span>
                        </button>
                      </div>
                      {plateSearchError && (
                        <p className="text-xs font-semibold text-rose-700">{plateSearchError}</p>
                      )}
                    </form>

                    {hasSearched && (
                      trackedOrder ? (
                        <div className="bg-slate-50/70 pk-card-pad rounded-2xl border border-slate-200 space-y-4 sm:space-y-5 min-w-0">
                          {/* Vehicle & Order Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                                <span className="font-bold text-slate-900">{trackedOrder.id}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-slate-900">{trackedOrder.motorcyclePlate}</span>
                                <span aria-hidden="true">·</span>
                                <span>Entrada: {new Date(trackedOrder.entryDateTime).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <h3 className="text-lg font-extrabold text-slate-900 wrap-anywhere">
                                {trackedOrder.motorcycleBrand} {trackedOrder.motorcycleModel}
                              </h3>
                            </div>

                            <div className="shrink-0">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                                  trackedOrder.status === 'cancelado'
                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                    : trackedOrder.status === 'concluido' || trackedOrder.status === 'entregue'
                                      ? 'bg-[#FFEDD5] border-[#EA580C]/40 text-[#9A3412]'
                                      : 'bg-white border-slate-300 text-slate-800'
                                }`}
                              >
                                {trackedOrder.status === 'concluido'
                                  ? 'Pronta para Retirada'
                                  : trackedOrder.status === 'em_servico'
                                    ? 'Em Atendimento na Baia'
                                    : trackedOrder.status === 'para_fazer'
                                      ? 'Aguardando Início'
                                      : trackedOrder.status === 'entregue'
                                        ? 'Entregue ao Cliente'
                                        : 'Ordem Cancelada'}
                              </span>
                            </div>
                          </div>

                          {/* 4-Stage Visual Progress Stepper */}
                          {trackedOrder.status !== 'cancelado' && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                              {ORDER_STEPS.map((step, idx) => {
                                const StepIcon = step.icon;
                                const currentIdx = getOrderStageIndex(trackedOrder.status);
                                const isCompleted = idx <= currentIdx;
                                const isCurrent = idx === currentIdx;
                                return (
                                  <div
                                    key={step.key}
                                    className={`p-3.5 rounded-xl border transition ${
                                      isCurrent
                                        ? 'bg-white border-[#EA580C] ring-1 ring-[#EA580C]/20'
                                        : isCompleted
                                          ? 'bg-white border-slate-200'
                                          : 'bg-slate-100/70 border-slate-200/70 opacity-65'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                                        0{idx + 1}
                                      </span>
                                      <StepIcon
                                        className={`w-4 h-4 shrink-0 ${
                                          isCurrent
                                            ? 'text-[#EA580C]'
                                            : isCompleted
                                              ? 'text-slate-900'
                                              : 'text-slate-400'
                                        }`}
                                      />
                                    </div>
                                    <p
                                      className={`text-xs font-bold leading-snug ${
                                        isCurrent
                                          ? 'text-[#9A3412]'
                                          : isCompleted
                                            ? 'text-slate-900'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {step.label}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {trackedOrder.status === 'concluido' && (
                            <div className="p-4 rounded-xl bg-[#FFEDD5] border border-[#EA580C]/30 text-[#9A3412] text-xs sm:text-sm font-bold flex items-center gap-2.5">
                              <CheckCircle2 className="w-5 h-5 text-[#EA580C] shrink-0" />
                              <span>
                                Sua motocicleta concluiu todos os procedimentos de estética e está pronta para retirada no estúdio.
                              </span>
                            </div>
                          )}

                          {/* Services + Optional Payment Breakdown */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                            <div
                              className={`${
                                portalConfig.showPaymentSummaryInTracking ? 'lg:col-span-7' : 'lg:col-span-12'
                              } bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs`}
                            >
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                Procedimentos Contratados
                              </span>
                              <ul className="divide-y divide-slate-100">
                                {trackedOrder.services.map((srv, idx) => (
                                  <li key={idx} className="py-2 flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">{srv.serviceName}</span>
                                    <span className="text-slate-500 tabular-nums shrink-0">
                                      {srv.estimatedMinutes} min
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-slate-500 pt-1 border-t border-slate-100">
                                Responsável técnico: <strong className="text-slate-800">{trackedOrder.assignedEmployeeName}</strong>
                              </p>
                            </div>

                            {portalConfig.showPaymentSummaryInTracking && (
                              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Resumo Financeiro
                                </span>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">Total da Ordem</span>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {brl(trackedOrder.total)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">Valor Pago</span>
                                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                    {brl(trackedOrder.amountPaid)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <span className="font-bold text-slate-900">Saldo Pendente</span>
                                  <span className="font-mono font-extrabold text-[#9A3412] tabular-nums">
                                    {brl(trackedOrder.pendingBalance)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Before & After Photos (if enabled by Admin) */}
                          {portalConfig.showBeforeAfterPhotos && (
                            <div className="pt-4 border-t border-slate-200 space-y-3">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                <Camera className="w-4 h-4 text-[#EA580C] shrink-0" />
                                <span>Registro Fotográfico (Antes & Depois)</span>
                              </div>

                              {trackedOrder.photosBefore.length === 0 && trackedOrder.photosAfter.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-white rounded-xl p-4 border border-slate-200/80 text-center">
                                  As fotos do Antes e Depois serão exibidas aqui assim que registradas pela equipe técnica.
                                </p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {trackedOrder.photosBefore.map((url, idx) => {
                                    const key = `bf_${idx}`;
                                    return (
                                      <button
                                        type="button"
                                        key={key}
                                        onClick={() => !failedOrderPhotoKeys[key] && setZoomedPhoto({ url, label: 'Registro Antes do Serviço' })}
                                        className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-200 text-left"
                                      >
                                        {!failedOrderPhotoKeys[key] ? (
                                          <img
                                            src={url}
                                            alt={`Antes ${idx + 1}`}
                                            loading="lazy"
                                            decoding="async"
                                            referrerPolicy="no-referrer"
                                            onError={() => setFailedOrderPhotoKeys(prev => ({ ...prev, [key]: true }))}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                            <Camera className="w-5 h-5" />
                                          </div>
                                        )}
                                        <span className="absolute bottom-1.5 left-1.5 bg-slate-900/85 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                          Antes
                                        </span>
                                      </button>
                                    );
                                  })}

                                  {trackedOrder.photosAfter.map((url, idx) => {
                                    const key = `af_${idx}`;
                                    return (
                                      <button
                                        type="button"
                                        key={key}
                                        onClick={() => !failedOrderPhotoKeys[key] && setZoomedPhoto({ url, label: 'Registro Depois do Serviço' })}
                                        className="relative rounded-xl overflow-hidden border border-[#EA580C]/40 aspect-video bg-slate-200 text-left"
                                      >
                                        {!failedOrderPhotoKeys[key] ? (
                                          <img
                                            src={url}
                                            alt={`Depois ${idx + 1}`}
                                            loading="lazy"
                                            decoding="async"
                                            referrerPolicy="no-referrer"
                                            onError={() => setFailedOrderPhotoKeys(prev => ({ ...prev, [key]: true }))}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                            <Camera className="w-5 h-5" />
                                          </div>
                                        )}
                                        <span className="absolute bottom-1.5 left-1.5 bg-[#EA580C] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                          Depois
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2 text-xs text-slate-600">
                          <p className="font-bold text-slate-800">
                            Nenhuma ordem encontrada para "{plateSearch}".
                          </p>
                          <p>
                            Confira a digitação da placa ou número da OS. Caso precise de suporte, fale com nossa recepção pelo WhatsApp.
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* TAB 3: TABELA DE SERVIÇOS & PREÇOS */}
                {activeTab === 'servicos' && portalConfig.allowServicesCatalog && (
                  <div className="pk-section-stack">
                    <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-compact flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900">Catálogo de Serviços</h2>
                        <p className="text-xs text-slate-500">
                          Selecione uma categoria ou clique em agendar para escolher data e horário.
                        </p>
                      </div>
                      <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 min-w-0">
                        {serviceCategories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCatalogCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                              catalogCategoryFilter === cat
                                ? 'bg-[#171717] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 pk-grid-gap min-w-0">
                      {filteredCatalogServices.map(s => (
                        <div
                          key={s.id}
                          className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 flex flex-col justify-between gap-3 min-w-0"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              <span>{s.category}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{s.estimatedMinutes} min</span>
                            </div>

                            <h3 className="font-extrabold text-slate-900 text-base leading-snug wrap-anywhere">
                              {s.name}
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                            <span className="font-mono font-extrabold text-base text-[#9A3412] tabular-nums">
                              {portalConfig.showPrices ? brl(s.price) : 'Sob consulta'}
                            </span>

                            {portalConfig.allowOnlineBooking && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceId(s.id);
                                  setSubmittedSuccess(false);
                                  scrollToWorkspace('agendar');
                                }}
                                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                              >
                                <span>Agendar</span>
                                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* STUDIO LOCATION & HOURS SECTION */}
        {portalConfig.showLocationAndHours && (
          <section
            id="portal-studio-info"
            className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 min-w-0">
              <span className="text-xs font-bold text-[#9A3412] block">Atendimento Presencial</span>
              <h2 className="text-lg font-extrabold text-slate-900">
                {companyDisplayName(settings)} — {settings.city || 'São Paulo'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 pt-1">
                <span className="flex items-center gap-1.5 wrap-anywhere">
                  <MapPin className="w-4 h-4 text-[#EA580C] shrink-0" />
                  {settings.address}
                </span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-4 h-4 text-[#EA580C] shrink-0" />
                  {settings.operatingDays?.length ? `${settings.operatingDays.join(', ')} · ` : ''}
                  {settings.openingTime} às {settings.closingTime}
                </span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Phone className="w-4 h-4 text-[#EA580C] shrink-0" />
                  {settings.phone || settings.whatsapp}
                </span>
              </div>
            </div>

            {portalConfig.showWhatsappButton && cleanWhatsappDigits && (
              <a
                href={whatsappDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Chamar no WhatsApp</span>
              </a>
            )}
          </section>
        )}
      </div>

      {/* QUIET INSTITUTIONAL FOOTER (Standalone only; includes discrete Admin Unlock only when NOT accessed via public ?portal=1 URL) */}
      {isStandalone && (
        <footer className="border-t border-slate-200/80 bg-white mt-auto">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-slate-800">{companyDisplayName(settings)}</span>
              <span aria-hidden="true">·</span>
              <span>Estética e Detalhamento Especializado de Motocicletas</span>
            </div>

            {!isPublicPortalUrl && (
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                  setUnlockModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 transition self-start sm:self-auto whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Acesso Administrativo</span>
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Lightbox Modal for Customer Before/After Photos */}
      <ResponsiveModal
        isOpen={Boolean(zoomedPhoto)}
        onClose={() => setZoomedPhoto(null)}
        title={zoomedPhoto?.label || 'Registro Fotográfico'}
        maxWidth="2xl"
      >
        {zoomedPhoto && (
          <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
            <img
              src={zoomedPhoto.url}
              alt={zoomedPhoto.label}
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full max-h-[65vh] object-contain"
            />
          </div>
        )}
      </ResponsiveModal>

      {/* Admin Unlock Modal from Client-Only Kiosk / Restricted Mode */}
      <ResponsiveModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        title="Desbloquear Sistema Interno"
        maxWidth="sm"
      >
        <form onSubmit={handleUnlockSubmit} noValidate className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Esta tela está em modo exclusivo para clientes. Digite o PIN de administrador para retornar ao painel de gestão interno.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">PIN Administrativo</label>
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="••••"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 font-mono text-center text-base tracking-[0.35em] font-bold text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
            />
            {pinError && (
              <p className="text-rose-700 font-semibold mt-1.5">{pinError}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setUnlockModalOpen(false)}
              className="min-h-[42px] py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] py-2 rounded-xl bg-[#9A3412] hover:bg-[#EA580C] text-white font-bold"
            >
              Desbloquear
            </button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};
