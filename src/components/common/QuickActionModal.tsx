import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import {
  X,
  Calendar,
  UserPlus,
  ArrowDownCircle,
  ArrowUpCircle,
  Bike,
  Sparkles,
  DollarSign,
  Camera,
  Check,
  Plus,
  Search,
  ClipboardList,
  Image as ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import {
  ExpenseCategory,
  InspectionChecklist,
  MotoCategory,
  OSStatus,
  PaymentMethod,
  PaymentStatus
} from '../../types';
import { getLocalDateStr, useCurrentDate } from '../../utils/dateUtils';
import {
  DEFAULT_WASH_DURATION_MINUTES,
  findConflictingAppointment,
  formatSlotRange,
  getAvailableSlotsForDate,
  minutesToTime,
  timeToMinutes
} from '../../utils/schedulingUtils';
import { DEFAULT_CHECKLIST_ITEMS } from './InspectionWorkflowSteps';
import {
  SmartMotorcycleSelector,
  MotorcycleFormDraft,
} from './SmartMotorcycleSelector';
import {
  formatPhoneBR,
  parseSafeNumber,
  preventInvalidNumericKeys,
  validateMotorcycleDraft,
  validatePersonName,
  validatePhoneBR,
} from '../../utils/inputValidation';

const OS_WIZARD_STEPS: { id: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { id: 1, label: 'Cliente' },
  { id: 2, label: 'Serviços' },
  { id: 3, label: 'Checklist' },
  { id: 4, label: 'Fotos' },
  { id: 5, label: 'Confirmar' },
];

const DAMAGE_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Exterior', items: ['Amassados', 'Arranhões na lataria', 'Risco no para-choque', 'Mancha na pintura'] },
  { title: 'Interior', items: ['Manchas no estofado', 'Painel riscado', 'Falta de peça/acessório'] },
  { title: 'Rodas', items: ['Pneus desgastados', 'Roda amassada'] },
  { title: 'Vidros', items: ['Vidros trincados', 'Vidro quebrado'] },
];

const OS_PREDEFINED_DAMAGES = DAMAGE_GROUPS.flatMap(group => group.items);

function createEmptyQuickMotoDraft(): MotorcycleFormDraft {
  const yr = new Date().getFullYear();
  return {
    brand: 'Honda',
    model: '',
    version: '',
    year: yr,
    manufactureYear: yr,
    modelYear: yr,
    cc: 160,
    category: 'Street',
    color: 'Preto',
    plate: '',
    mileage: 0,
    notes: '',
    catalogBrandId: 'brand_honda',
  };
}

export const QuickActionModal: React.FC = () => {
  const {
    quickActionOpen,
    setQuickActionOpen,
    quickActionType,
    openQuickAction,
    clients,
    motorcycles,
    services,
    users,
    orders,
    appointments,
    portalConfig,
    createOrder,
    createAppointment,
    createClient,
    createMotorcycle,
    createExpense,
    addPaymentToOrder,
    currentUser,
    setActiveModule
  } = useApp();

  const [activeTab, setActiveTab] = useState<'os' | 'agenda' | 'cliente' | 'despesa' | 'recebimento'>(quickActionType || 'os');

  // Sync with prop when opened
  React.useEffect(() => {
    if (quickActionType) {
      setActiveTab(quickActionType);
    }
  }, [quickActionType]);

  const handleClose = useCallback(() => {
    setQuickActionOpen(false);
  }, [setQuickActionOpen]);

  const { overlayProps, modalProps } = useModalResponsive({
    isOpen: quickActionOpen,
    onClose: handleClose,
    maxHeight: '100dvh',
    ariaLabel: 'Ações Rápidas PK Detail',
  });

  // Form states - OS (wizard de 5 etapas)
  const [osClientId, setOsClientId] = useState(clients[0]?.id || '');
  const [osMotoId, setOsMotoId] = useState('');
  const [osClientSearch, setOsClientSearch] = useState('');
  const [osServiceSearch, setOsServiceSearch] = useState('');
  const [osSelectedServices, setOsSelectedServices] = useState<string[]>([services[0]?.id || '']);
  const [osEmployeeId] = useState(users[1]?.id || users[0]?.id || '');
  const [osDiscountPercent, setOsDiscountPercent] = useState<number>(0);
  const [osReceiveNow, setOsReceiveNow] = useState(false);
  const [osAmountPaid, setOsAmountPaid] = useState<number>(0);
  const [osPaymentMethod, setOsPaymentMethod] = useState<PaymentMethod>('pix');
  const [osIncludePhotosInPdf, setOsIncludePhotosInPdf] = useState(true);
  const [osNotes, setOsNotes] = useState('');
  const [osStepError, setOsStepError] = useState('');
  const [osDamages, setOsDamages] = useState<string[]>([]);
  const [osCustomDamage, setOsCustomDamage] = useState('');

  // OS wizard states
  const [osStep, setOsStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [osChecklist] = useState<InspectionChecklist>(() => ({
    entryDate: new Date().toISOString(),
    fuelLevel: '1/2',
    items: DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i })),
    accessoriesLeft: [],
  }));
  const [osExtraPhotos, setOsExtraPhotos] = useState<string[]>([]);

  // Form states - Agenda
  const [aptClientId, setAptClientId] = useState(clients[0]?.id || '');
  const [aptMotoDraft, setAptMotoDraft] = useState<MotorcycleFormDraft>(() => {
    const first = motorcycles[0];
    if (!first) return createEmptyQuickMotoDraft();
    return {
      brand: first.brand,
      model: first.model,
      version: first.version || '',
      year: first.year,
      manufactureYear: first.manufactureYear || first.year,
      modelYear: first.modelYear || first.year,
      cc: first.cc,
      category: (first.category as MotoCategory) || 'Street',
      color: first.color,
      plate: first.plate,
      mileage: first.mileage || 0,
      notes: first.notes || '',
    };
  });
  const [aptSelectedMotoId, setAptSelectedMotoId] = useState<string>(motorcycles[0]?.id || '');
  const [aptServiceIds, setAptServiceIds] = useState<string[]>([services[0]?.id || '']);
  const { todayStr } = useCurrentDate();
  const [aptDate, setAptDate] = useState(() => getLocalDateStr());
  const [aptStartTime, setAptStartTime] = useState('09:00');
  const [aptEmployeeId, setAptEmployeeId] = useState(users[1]?.id || users[0]?.id || '');
  const [aptNotes, setAptNotes] = useState('');
  const [aptError, setAptError] = useState('');
  const [aptShowValidation, setAptShowValidation] = useState(false);

  const availableQuickAptSlots = React.useMemo(
    () =>
      getAvailableSlotsForDate(
        portalConfig.availableTimeSlots,
        appointments,
        aptDate,
        DEFAULT_WASH_DURATION_MINUTES
      ),
    [portalConfig.availableTimeSlots, appointments, aptDate]
  );

  useEffect(() => {
    if (availableQuickAptSlots.length === 0) {
      if (aptStartTime !== '') setAptStartTime('');
      return;
    }
    if (!availableQuickAptSlots.includes(aptStartTime)) {
      setAptStartTime(availableQuickAptSlots[0]);
    }
  }, [availableQuickAptSlots, aptStartTime]);

  // Form states - Cliente
  const [cliName, setCliName] = useState('');
  const [cliPhone, setCliPhone] = useState('');
  const [cliWhatsapp, setCliWhatsapp] = useState('');
  const [cliEmail, setCliEmail] = useState('');
  const [cliAddress, setCliAddress] = useState('');
  const [cliMotoDraft, setCliMotoDraft] = useState<MotorcycleFormDraft>(() => createEmptyQuickMotoDraft());
  const [cliError, setCliError] = useState('');
  const [cliMotoShowValidation, setCliMotoShowValidation] = useState(false);

  // Form states - Despesa
  const [expDescription, setExpDescription] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Produtos');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDueDate, setExpDueDate] = useState(() => getLocalDateStr());
  const [expStatus, setExpStatus] = useState<'pago' | 'pendente'>('pago');
  const [expMethod, setExpMethod] = useState<PaymentMethod>('pix');
  const [expError, setExpError] = useState('');

  // Form states - Recebimento
  const [recOrderId, setRecOrderId] = useState(orders[0]?.id || '');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recMethod, setRecMethod] = useState<PaymentMethod>('pix');
  const [recNotes, setRecNotes] = useState('');
  const [recError, setRecError] = useState('');

  useEffect(() => {
    if (!quickActionOpen) {
      setAptDate(todayStr);
      setExpDueDate(todayStr);
    }
    setOsStep(1);
    setOsStepError('');
    setOsExtraPhotos([]);
    setOsClientSearch('');
    setOsServiceSearch('');
    setOsDamages([]);
    setOsCustomDamage('');
    setOsReceiveNow(false);
    setOsAmountPaid(0);
    setOsDiscountPercent(0);
  }, [todayStr, quickActionOpen]);

  if (!quickActionOpen) return null;

  // Derived data for the OS wizard
  const clientMotos = motorcycles.filter(m => m.clientId === osClientId);
  const chosenServices = services.filter(s => osSelectedServices.includes(s.id));
  const osSubtotal = chosenServices.reduce((sum, s) => sum + s.price, 0);
  const osDiscount = Math.min(osSubtotal, (osSubtotal * (osDiscountPercent || 0)) / 100);
  const osTotal = Math.max(0, osSubtotal - osDiscount);
  const osSelectedClient = clients.find(c => c.id === osClientId) || clients[0];
  const osSelectedMoto = motorcycles.find(m => m.id === osMotoId) || clientMotos[0] || motorcycles[0];
  const customDamages = osDamages.filter(damage => !OS_PREDEFINED_DAMAGES.includes(damage));

  const filteredOsClients = useMemo(() => {
    const q = osClientSearch.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        motorcycles.some(m => m.clientId === c.id && m.plate.toLowerCase().includes(q))
    );
  }, [clients, motorcycles, osClientSearch]);

  const filteredOsServices = useMemo(() => {
    const q = osServiceSearch.toLowerCase().trim();
    return services.filter(s => s.active).filter(s => !q || s.name.toLowerCase().includes(q));
  }, [services, osServiceSearch]);

  const toggleOsService = (serviceId: string) => {
    setOsStepError('');
    setOsSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const toggleOsDamage = (damage: string) => {
    setOsDamages(prev =>
      prev.includes(damage) ? prev.filter(d => d !== damage) : [...prev, damage]
    );
  };

  const addCustomDamage = () => {
    const label = osCustomDamage.trim();
    if (!label) return;
    if (!osDamages.includes(label)) setOsDamages(prev => [...prev, label]);
    setOsCustomDamage('');
  };

  const handleOsPhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setOsExtraPhotos(prev => [...prev, reader.result as string].slice(0, 12));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const commitCreateOS = (targetStatus: OSStatus = 'para_fazer') => {
    const client = osSelectedClient;
    const moto = osSelectedMoto;
    const employee = users.find(u => u.id === osEmployeeId) || users[0];

    const finalAmountPaid = osReceiveNow ? Math.min(osTotal, osAmountPaid || 0) : 0;
    const paymentStatus: PaymentStatus =
      osTotal > 0 && finalAmountPaid >= osTotal ? 'pago' : finalAmountPaid > 0 ? 'parcial' : 'pendente';
    const paymentTransactions =
      finalAmountPaid > 0
        ? [
            {
              id: `tx_${Date.now()}`,
              serviceOrderId: '',
              amount: finalAmountPaid,
              method: osPaymentMethod,
              date: new Date().toISOString(),
              operatorName: currentUser.name,
              status: 'confirmado' as const,
            },
          ]
        : [];

    const damageItems = osDamages.map(damage => ({ item: damage, entryStatus: 'avaria' as const }));

    createOrder({
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientWhatsapp: client.whatsapp,
      motorcycleId: moto.id,
      motorcycleBrand: moto.brand,
      motorcycleModel: moto.model,
      motorcycleVersion: moto.version,
      motorcycleYear: moto.year,
      motorcycleCategory: moto.category,
      motorcyclePlate: moto.plate,
      status: targetStatus,
      paymentStatus,
      assignedEmployeeId: employee.id,
      assignedEmployeeName: employee.name,
      entryDateTime: new Date().toISOString(),
      services: chosenServices.map(s => ({
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        estimatedMinutes: s.estimatedMinutes,
      })),
      productsConsumed: [],
      subtotal: osSubtotal,
      discount: osDiscount,
      addition: 0,
      total: osTotal,
      amountPaid: finalAmountPaid,
      pendingBalance: Math.max(0, osTotal - finalAmountPaid),
      paymentTransactions,
      checklist: {
        ...osChecklist,
        entryDate: new Date().toISOString(),
        inspectorName: osChecklist.inspectorName || currentUser.name,
        items: [...osChecklist.items, ...damageItems],
      },
      photosBefore: osIncludePhotosInPdf ? osExtraPhotos : [],
      photosAfter: [],
      notes: osNotes,
    });

    setQuickActionOpen(false);
  };

  const validateOsStep = (step: number): boolean => {
    setOsStepError('');
    if (step === 1) {
      if (!osSelectedClient) {
        setOsStepError('Selecione um cliente para continuar.');
        return false;
      }
      if (!osSelectedMoto) {
        setOsStepError('Cadastre uma motocicleta para este cliente antes de abrir a OS.');
        return false;
      }
    }
    if (step === 2 || step === 5) {
      if (chosenServices.length === 0) {
        setOsStepError('Selecione pelo menos um serviço para a Ordem de Serviço.');
        return false;
      }
    }
    if (step === 5) {
      if ((osDiscountPercent || 0) < 0 || (osDiscountPercent || 0) > 100) {
        setOsStepError('O desconto deve estar entre 0% e 100%.');
        return false;
      }
      if (osReceiveNow && (!osAmountPaid || osAmountPaid <= 0)) {
        setOsStepError('Informe o valor do sinal ou entrada.');
        return false;
      }
      if (osReceiveNow && osAmountPaid > osTotal) {
        setOsStepError('O valor do sinal não pode ultrapassar o total da OS.');
        return false;
      }
    }
    return true;
  };

  const goToNextOsStep = () => {
    if (!validateOsStep(osStep)) return;
    setOsStep(prev => (prev < 5 ? ((prev + 1) as 1 | 2 | 3 | 4 | 5) : prev));
  };

  const goToPreviousOsStep = () => {
    setOsStepError('');
    setOsStep(prev => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : prev));
  };

  const handleCreateOS = (e: React.FormEvent) => {
    e.preventDefault();
    if (osStep < 5) {
      goToNextOsStep();
      return;
    }
    if (!validateOsStep(5)) return;
    commitCreateOS('para_fazer');
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setAptError('');
    setAptShowValidation(true);

    const motoCheck = validateMotorcycleDraft(aptMotoDraft, { plateRequired: true });
    if (!motoCheck.valid) {
      setAptError(motoCheck.firstError || 'Verifique os dados da motocicleta.');
      return;
    }
    if (aptServiceIds.length === 0) {
      setAptError('Selecione pelo menos um serviço.');
      return;
    }
    if (!aptStartTime || !availableQuickAptSlots.includes(aptStartTime)) {
      setAptError('Nenhum horário disponível nesta data. Escolha outra data.');
      return;
    }
    const conflict = findConflictingAppointment(
      appointments,
      aptDate,
      aptStartTime,
      DEFAULT_WASH_DURATION_MINUTES
    );
    if (conflict) {
      setAptError(`Horário já reservado (${conflict.startTime} às ${conflict.endTime}). Selecione outro horário livre.`);
      return;
    }

    const client = clients.find(c => c.id === aptClientId) || clients[0];
    const employee = users.find(u => u.id === aptEmployeeId) || users[0];
    const selServices = services.filter(s => aptServiceIds.includes(s.id));
    const blockMinutes = DEFAULT_WASH_DURATION_MINUTES;

    const startMins = timeToMinutes(aptStartTime);
    const endTime = minutesToTime(startMins + blockMinutes);

    const created = createAppointment({
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      motorcycleId: aptSelectedMotoId || undefined,
      motorcyclePlate: aptMotoDraft.plate.toUpperCase().trim(),
      motorcycleBrand: aptMotoDraft.brand.trim(),
      motorcycleModel: `${aptMotoDraft.brand.trim()} ${aptMotoDraft.model.trim()}`.trim(),
      motorcycleVersion: aptMotoDraft.version.trim() || undefined,
      motorcycleYear: Number(aptMotoDraft.modelYear || aptMotoDraft.year) || undefined,
      motorcycleCategory: aptMotoDraft.category || undefined,
      serviceIds: aptServiceIds,
      serviceNames: selServices.map(s => s.name),
      assignedEmployeeId: employee.id,
      assignedEmployeeName: employee.name,
      date: aptDate,
      startTime: aptStartTime,
      endTime,
      durationMinutes: blockMinutes,
      status: 'confirmado',
      notes: aptNotes
    });

    if (!created) {
      setAptError('Este horário já foi reservado. Selecione outro horário livre.');
      return;
    }

    setQuickActionOpen(false);
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    setCliError('');
    setCliMotoShowValidation(true);

    const nameCheck = validatePersonName(cliName, 'Nome completo');
    if (!nameCheck.valid) {
      setCliError(nameCheck.error || 'Informe um nome válido.');
      return;
    }

    const phoneCheck = validatePhoneBR(cliPhone, 'Telefone / WhatsApp', true);
    if (!phoneCheck.valid) {
      setCliError(phoneCheck.error || 'Informe um telefone válido com DDD.');
      return;
    }

    const hasOptionalMoto = Boolean(cliMotoDraft.model.trim() || cliMotoDraft.plate.trim());
    if (hasOptionalMoto) {
      const motoCheck = validateMotorcycleDraft(cliMotoDraft, {
        plateRequired: true,
        existingMotorcycles: motorcycles,
      });
      if (!motoCheck.valid) {
        setCliError(motoCheck.firstError || 'Verifique os dados da motocicleta.');
        return;
      }
    }

    const newClient = createClient({
      name: cliName.trim(),
      phone: cliPhone.trim(),
      whatsapp: cliWhatsapp || cliPhone.replace(/\D/g, ''),
      email: cliEmail || `${cliName.trim().toLowerCase().replace(/\s+/g, '.')}@email.com`,
      address: cliAddress,
      notes: 'Cliente cadastrado via ação rápida'
    });

    if (cliMotoDraft.model.trim() && cliMotoDraft.plate.trim()) {
      createMotorcycle({
        clientId: newClient.id,
        clientName: newClient.name,
        brand: cliMotoDraft.brand.trim() || 'Honda',
        model: cliMotoDraft.model.trim(),
        version: cliMotoDraft.version.trim() || undefined,
        plate: cliMotoDraft.plate.toUpperCase().trim(),
        color: cliMotoDraft.color.trim() || 'Preto',
        cc: Number(cliMotoDraft.cc) || 160,
        year: Number(cliMotoDraft.modelYear || cliMotoDraft.year) || new Date().getFullYear(),
        manufactureYear: Number(cliMotoDraft.manufactureYear || cliMotoDraft.year) || undefined,
        modelYear: Number(cliMotoDraft.modelYear || cliMotoDraft.year) || undefined,
        category: (cliMotoDraft.category as MotoCategory) || 'Street',
        mileage: Number(cliMotoDraft.mileage) || 0,
        notes: cliMotoDraft.notes.trim() || undefined,
        catalogBrandId: cliMotoDraft.catalogBrandId,
        catalogModelId: cliMotoDraft.catalogModelId,
        isManualEntry: cliMotoDraft.isManualEntry,
      });
    }

    setQuickActionOpen(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');
    if (expDescription.trim().length < 3) {
      setExpError('Informe uma descrição para a despesa (mínimo 3 caracteres).');
      return;
    }
    if (!Number.isFinite(expAmount) || expAmount <= 0) {
      setExpError('Informe um valor válido maior que R$ 0,00.');
      return;
    }
    if (!expDueDate) {
      setExpError('Informe a data de vencimento/pagamento.');
      return;
    }

    createExpense({
      description: expDescription.trim(),
      category: expCategory,
      amount: Number(expAmount),
      dueDate: expDueDate,
      status: expStatus,
      paymentDate: expStatus === 'pago' ? expDueDate : undefined,
      paymentMethod: expStatus === 'pago' ? expMethod : undefined
    });

    setQuickActionOpen(false);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    if (!recOrderId) {
      setRecError('Selecione uma Ordem de Serviço.');
      return;
    }
    if (!Number.isFinite(recAmount) || recAmount <= 0) {
      setRecError('Informe um valor a receber maior que R$ 0,00.');
      return;
    }
    addPaymentToOrder(recOrderId, Number(recAmount), recMethod, recNotes);
    setQuickActionOpen(false);
  };

  return (
    <div
      {...overlayProps}
      className="fixed inset-x-0 top-0 z-50 h-[var(--vvh,100dvh)] bg-white overflow-hidden flex flex-col pk-sheet-enter sm:pk-modal-enter"
    >
      <div
        {...modalProps}
        className="w-full h-full max-w-none bg-white flex flex-col overflow-hidden"
      >
        {activeTab !== 'os' && (
        <>
        {/* Header — Claude / Apple Minimalist Style */}
        <div className="sticky top-0 z-20 px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200/80 text-slate-900 shrink-0 shadow-2xs safe-area-top">
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#EA580C]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight truncate">Ações Rápidas</h2>
                <p className="text-[11px] text-slate-500 truncate">Crie registros e movimentações instantâneas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuickActionOpen(false)}
              aria-label="Fechar"
              className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Tabs — Claude / Apple Minimalist Pill Strip */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-50/80 border-b border-slate-200/70 shrink-0 w-full overflow-x-hidden">
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('agenda')}
              className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                activeTab === 'agenda'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Agendamento</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cliente')}
              className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                activeTab === 'cliente'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Novo Cliente</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recebimento')}
              className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                activeTab === 'recebimento'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80'
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Recebimento</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('despesa')}
              className={`col-span-2 min-[460px]:col-span-1 min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                activeTab === 'despesa'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80'
              }`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Nova Despesa</span>
            </button>
          </div>
        </div>

        </>
        )}
        {/* Tab Content Body — vertical scroll only */}
        <div className="flex-1 overflow-y-auto pk-scroll-compact overflow-x-hidden pk-modal-body safe-area-bottom modal-responsive-scroll min-w-0">
          <div className="pk-content-max pk-section-stack min-w-0 pb-12 sm:pb-8">
          {/* TAB 1: NOVA ORDEM DE SERVIÇO — WIZARD DE 5 ETAPAS */}
          {activeTab === 'os' && (
            <form onSubmit={handleCreateOS} noValidate className="flex flex-col gap-4">
              {/* Wizard header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-stretch gap-2.5 min-w-0">
                  <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-900 leading-tight">Nova Ordem de Serviço</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Etapa {osStep} de 5 — {OS_WIZARD_STEPS[osStep - 1].label}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stepper */}
              <div className="flex items-start">
                {OS_WIZARD_STEPS.map((step, idx) => {
                  const isDone = osStep > step.id;
                  const isActive = osStep === step.id;
                  return (
                    <React.Fragment key={step.id}>
                      {idx > 0 && (
                        <span className={`flex-1 h-[2px] mt-[13px] ${osStep >= step.id ? 'bg-[#EA580C]' : 'bg-slate-200'}`} />
                      )}
                      <div className="flex flex-col items-center gap-1.5 w-[54px] shrink-0">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition ${
                            isActive
                              ? 'bg-[#EA580C] border-[#EA580C] text-white'
                              : isDone
                                ? 'bg-[#EA580C]/90 border-[#EA580C] text-white'
                                : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : step.id}
                        </span>
                        <span
                          className={`text-[10px] leading-tight text-center ${
                            isActive || isDone ? 'font-bold text-slate-900' : 'font-medium text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ETAPA 1: CLIENTE */}
              {osStep === 1 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Buscar cliente</p>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={osClientSearch}
                      onChange={e => setOsClientSearch(e.target.value)}
                      placeholder="Buscar cliente pelo nome ou placa..."
                      className="w-full min-h-[44px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('cliente')}
                    className="w-full min-h-[44px] rounded-xl border-2 border-slate-200 bg-white hover:border-[#EA580C] text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4 text-[#FDBA74] stroke-[3]" />
                    <span>Cadastrar Novo Cliente</span>
                  </button>

                  {filteredOsClients.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Nenhum cliente encontrado.</p>
                  ) : (
                    <div className="space-y-2 max-h-[42vh] overflow-y-auto pk-scroll-compact">
                      {filteredOsClients.map(client => {
                        const bikes = motorcycles.filter(m => m.clientId === client.id);
                        const isSelected = client.id === osClientId;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setOsClientId(client.id);
                              setOsMotoId(bikes[0]?.id || '');
                              setOsStepError('');
                            }}
                            className={`w-full text-left rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-2 transition ${
                              isSelected ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-slate-900 truncate">{client.name}</span>
                              <span className="block text-[11px] text-slate-500 truncate">
                                {client.phone} · {bikes.length} veículo(s)
                              </span>
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-[#9A3412] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {clientMotos.length > 1 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Motocicleta</label>
                      <select
                        value={osMotoId}
                        onChange={e => setOsMotoId(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                      >
                        {clientMotos.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.brand} {m.model} · {m.plate}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* ETAPA 2: SERVIÇOS */}
              {osStep === 2 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Serviços disponíveis</p>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={osServiceSearch}
                      onChange={e => setOsServiceSearch(e.target.value)}
                      placeholder="Buscar serviço..."
                      className="w-full min-h-[44px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-2 max-h-[38vh] overflow-y-auto pk-scroll-compact">
                    {filteredOsServices.map(srv => {
                      const isChecked = osSelectedServices.includes(srv.id);
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => toggleOsService(srv.id)}
                          className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition ${
                            isChecked ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xs font-semibold text-slate-800 truncate">{srv.name}</span>
                          <span className="text-xs font-mono font-bold text-slate-600 shrink-0">R$ {srv.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                    {filteredOsServices.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Nenhum serviço encontrado.</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionOpen(false);
                      setActiveModule('servicos');
                    }}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white hover:border-[#EA580C] text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4 text-[#FDBA74] stroke-[3]" />
                    <span>Cadastrar novo serviço</span>
                  </button>

                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-1">Serviços selecionados</p>

                  <div
                    className={`rounded-xl border-2 border-dashed p-3 ${
                      chosenServices.length > 0 ? 'border-[#EA580C] bg-[#FFEDD5]/40' : 'border-slate-200'
                    }`}
                  >
                    {chosenServices.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-2">Nenhum serviço selecionado</p>
                    ) : (
                      <div className="space-y-1.5">
                        {chosenServices.map(s => (
                          <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-700 truncate">{s.name}</span>
                            <span className="font-mono text-slate-600 shrink-0">R$ {s.price.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-900 pt-1.5 border-t border-[#EA580C]/60">
                          <span>Total</span>
                          <span className="font-mono">R$ {osSubtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ETAPA 3: CHECKLIST DE AVARIAS */}
              {osStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                      <ClipboardList className="w-4 h-4 text-[#EA580C]" />
                      Checklist de Avarias
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Esta etapa é opcional.</p>
                  </div>

                  {DAMAGE_GROUPS.map(group => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{group.title}</p>
                      {group.items.map(damage => {
                        const isChecked = osDamages.includes(damage);
                        return (
                          <label
                            key={damage}
                            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition ${
                              isChecked ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOsDamage(damage)}
                              className="w-4 h-4 accent-[#EA580C]"
                            />
                            <span className="text-xs font-medium text-slate-800">{damage}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avaria personalizada</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={osCustomDamage}
                        onChange={e => setOsCustomDamage(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomDamage();
                          }
                        }}
                        placeholder="Adicionar avaria personalizada..."
                        className="flex-1 min-h-[42px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={addCustomDamage}
                        aria-label="Adicionar avaria"
                        className="w-[42px] h-[42px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center shrink-0 transition"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {customDamages.map(damage => (
                      <div
                        key={damage}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2"
                      >
                        <span className="text-xs font-medium text-slate-800 truncate">{damage}</span>
                        <button
                          type="button"
                          onClick={() => toggleOsDamage(damage)}
                          aria-label={`Remover ${damage}`}
                          className="w-6 h-6 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ETAPA 4: FOTOS */}
              {osStep === 4 && (
                <div className="space-y-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                      <ImageIcon className="w-4 h-4 text-[#EA580C]" />
                      Fotos do Veículo
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Etapa opcional — pode avançar sem foto.</p>
                  </div>

                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center space-y-3">
                    <Camera className="w-7 h-7 mx-auto text-[#FDBA74]" />
                    <p className="text-[11px] text-slate-500">Arraste fotos ou clique para fazer upload</p>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 min-h-[40px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
                        <Camera className="w-4 h-4" />
                        <span>Tirar foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            handleOsPhotoFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label className="flex-1 min-h-[40px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition">
                        <ImageIcon className="w-4 h-4" />
                        <span>Galeria</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => {
                            handleOsPhotoFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={osIncludePhotosInPdf}
                      onChange={e => setOsIncludePhotosInPdf(e.target.checked)}
                      className="w-4 h-4 accent-[#EA580C]"
                    />
                    <span>Adicionar fotos no PDF</span>
                  </label>

                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Fotos adicionadas ({osExtraPhotos.length})
                  </p>

                  {osExtraPhotos.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                      <p className="text-[11px] text-slate-400">Nenhuma foto adicionada</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {osExtraPhotos.map((url, idx) => (
                        <div key={`os_photo_${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setOsExtraPhotos(prev => prev.filter((_, i) => i !== idx))}
                            aria-label="Remover foto"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ETAPA 5: CONFIRMAR */}
              {osStep === 5 && (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                    <ClipboardList className="w-4 h-4 text-[#EA580C]" />
                    Resumo da Ordem de Serviço
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{osSelectedClient?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{osSelectedClient?.phone}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {osSelectedMoto?.brand} · {osSelectedMoto?.plate}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Serviços</p>
                    {chosenServices.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-700 truncate">{s.name}</span>
                        <span className="font-mono text-slate-600 shrink-0">R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Valores</p>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-mono font-semibold text-slate-800">R$ {osSubtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500">Desconto geral (%)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.01"
                          value={osDiscountPercent || ''}
                          onChange={e => {
                            setOsDiscountPercent(parseSafeNumber(e.target.value, { min: 0 }));
                            setOsStepError('');
                          }}
                          placeholder="0,00"
                          className="w-20 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFEDD5] border border-[#EA580C]/60 px-3 py-2">
                      <span className="text-[11px] font-black uppercase text-[#9A3412]">Total</span>
                      <span className="text-sm font-black text-slate-900 font-mono">R$ {osTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border-2 p-3.5 transition ${
                      osReceiveNow ? 'border-[#EA580C] bg-[#FFEDD5]/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={osReceiveNow}
                        onChange={e => {
                          setOsReceiveNow(e.target.checked);
                          if (e.target.checked && !osAmountPaid) setOsAmountPaid(osTotal);
                          setOsStepError('');
                        }}
                        className="w-4 h-4 mt-0.5 accent-[#EA580C]"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold text-slate-900">Receber sinal ou entrada agora</span>
                        <span className="block text-[11px] text-slate-500">Opcional. Registra um recebimento nesta OS.</span>
                      </span>
                    </label>

                    {osReceiveNow && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={osTotal}
                          step="0.01"
                          value={osAmountPaid || ''}
                          onChange={e => {
                            setOsAmountPaid(parseSafeNumber(e.target.value, { min: 0 }));
                            setOsStepError('');
                          }}
                          placeholder="0,00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                        />
                        <select
                          value={osPaymentMethod}
                          onChange={e => setOsPaymentMethod(e.target.value as PaymentMethod)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                        >
                          <option value="pix">PIX</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="credito">Cartão de Crédito</option>
                          <option value="debito">Cartão de Débito</option>
                          <option value="transferencia">Transferência</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Observações</p>
                    <textarea
                      value={osNotes}
                      onChange={e => setOsNotes(e.target.value)}
                      rows={3}
                      placeholder="Observações adicionais..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden resize-y"
                    />
                  </div>
                </div>
              )}

              {osStepError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{osStepError}</span>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                {osStep > 1 ? (
                  <button
                    type="button"
                    onClick={goToPreviousOsStep}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    <span>Voltar</span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <span>{osStep === 5 ? 'Criar Ordem de Serviço' : 'Próximo'}</span>
                  {osStep < 5 && <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: NOVO AGENDAMENTO */}
          {activeTab === 'agenda' && (
            <form onSubmit={handleCreateAppointment} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cliente *</label>
                  <select
                    value={aptClientId}
                    onChange={e => {
                      setAptClientId(e.target.value);
                      const related = motorcycles.find(m => m.clientId === e.target.value);
                      if (related) {
                        setAptSelectedMotoId(related.id);
                        setAptMotoDraft({
                          brand: related.brand,
                          model: related.model,
                          version: related.version || '',
                          year: related.year,
                          manufactureYear: related.manufactureYear || related.year,
                          modelYear: related.modelYear || related.year,
                          cc: related.cc,
                          category: (related.category as MotoCategory) || 'Street',
                          color: related.color,
                          plate: related.plate,
                          mileage: related.mileage || 0,
                          notes: related.notes || '',
                        });
                      } else {
                        setAptSelectedMotoId('');
                      }
                    }}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motos Cadastradas do Cliente</label>
                  <div className="flex flex-wrap gap-1.5">
                    {motorcycles.filter(m => m.clientId === aptClientId).map(rm => {
                      const active = aptMotoDraft.plate === rm.plate;
                      return (
                        <button
                          key={rm.id}
                          type="button"
                          onClick={() => {
                            setAptSelectedMotoId(rm.id);
                            setAptMotoDraft({
                              brand: rm.brand,
                              model: rm.model,
                              version: rm.version || '',
                              year: rm.year,
                              manufactureYear: rm.manufactureYear || rm.year,
                              modelYear: rm.modelYear || rm.year,
                              cc: rm.cc,
                              category: (rm.category as MotoCategory) || 'Street',
                              color: rm.color,
                              plate: rm.plate,
                              mileage: rm.mileage || 0,
                              notes: rm.notes || '',
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition ${
                            active
                              ? 'bg-[#FFEDD5] border-[#EA580C] text-[#9A3412]'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {rm.plate} · {rm.brand} {rm.model}
                        </button>
                      );
                    })}
                    {motorcycles.filter(m => m.clientId === aptClientId).length === 0 && (
                      <span className="text-[11px] text-slate-400 py-2">
                        Selecione ou digite a moto abaixo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <SmartMotorcycleSelector
                  value={aptMotoDraft}
                  onChange={next => {
                    setAptMotoDraft(next);
                    setAptError('');
                  }}
                  registeredMotorcycles={motorcycles}
                  onSelectRegisteredMoto={rm => {
                    setAptSelectedMotoId(rm.id);
                    setAptError('');
                    setAptMotoDraft({
                      brand: rm.brand,
                      model: rm.model,
                      version: rm.version || '',
                      year: rm.year,
                      manufactureYear: rm.manufactureYear || rm.year,
                      modelYear: rm.modelYear || rm.year,
                      cc: rm.cc,
                      category: (rm.category as MotoCategory) || 'Street',
                      color: rm.color,
                      plate: rm.plate,
                      mileage: rm.mileage || 0,
                      notes: rm.notes || '',
                    });
                  }}
                  variant="compact"
                  showPlateAndColor
                  showMileageAndNotes={false}
                  showValidation={aptShowValidation}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={aptDate}
                    onChange={e => {
                      setAptDate(e.target.value);
                      setAptError('');
                    }}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Profissional *</label>
                  <select
                    value={aptEmployeeId}
                    onChange={e => setAptEmployeeId(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="font-bold text-slate-700">
                    Horários Disponíveis (09:00 às 17:00 · 1h00 por lavagem) *
                  </label>
                  <span className="text-[11px] font-semibold text-[#9A3412] tabular-nums">
                    {aptStartTime ? formatSlotRange(aptStartTime) : 'Sem horários livres'}
                  </span>
                </div>

                {availableQuickAptSlots.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                    Todos os horários desta data já foram preenchidos. Escolha outra data.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableQuickAptSlots.map(slot => {
                      const active = aptStartTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setAptStartTime(slot);
                            setAptError('');
                          }}
                          className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs transition tabular-nums flex flex-col items-center justify-center ${
                            active
                              ? 'bg-[#EA580C] border-[#EA580C] text-white font-extrabold'
                              : 'bg-slate-50 border-slate-300 text-slate-800 font-bold hover:border-[#EA580C]'
                          }`}
                        >
                          <span>{slot}</span>
                          <span className={`text-[10px] font-medium ${active ? 'text-white/90' : 'text-slate-500'}`}>
                            {formatSlotRange(slot)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Serviço Principal *</label>
                <select
                  value={aptServiceIds[0] || ''}
                  onChange={e => setAptServiceIds([e.target.value])}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                >
                  {services.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>{s.name} - R$ {s.price.toFixed(2)} (bloco 1h00)</option>
                  ))}
                </select>
              </div>

              {aptError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {aptError}
                </div>
              )}

              <button
                type="submit"
                disabled={availableQuickAptSlots.length === 0 || !aptStartTime}
                className="w-full py-3 rounded-xl bg-[#EA580C] text-white font-bold text-sm hover:bg-[#9A3412] disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md transition active:scale-98 flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {availableQuickAptSlots.length === 0
                  ? 'Sem Horários Disponíveis Nesta Data'
                  : 'Confirmar Agendamento'}
              </button>
            </form>
          )}

          {/* TAB 3: NOVO CLIENTE */}
          {activeTab === 'cliente' && (
            <form onSubmit={handleCreateClient} noValidate className="space-y-4">
              {cliError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{cliError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={cliName}
                    onChange={e => {
                      setCliName(e.target.value);
                      setCliError('');
                    }}
                    placeholder="Ex: Gustavo Lima"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={16}
                    value={cliPhone}
                    onChange={e => {
                      setCliPhone(formatPhoneBR(e.target.value));
                      setCliError('');
                    }}
                    placeholder="(11) 99999-9999"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-[#EA580C]" />
                  Motocicleta Principal do Cliente (Catálogo Inteligente)
                </span>
                <SmartMotorcycleSelector
                  value={cliMotoDraft}
                  onChange={next => {
                    setCliMotoDraft(next);
                    setCliError('');
                  }}
                  variant="compact"
                  showPlateAndColor
                  showMileageAndNotes={false}
                  plateRequired={Boolean(cliMotoDraft.model.trim() || cliMotoDraft.plate.trim())}
                  showValidation={cliMotoShowValidation && Boolean(cliMotoDraft.model.trim() || cliMotoDraft.plate.trim())}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#EA580C] text-white font-bold text-sm hover:bg-[#9A3412] shadow-md transition active:scale-98 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Cadastrar Cliente & Moto
              </button>
            </form>
          )}

          {/* TAB 4: RECEBIMENTO */}
          {activeTab === 'recebimento' && (
            <form onSubmit={handleAddPayment} noValidate className="space-y-4">
              {recError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{recError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selecione a Ordem de Serviço *</label>
                <select
                  value={recOrderId}
                  onChange={e => {
                    setRecOrderId(e.target.value);
                    setRecError('');
                    const sel = orders.find(o => o.id === e.target.value);
                    if (sel) setRecAmount(sel.pendingBalance || sel.total);
                  }}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                >
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.id} — {o.clientName} ({o.motorcyclePlate}) | Saldo: R$ {o.pendingBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valor a Receber (R$) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={1}
                    onKeyDown={e => preventInvalidNumericKeys(e, true)}
                    value={recAmount || ''}
                    onChange={e => {
                      setRecAmount(parseSafeNumber(e.target.value, { min: 0 }));
                      setRecError('');
                    }}
                    placeholder="0.00"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Forma de Pagamento *</label>
                  <select
                    value={recMethod}
                    onChange={e => setRecMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    <option value="pix">PIX (Chave CNPJ)</option>
                    <option value="dinheiro">Dinheiro em Espécie (Caixa)</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="transferencia">Transferência Bancária</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#EA580C] text-white font-bold text-sm hover:bg-[#9A3412] shadow-md transition active:scale-98 flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Registrar Recebimento no Caixa
              </button>
            </form>
          )}

          {/* TAB 5: NOVA DESPESA */}
          {activeTab === 'despesa' && (
            <form onSubmit={handleCreateExpense} noValidate className="space-y-4">
              {expError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{expError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={e => {
                    setExpDescription(e.target.value);
                    setExpError('');
                  }}
                  placeholder="Ex: Compra de luvas de microfibra e fita crepe"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={1}
                    onKeyDown={e => preventInvalidNumericKeys(e, true)}
                    value={expAmount || ''}
                    onChange={e => {
                      setExpAmount(parseSafeNumber(e.target.value, { min: 0 }));
                      setExpError('');
                    }}
                    placeholder="0.00"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    <option value="Produtos">Produtos</option>
                    <option value="Materiais">Materiais</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Água">Água</option>
                    <option value="Energia">Energia</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Internet">Internet</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Funcionários">Funcionários</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={expStatus}
                    onChange={e => setExpStatus(e.target.value as 'pago' | 'pendente')}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    <option value="pago">Pago Agora</option>
                    <option value="pendente">Pendente / A Pagar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data / Vencimento</label>
                  <input
                    type="date"
                    value={expDueDate}
                    onChange={e => {
                      setExpDueDate(e.target.value);
                      setExpError('');
                    }}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-md transition active:scale-98 flex items-center justify-center gap-2"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Lançar Despesa Financeira
              </button>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
