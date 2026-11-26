import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  Plus,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  MessageCircle,
  Sparkles,
  Search,
  Filter,
  Check,
  Trash2
} from 'lucide-react';
import { Appointment, MotoCategory, ServiceItem } from '../../types';
import { NewAppointmentWizard } from '../common/NewAppointmentWizard';
import { MonthCalendarCard } from '../common/MonthCalendarCard';
import { OnlineAppointmentsTab } from '../common/OnlineAppointmentsTab';
import { AppointmentRequestModal } from '../common/AppointmentRequestModal';
import {
  DEFAULT_WASH_DURATION_MINUTES,
  findConflictingAppointment,
  formatSlotRange,
  getAvailableSlotsForDate,
  isSlotWithinBusinessHours,
  minutesToTime,
  timeToMinutes
} from '../../utils/schedulingUtils';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { confirmDialog } from '../../services/dialogService';
import {
  SmartMotorcycleSelector,
  MotorcycleFormDraft,
} from '../common/SmartMotorcycleSelector';
import { validateMotorcycleDraft } from '../../utils/inputValidation';

function createEmptyAptMotoDraft(): MotorcycleFormDraft {
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

type AppointmentStatus = Appointment['status'];

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AppointmentsModule: React.FC = () => {
  const {
    appointments,
    clients,
    motorcycles,
    services,
    users,
    portalConfig,
    setActiveModule,
    createAppointment,
    updateAppointment,
    convertAppointmentToOS,
    cancelAppointment,
  } = useApp();

  const handleCancelAppointment = async (appointment: Appointment) => {
    const confirmed = await confirmDialog(
      `Cancelar o agendamento de ${appointment.clientName}? O horário volta a ficar disponível na agenda.`,
      {
        title: 'Cancelar agendamento',
        confirmLabel: 'Cancelar agendamento',
        cancelLabel: 'Manter',
        tone: 'danger'
      }
    );
    if (confirmed) cancelAppointment(appointment.id);
  };

  const todayIso = toIsoDate(new Date());
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, []);

  const [mainTab, setMainTab] = useState<'agenda' | 'online'>('agenda');
  const [requestModalId, setRequestModalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [viewMonthDate, setViewMonthDate] = useState<string>(todayIso);
  const [dateScope, setDateScope] = useState<'day' | 'next7'>('day');
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [showNewAptModal, setShowNewAptModal] = useState(false);

  // Abre o formulário de novo agendamento quando acionado pelo menu de ações rápidas
  useEffect(() => {
    const openNewAppointment = () => {
      try {
        sessionStorage.removeItem('pk_open_new_appointment');
      } catch {
        // ignora indisponibilidade do sessionStorage
      }
      setConflictWarning(null);
      setShowNewAptModal(true);
    };

    try {
      if (sessionStorage.getItem('pk_open_new_appointment') === '1') {
        sessionStorage.removeItem('pk_open_new_appointment');
        openNewAppointment();
      }
    } catch {
      // sem sessionStorage: o evento abaixo ainda cobre o módulo já montado
    }

    window.addEventListener('pk:new-appointment', openNewAppointment);
    return () => window.removeEventListener('pk:new-appointment', openNewAppointment);
  }, []);

  // New appointment form state
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [aptSelectedMotoId, setAptSelectedMotoId] = useState(motorcycles[0]?.id || '');
  const [motoDraft, setMotoDraft] = useState<MotorcycleFormDraft>(() => {
    const first = motorcycles[0];
    if (!first) return createEmptyAptMotoDraft();
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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([services[0]?.id || '']);
  const [aptDate, setAptDate] = useState(selectedDate);
  const [aptTime, setAptTime] = useState('09:00');
  const [assignedEmpId, setAssignedEmpId] = useState(users[1]?.id || users[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [aptShowValidation, setAptShowValidation] = useState(false);

  const availableSlotsForSelectedDay = useMemo(
    () =>
      getAvailableSlotsForDate(
        portalConfig.availableTimeSlots,
        appointments,
        selectedDate,
        DEFAULT_WASH_DURATION_MINUTES
      ),
    [portalConfig.availableTimeSlots, appointments, selectedDate]
  );

  const availableSlotsForModalDate = useMemo(
    () =>
      getAvailableSlotsForDate(
        portalConfig.availableTimeSlots,
        appointments,
        aptDate,
        DEFAULT_WASH_DURATION_MINUTES
      ),
    [portalConfig.availableTimeSlots, appointments, aptDate]
  );

  React.useEffect(() => {
    if (availableSlotsForModalDate.length === 0) {
      if (aptTime !== '') setAptTime('');
      return;
    }
    if (!availableSlotsForModalDate.includes(aptTime)) {
      setAptTime(availableSlotsForModalDate[0]);
    }
  }, [availableSlotsForModalDate, aptTime]);

  // Appointment counts per date for calendar dot indicators
  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const apt of appointments) {
      if (apt.status === 'cancelado') continue;
      counts[apt.date] = (counts[apt.date] || 0) + 1;
    }
    return counts;
  }, [appointments]);

  const handleSelectCalendarDate = (iso: string) => {
    setSelectedDate(iso);
    setViewMonthDate(iso);
    setDateScope('day');
  };

  const handleChangeMonth = (deltaMonths: number) => {
    const cur = new Date(`${viewMonthDate.slice(0, 7)}-01T00:00:00`);
    cur.setMonth(cur.getMonth() + deltaMonths);
    setViewMonthDate(toIsoDate(cur));
  };

  const selectQuickPreset = (preset: 'today' | 'tomorrow' | 'next7') => {
    if (preset === 'today') {
      setSelectedDate(todayIso);
      setViewMonthDate(todayIso);
      setDateScope('day');
    } else if (preset === 'tomorrow') {
      setSelectedDate(tomorrowIso);
      setViewMonthDate(tomorrowIso);
      setDateScope('day');
    } else {
      setSelectedDate(todayIso);
      setViewMonthDate(todayIso);
      setDateScope('next7');
    }
  };

  const next7EndIso = useMemo(() => {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return toIsoDate(d);
  }, [todayIso]);

  // Displayed appointments for Day / Next 7 Days + Search + Status filters
  const displayedAppointments = useMemo(() => {
    const q = localSearch.toLowerCase().trim();
    return appointments
      .filter(a => {
        if (dateScope === 'next7') {
          if (a.date < todayIso || a.date > next7EndIso) return false;
        } else {
          if (a.date !== selectedDate) return false;
        }

        if (statusFilter === 'all') {
          if (a.status === 'cancelado') return false;
        } else if (a.status !== statusFilter) {
          return false;
        }

        if (q) {
          const hit =
            a.clientName.toLowerCase().includes(q) ||
            a.clientPhone.toLowerCase().includes(q) ||
            a.motorcyclePlate.toLowerCase().includes(q) ||
            a.motorcycleModel.toLowerCase().includes(q) ||
            a.serviceNames.some(s => s.toLowerCase().includes(q));
          if (!hit) return false;
        }

        return true;
      })
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }, [appointments, dateScope, todayIso, next7EndIso, selectedDate, statusFilter, localSearch]);

  // Estimate appointment total from services catalog
  const getAppointmentPrice = (apt: Appointment): number => {
    return apt.serviceIds.reduce((sum, sId) => {
      const found = services.find(s => s.id === sId);
      return sum + (found?.price || 0);
    }, 0);
  };

  const getStatusBadge = (apt: Appointment) => {
    if (apt.serviceOrderId || apt.status === 'concluido') {
      return (
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFEDD5] text-[#9A3412] shrink-0">
          {apt.serviceOrderId ? `OS ${apt.serviceOrderId}` : 'Concluído'}
        </span>
      );
    }
    switch (apt.status) {
      case 'confirmado':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 shrink-0">
            Confirmado
          </span>
        );
      case 'agendado':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
            Pendente
          </span>
        );
      case 'em_atendimento':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
            Em Atendimento
          </span>
        );
      case 'cancelado':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
            {apt.status}
          </span>
        );
    }
  };

  // Conflict validation function (unique booking per time slot within 09:00-17:00)
  const checkTimeConflict = (date: string, start: string, duration: number) => {
    if (!start || !isSlotWithinBusinessHours(start, duration)) {
      return 'Horário fora do expediente (09:00 às 17:00) considerando duração mínima de 1h00 por lavagem.';
    }

    const existing = findConflictingAppointment(appointments, date, start, duration);
    if (existing) {
      return `Horário indisponível: já existe agendamento único de ${existing.clientName} (${existing.startTime} às ${existing.endTime}) neste horário.`;
    }
    return null;
  };

  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setAptShowValidation(true);
    setConflictWarning(null);

    const motoCheck = validateMotorcycleDraft(motoDraft, { plateRequired: true });
    if (!motoCheck.valid) {
      setConflictWarning(motoCheck.firstError || 'Verifique os dados da motocicleta.');
      return;
    }

    const client = clients.find(c => c.id === clientId) || clients[0];
    const employee = users.find(u => u.id === assignedEmpId) || users[0];
    const selServices = services.filter(s => selectedServiceIds.includes(s.id));
    if (selServices.length === 0) {
      setConflictWarning('Selecione pelo menos um serviço para o agendamento.');
      return;
    }
    const blockMinutes = DEFAULT_WASH_DURATION_MINUTES;

    const conflict = checkTimeConflict(aptDate, aptTime, blockMinutes);
    if (conflict) {
      setConflictWarning(conflict);
      return;
    }

    const startMins = timeToMinutes(aptTime);
    const endTime = minutesToTime(startMins + blockMinutes);

    const created = createAppointment({
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      motorcycleId: aptSelectedMotoId || undefined,
      motorcyclePlate: motoDraft.plate.toUpperCase().trim(),
      motorcycleBrand: motoDraft.brand.trim(),
      motorcycleModel: `${motoDraft.brand.trim()} ${motoDraft.model.trim()}`.trim() || 'Modelo não especificado',
      motorcycleVersion: motoDraft.version.trim() || undefined,
      motorcycleYear: Number(motoDraft.modelYear || motoDraft.year) || undefined,
      motorcycleCategory: motoDraft.category || undefined,
      serviceIds: selectedServiceIds,
      serviceNames: selServices.map(s => s.name),
      assignedEmployeeId: employee.id,
      assignedEmployeeName: employee.name,
      date: aptDate,
      startTime: aptTime,
      endTime,
      durationMinutes: blockMinutes,
      status: 'confirmado',
      notes
    });

    if (!created) {
      setConflictWarning('Este horário já está ocupado na agenda. Escolha outro horário disponível.');
      return;
    }

    setSelectedDate(aptDate);
    setViewMonthDate(aptDate);
    setDateScope('day');
    setShowNewAptModal(false);
    setConflictWarning(null);
  };

  const onlineRequests = useMemo(() => appointments.filter(a => a.isOnlineBooking), [appointments]);
  const pendingOnlineCount = onlineRequests.filter(a => a.status === 'agendado').length;
  const activeRequest = requestModalId ? appointments.find(a => a.id === requestModalId) || null : null;

  const handleAcceptRequest = (request: Appointment) => {
    const conflict = findConflictingAppointment(
      appointments.filter(a => a.id !== request.id),
      request.date,
      request.startTime,
      request.durationMinutes || DEFAULT_WASH_DURATION_MINUTES
    );
    if (conflict) {
      setConflictWarning(
        `Horário indisponível: já existe ${conflict.clientName} das ${conflict.startTime} às ${conflict.endTime}.`
      );
      return;
    }
    setConflictWarning(null);
    updateAppointment(request.id, { status: 'confirmado' });
    setRequestModalId(null);
    setSelectedDate(request.date);
    setViewMonthDate(request.date);
    setDateScope('day');
    setViewMode('dia');
    setMainTab('agenda');
  };

  const handleRejectRequest = (request: Appointment, reason: string) => {
    updateAppointment(request.id, {
      status: 'cancelado',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString(),
    });
    setRequestModalId(null);
  };

  const handleAddServiceToRequest = (request: Appointment, service: ServiceItem) => {
    updateAppointment(request.id, {
      serviceIds: [...request.serviceIds, service.id],
      serviceNames: [...request.serviceNames, service.name],
    });
  };

  const buildWhatsAppUrl = (apt: Appointment) => {
    const msg = `Olá ${apt.clientName}! Confirmamos seu agendamento na PK Detail para o dia ${new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR')} às ${apt.startTime}.\n\nMoto: ${apt.motorcycleModel} (${apt.motorcyclePlate})\nServiços: ${apt.serviceNames.join(', ')}\n\nEsperamos você!`;
    return buildWhatsappLink(apt.clientPhone, msg);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const base = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = base.getDay();
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - dayOfWeek + i);
    const iso = toIsoDate(startOfWeek);
    return {
      iso,
      label: startOfWeek.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      items: appointments
        .filter(a => a.date === iso && a.status !== 'cancelado')
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    };
  });

  const monthAppointments = useMemo(() => {
    const monthPrefix = viewMonthDate.slice(0, 7);
    return appointments
      .filter(a => a.date.startsWith(monthPrefix) && a.status !== 'cancelado')
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }, [appointments, viewMonthDate]);

  const shortMonthLabel = new Date(`${viewMonthDate.slice(0, 7)}-01T00:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace(' de ', ' ')
    .replace('.', '');

  const formattedSelectedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="pk-section-stack text-left min-w-0">
      {/* Header — Reference Layout */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Agenda</h1>
            <p className="text-xs text-slate-500 mt-1.5 wrap-anywhere">
              Gerencie os agendamentos da sua estética automotiva
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setConflictWarning(null);
            setAptDate(selectedDate);
            setShowNewAptModal(true);
          }}
          className="w-full sm:w-auto sm:px-6 min-h-[48px] py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition active:scale-[0.99]"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>Novo Agendamento</span>
        </button>

        {/* Abas principais: Agenda (interna) e solicitações do Agendamento Online */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMainTab('agenda')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg transition ${
              mainTab === 'agenda'
                ? 'bg-white border border-[#EA580C] text-slate-900 font-extrabold shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setMainTab('online')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              mainTab === 'online'
                ? 'bg-white border border-[#EA580C] text-slate-900 font-extrabold shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Agendamento Online</span>
            {pendingOnlineCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                {pendingOnlineCount}
              </span>
            )}
          </button>
        </div>

        {/* Visões internas da agenda */}
        {mainTab === 'agenda' && (
          <div className="inline-flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
            {(['dia', 'semana', 'mes'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`min-h-[30px] px-3 rounded-md capitalize transition ${
                  viewMode === mode
                    ? 'bg-white border border-[#EA580C] text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'mes' ? 'Mês' : mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {mainTab === 'online' && (
        <OnlineAppointmentsTab
          appointments={onlineRequests}
          services={services}
          onOpen={request => setRequestModalId(request.id)}
          onViewStore={() => setActiveModule('vitrine')}
        />
      )}

      {conflictWarning && mainTab === 'agenda' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="wrap-anywhere">{conflictWarning}</span>
        </div>
      )}

      {/* VIEW MODE: CALENDÁRIO + LISTA DO DIA */}
      {mainTab === 'agenda' && viewMode === 'dia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap items-stretch min-w-0">
          {/* Left / Top: Monthly Calendar showing ALL dates */}
          <div className="lg:col-span-5 space-y-2.5 min-w-0 lg:sticky lg:top-16 self-start">
            <MonthCalendarCard
              selectedDate={selectedDate}
              onSelectDate={handleSelectCalendarDate}
              viewMonthDate={viewMonthDate}
              onChangeMonth={handleChangeMonth}
              appointmentCounts={appointmentCounts}
            />

            {/* Quick Date Pills + Month Jump (Hoje / Amanhã / Próx. 7 dias / < Mês) */}
            <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => selectQuickPreset('today')}
                className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  dateScope === 'day' && selectedDate === todayIso
                    ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => selectQuickPreset('tomorrow')}
                className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  dateScope === 'day' && selectedDate === tomorrowIso
                    ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Amanhã
              </button>

              <button
                type="button"
                onClick={() => selectQuickPreset('next7')}
                className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  dateScope === 'next7'
                    ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Próx. 7 dias
              </button>

              <div className="flex items-center gap-1 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleChangeMonth(-1)}
                  aria-label="Voltar mês"
                  className="min-w-[36px] min-h-[36px] rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center capitalize whitespace-nowrap">
                  {shortMonthLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Right / Bottom: Search, Status Filter & Appointments List */}
          <div className="lg:col-span-7 flex flex-col pk-section-stack min-w-0 h-full">
            {/* Search & Status Filter Bar */}
            <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={e => setLocalSearch(e.target.value)}
                  placeholder="Buscar cliente, telefone ou placa..."
                  className="w-full min-h-[46px] bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden shadow-xs"
                />
              </div>

              <div className="relative shrink-0">
                <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | AppointmentStatus)}
                  aria-label="Filtrar por status"
                  className="w-full min-[420px]:w-auto min-h-[46px] bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden shadow-xs"
                >
                  <option value="all">Status</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="agendado">Pendente</option>
                  <option value="em_atendimento">Em Atendimento</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Section Title + Circular Count Badge */}
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-xs sm:text-sm font-bold text-slate-600 wrap-anywhere">
                {dateScope === 'next7'
                  ? 'Agendamentos · Próximos 7 dias'
                  : `Agendamentos · ${formattedSelectedDate}`}
              </h2>
              <span className="min-w-[26px] h-[26px] px-2 rounded-full bg-[#EA580C] text-white text-xs font-black flex items-center justify-center tabular-nums shrink-0 shadow-2xs">
                {displayedAppointments.length}
              </span>
            </div>

            {/* Available 1h00 Slots Strip (09:00-17:00) */}
            {dateScope === 'day' && (
              <div className="bg-white rounded-2xl pk-card-compact border border-slate-200/80 space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    Horários Disponíveis ({availableSlotsForSelectedDay.length})
                  </span>
                  <span className="text-[11px] font-semibold text-[#9A3412] tabular-nums">
                    09:00 às 17:00 · 1h00 por lavagem
                  </span>
                </div>

                {availableSlotsForSelectedDay.length === 0 ? (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Todos os horários desta data já foram preenchidos.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableSlotsForSelectedDay.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setConflictWarning(null);
                          setAptDate(selectedDate);
                          setAptTime(slot);
                          setShowNewAptModal(true);
                        }}
                        className="min-h-[42px] px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#FFEDD5] hover:border-[#EA580C] text-slate-800 hover:text-[#9A3412] transition flex flex-col items-center justify-center tabular-nums"
                      >
                        <span className="text-xs font-black">{slot}</span>
                        <span className="text-[10px] font-medium text-slate-500">
                          {formatSlotRange(slot)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Appointments List */}
            {displayedAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center flex-1 flex flex-col items-center justify-center min-h-[190px]">
                <p className="text-sm font-extrabold text-slate-900">
                  {dateScope === 'next7' ? 'Nenhum agendamento para os próximos 7 dias.' : 'Nenhum agendamento para esta data.'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione outra data ou crie um novo agendamento.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConflictWarning(null);
                    setAptDate(selectedDate);
                    setShowNewAptModal(true);
                  }}
                  className="mt-4 min-h-[42px] px-5 py-2.5 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
                  <span>Novo Agendamento</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pk-stagger">
                {displayedAppointments.map(apt => {
                  const estPrice = getAppointmentPrice(apt);
                  return (
                    <div
                      key={apt.id}
                      className="bg-white rounded-2xl pk-card-compact border border-slate-200/90 border-l-4 border-l-[#EA580C] hover:border-[#EA580C]/50 shadow-xs transition space-y-2.5 min-w-0"
                    >
                      {/* Top row: Time + Status badge */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-mono font-black text-base text-slate-900 tabular-nums">
                            {apt.startTime}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                            – {apt.endTime}
                          </span>
                          {dateScope === 'next7' && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">
                              {new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                          {apt.isOnlineBooking && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                              Online
                            </span>
                          )}
                        </div>
                        {getStatusBadge(apt)}
                      </div>

                      {/* Client & Moto Info */}
                      <div className="space-y-0.5 min-w-0">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 wrap-anywhere">
                          {apt.clientName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium wrap-anywhere">
                          {apt.motorcycleModel} • <span className="font-mono font-bold text-slate-700">{apt.motorcyclePlate}</span>
                          {apt.assignedEmployeeName && (
                            <span> • Detailer: {apt.assignedEmployeeName}</span>
                          )}
                        </p>
                      </div>

                      {/* Serviços solicitados */}
                      <div className="text-xs text-slate-700 font-medium wrap-anywhere">
                        {apt.serviceNames.join(', ')}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                        <span className="uppercase tracking-wider">Total</span>
                        <span className="font-mono font-black text-base text-slate-900 tabular-nums">
                          R$ {estPrice.toFixed(2)}
                        </span>
                      </div>

                      {/* Ações rápidas */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href={buildWhatsAppUrl(apt)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Enviar mensagem no WhatsApp"
                          title="Enviar mensagem no WhatsApp"
                          className="w-9 h-9 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        {apt.status === 'agendado' && !apt.serviceOrderId && (
                          <button
                            type="button"
                            onClick={() => updateAppointment(apt.id, { status: 'confirmado' })}
                            aria-label="Confirmar agendamento"
                            title="Confirmar agendamento"
                            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {apt.status !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => void handleCancelAppointment(apt)}
                            aria-label="Cancelar agendamento"
                            title="Cancelar agendamento"
                            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Ações principais */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {apt.status !== 'cancelado' && !apt.serviceOrderId && (
                          <button
                            type="button"
                            onClick={() => void handleCancelAppointment(apt)}
                            className="flex-1 min-w-[110px] min-h-[38px] rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejeitar</span>
                          </button>
                        )}

                        {apt.serviceOrderId ? (
                          <span className="flex-1 text-center text-[11px] font-bold bg-[#FFEDD5] text-[#9A3412] px-3 py-2 rounded-xl border border-[#F97316]/40">
                            Convertido: {apt.serviceOrderId}
                          </span>
                        ) : apt.status !== 'cancelado' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const newOS = convertAppointmentToOS(apt.id);
                              if (newOS) {
                                setConflictWarning(null);
                              }
                            }}
                            className="flex-1 min-w-[140px] min-h-[38px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Converter em OS</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE: SEMANA */}
      {mainTab === 'agenda' && viewMode === 'semana' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 pk-grid-gap min-w-0">
          {weekDays.map(day => (
            <div
              key={day.iso}
              className={`bg-white rounded-2xl pk-card-compact border shadow-xs flex flex-col gap-2 min-w-0 ${
                day.iso === selectedDate ? 'border-[#EA580C] ring-1 ring-[#EA580C]/30' : 'border-slate-200/80'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  handleSelectCalendarDate(day.iso);
                  setViewMode('dia');
                }}
                className="flex items-center justify-between text-left pb-2 border-b border-slate-100 min-w-0"
              >
                <span className="text-xs font-extrabold text-slate-800 capitalize truncate">{day.label}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FFEDD5] text-[#9A3412] shrink-0">
                  {day.items.length}
                </span>
              </button>
              <div className="space-y-1.5">
                {day.items.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-3 text-center">Livre</p>
                ) : (
                  day.items.map(apt => (
                    <div key={apt.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] min-w-0">
                      <div className="flex items-center justify-between gap-1 font-bold text-slate-900">
                        <span className="font-mono text-[#9A3412]">{apt.startTime}</span>
                        <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{apt.motorcyclePlate}</span>
                      </div>
                      <p className="font-semibold text-slate-800 truncate mt-0.5">{apt.clientName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{apt.serviceNames.join(', ')}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW MODE: MÊS LISTA */}
      {mainTab === 'agenda' && viewMode === 'mes' && (
        <div className="pk-section-stack min-w-0">
          <MonthCalendarCard
            selectedDate={selectedDate}
            onSelectDate={iso => {
              handleSelectCalendarDate(iso);
              setViewMode('dia');
            }}
            viewMonthDate={viewMonthDate}
            onChangeMonth={handleChangeMonth}
            appointmentCounts={appointmentCounts}
          />

          <div className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900 capitalize">
                Todos os agendamentos de {new Date(`${viewMonthDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <span className="text-xs font-bold text-[#9A3412] bg-[#FFEDD5] px-2.5 py-0.5 rounded-full">
                {monthAppointments.length} agendados
              </span>
            </div>

            {monthAppointments.length === 0 ? (
              <p className="text-xs text-slate-400 py-5 sm:py-6 text-center">Nenhum agendamento ativo neste mês.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 pk-grid-gap">
                {monthAppointments.map(apt => (
                  <button
                    type="button"
                    key={apt.id}
                    onClick={() => {
                      handleSelectCalendarDate(apt.date);
                      setViewMode('dia');
                    }}
                    className="text-left p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#EA580C] transition space-y-1.5 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black text-[#9A3412]">
                        {new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR')} • {apt.startTime}
                      </span>
                      <span className="font-mono text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded">
                        {apt.motorcyclePlate}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-xs truncate">{apt.clientName}</p>
                    <p className="text-[11px] text-slate-600 truncate">{apt.motorcycleModel} • {apt.serviceNames.join(', ')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOLICITAÇÃO DO AGENDAMENTO ONLINE */}
      <AppointmentRequestModal
        request={activeRequest}
        services={services}
        clients={clients}
        onClose={() => setRequestModalId(null)}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        onAddService={handleAddServiceToRequest}
      />

      {/* NOVO AGENDAMENTO — WIZARD DE 6 ETAPAS */}
      <NewAppointmentWizard
        isOpen={showNewAptModal}
        onClose={() => setShowNewAptModal(false)}
        initialDate={selectedDate}
      />
    </div>
  );
};
