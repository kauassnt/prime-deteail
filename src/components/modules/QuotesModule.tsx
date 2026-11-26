import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { alertDialog, confirmDialog } from '../../services/dialogService';
import {
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MessageCircle,
  ArrowRight,
  Check,
  Camera,
  Pencil,
  Image as ImageIcon,
  ClipboardList,
  CalendarDays,
  AlertTriangle
} from 'lucide-react';
import { PaymentStatus } from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { QuotePdfModal } from '../common/QuotePdfModal';
import { formatDateBR, getLocalDateKey } from '../../utils/dateUtils';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { parseSafeNumber } from '../../utils/inputValidation';
import { DEFAULT_CHECKLIST_ITEMS } from '../common/InspectionWorkflowSteps';
import { notifyRealtimeKey } from '../../services/realtimeService';

type PeriodFilter = 'max' | 'hoje' | 'ontem' | '7dias';
type QuoteStatus = 'pendente' | 'aprovado' | 'recusado' | 'convertido';

interface QuoteServiceLine {
  serviceId: string;
  name: string;
  price: number;
}

interface Quote {
  id: string;
  createdAt: string;
  validUntil: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  motorcycleId: string;
  motorcycleLabel: string;
  plate: string;
  services: QuoteServiceLine[];
  subtotal: number;
  discountPercent: number;
  total: number;
  notes: string;
  damages?: string[];
  photos?: string[];
  status: QuoteStatus;
}

const QUOTES_KEY = 'pk_detail_quotes_v1';

const STATUS_LABEL: Record<QuoteStatus, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  convertido: 'Em OS',
};

const STATUS_PILL: Record<QuoteStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recusado: 'bg-rose-50 text-rose-700 border-rose-200',
  convertido: 'bg-blue-50 text-blue-700 border-blue-200',
};

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatLongDateBR = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const loadQuotes = (): Quote[] => {
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Quote[]) : [];
  } catch {
    return [];
  }
};

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const QuotesModule: React.FC = () => {
  const {
    clients,
    motorcycles,
    services,
    users,
    createOrder,
    setSelectedOrderId,
  } = useApp();

  const todayIso = getLocalDateKey(new Date().toISOString());
  const yesterdayIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d.toISOString());
  }, []);
  const sevenDaysAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLocalDateKey(d.toISOString());
  }, []);
  const currentMonthKey = todayIso.slice(0, 7);

  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [period, setPeriod] = useState<PeriodFilter>('max');
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [pdfQuote, setPdfQuote] = useState<Quote | null>(null);

  useEffect(() => {
    const openWizard = () => {
      try {
        sessionStorage.removeItem('pk_open_new_quote');
      } catch {
        // ignora indisponibilidade do sessionStorage
      }
      setEditingQuote(null);
      setFormOpen(true);
    };

    try {
      if (sessionStorage.getItem('pk_open_new_quote') === '1') {
        sessionStorage.removeItem('pk_open_new_quote');
        openWizard();
      }
    } catch {
      // sem sessionStorage: evento ainda cobre o caso do módulo já montado
    }

    window.addEventListener('pk:new-quote', openWizard);
    return () => window.removeEventListener('pk:new-quote', openWizard);
  }, []);

  // Não grava no primeiro render: evita publicar uma lista vazia antes da
  // sincronização e apagar orçamentos que existem em outro dispositivo.
  const quotesSaveReady = useRef(false);
  useEffect(() => {
    if (!quotesSaveReady.current) {
      quotesSaveReady.current = true;
      return;
    }
    try {
      const serialized = JSON.stringify(quotes);
      localStorage.setItem(QUOTES_KEY, serialized);
      notifyRealtimeKey(QUOTES_KEY, serialized);
    } catch {
      // silencioso: orçamento continua disponível em memória
    }
  }, [quotes]);

  // Mantém a lista sincronizada com outras abas e outros dispositivos.
  useEffect(() => {
    const reload = () => setQuotes(loadQuotes());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === QUOTES_KEY) reload();
    };
    const handleRealtime = (e: Event) => {
      const keys = (e as CustomEvent<{ keys?: string[] }>).detail?.keys;
      if (!keys || keys.includes(QUOTES_KEY)) reload();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pk:realtime-state', handleRealtime);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pk:realtime-state', handleRealtime);
    };
  }, []);

  const shiftMonth = (delta: number) => {
    const base = monthFilter ?? currentMonthKey;
    const d = new Date(`${base}-01T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setPeriod('max');
  };

  const selectPeriod = (next: PeriodFilter) => {
    setPeriod(next);
    setMonthFilter(null);
  };

  const monthLabel = useMemo(() => {
    const base = monthFilter ?? currentMonthKey;
    const d = new Date(`${base}-01T00:00:00`);
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${month} ${d.getFullYear()}`;
  }, [monthFilter, currentMonthKey]);

  const filteredQuotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return quotes
      .filter(quote => {
        const matchSearch =
          !q ||
          quote.id.toLowerCase().includes(q) ||
          quote.clientName.toLowerCase().includes(q) ||
          quote.plate.toLowerCase().includes(q) ||
          quote.motorcycleLabel.toLowerCase().includes(q);

        const dateKey = getLocalDateKey(quote.createdAt);
        const matchPeriod =
          period === 'max'
            ? !monthFilter || dateKey.startsWith(monthFilter)
            : period === 'hoje'
              ? dateKey === todayIso
              : period === 'ontem'
                ? dateKey === yesterdayIso
                : dateKey >= sevenDaysAgoIso;

        const matchStatus = statusFilter === 'all' || quote.status === statusFilter;
        return matchSearch && matchPeriod && matchStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quotes, search, statusFilter, period, monthFilter, todayIso, yesterdayIso, sevenDaysAgoIso]);

  const updateQuoteStatus = (id: string, status: QuoteStatus) => {
    setQuotes(prev => prev.map(quote => (quote.id === id ? { ...quote, status } : quote)));
  };

  const removeQuote = async (id: string) => {
    const confirmed = await confirmDialog('Excluir este orçamento? Esta ação não pode ser desfeita.', {
      title: 'Excluir orçamento',
      confirmLabel: 'Excluir',
      cancelLabel: 'Manter',
      tone: 'danger'
    });
    if (!confirmed) return;
    setQuotes(prev => prev.filter(quote => quote.id !== id));
  };

  const convertQuoteToOrder = (quote: Quote) => {
    const client = clients.find(c => c.id === quote.clientId);
    const moto = motorcycles.find(m => m.id === quote.motorcycleId);
    if (!client || !moto) {
      void alertDialog('Cliente ou motocicleta não encontrados para converter este orçamento.', {
        title: 'Conversão indisponível'
      });
      return;
    }

    const employee = users[1] || users[0];
    const discount = (quote.subtotal * quote.discountPercent) / 100;

    const paymentStatus: PaymentStatus = 'pendente';
    const created = createOrder({
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
      status: 'para_fazer',
      paymentStatus,
      assignedEmployeeId: employee.id,
      assignedEmployeeName: employee.name,
      entryDateTime: new Date().toISOString(),
      services: quote.services.map(line => ({
        serviceId: line.serviceId,
        serviceName: line.name,
        price: line.price,
        estimatedMinutes: services.find(s => s.id === line.serviceId)?.estimatedMinutes || 60,
      })),
      productsConsumed: [],
      subtotal: quote.subtotal,
      discount,
      addition: 0,
      total: quote.total,
      amountPaid: 0,
      pendingBalance: quote.total,
      paymentTransactions: [],
      checklist: {
        entryDate: new Date().toISOString(),
        fuelLevel: '1/2',
        items: [
          ...DEFAULT_CHECKLIST_ITEMS.map(item => ({ ...item })),
          ...(quote.damages || []).map(damage => ({ item: damage, entryStatus: 'avaria' as const })),
        ],
        accessoriesLeft: [],
      },
      photosBefore: quote.photos || [],
      photosAfter: [],
      notes: quote.notes,
    });

    updateQuoteStatus(quote.id, 'convertido');
    setSelectedOrderId(created.id);
  };

  const shareQuoteOnWhatsapp = (quote: Quote) => {
    const lines = [
      `*Orçamento ${quote.id}* — PK Detail`,
      `Cliente: ${quote.clientName}`,
      `Veículo: ${quote.motorcycleLabel} · ${quote.plate}`,
      '',
      ...quote.services.map(s => `• ${s.name} — ${brl(s.price)}`),
      '',
      quote.discountPercent > 0 ? `Desconto: ${quote.discountPercent}%` : '',
      `*TOTAL: ${brl(quote.total)}*`,
      `Validade: ${formatDateBR(quote.validUntil)}`,
    ].filter(Boolean);
    const link = buildWhatsappLink(quote.clientPhone, lines.join('\n'));
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
    <div className={`flex flex-col gap-4 sm:gap-5 min-w-0 ${pdfQuote ? 'print:hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Orçamentos</h1>
            <p className="text-xs text-slate-500 mt-1.5">Gerencie os orçamentos da sua estética automotiva</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingQuote(null);
            setFormOpen(true);
          }}
          className="shrink-0 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {/* Period pills + month navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
        {([
          { id: 'max' as PeriodFilter, label: 'Máximo' },
          { id: 'hoje' as PeriodFilter, label: 'Hoje' },
          { id: 'ontem' as PeriodFilter, label: 'Ontem' },
          { id: '7dias' as PeriodFilter, label: '7 Dias' },
        ]).map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPeriod(p.id)}
            className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition ${
              period === p.id && !monthFilter
                ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                : 'text-slate-600 font-semibold hover:bg-slate-100'
            }`}
          >
            {p.label}
          </button>
        ))}

        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Mês anterior"
            className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span
            className={`px-3 py-1.5 rounded-md border text-xs font-bold capitalize whitespace-nowrap transition ${
              monthFilter ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Próximo mês"
            className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, placa ou veículo..."
            className="w-full min-h-[40px] bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
          />
        </div>

        <div className="relative shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | QuoteStatus)}
            aria-label="Filtro por status"
            className="min-h-[40px] bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-xs font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
          >
            <option value="all">Status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="convertido">Em OS</option>
          </select>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Visualizar em cartões"
            aria-pressed={viewMode === 'grid'}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
              viewMode === 'grid'
                ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="Visualizar em lista"
            aria-pressed={viewMode === 'list'}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
              viewMode === 'list'
                ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      {filteredQuotes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-16 px-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-extrabold text-slate-900">Nenhum orçamento encontrado.</p>
          <p className="text-xs text-slate-500 mt-1">Ajuste os filtros ou crie um novo orçamento.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="flex flex-col gap-2.5 min-w-0 pk-stagger">
          {filteredQuotes.map(quote => (
            <article
              key={quote.id}
              className="relative bg-white rounded-2xl border border-slate-200/80 shadow-xs pl-3.5 pr-3 py-3 min-w-0 overflow-hidden"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />

              <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4 min-w-0">
                {/* Cliente */}
                <div className="min-w-0 lg:w-[24%] lg:shrink-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{quote.clientName}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {quote.motorcycleLabel} · {quote.plate}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">Orçamento #{quote.id}</p>
                </div>

                {/* Serviços */}
                <div className="min-w-0 lg:flex-1 space-y-0.5">
                  {quote.services.map(line => (
                    <p key={`${quote.id}_${line.serviceId}`} className="text-[11.5px] text-slate-700 truncate">
                      {line.name}
                    </p>
                  ))}
                  {quote.services.length === 0 && (
                    <p className="text-[11px] text-slate-400">Sem serviços</p>
                  )}
                </div>

                {/* Valores */}
                <div className="min-w-0 lg:w-[120px] lg:shrink-0">
                  <p className="text-[11px] font-mono text-slate-600">{brl(quote.subtotal)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">Total</p>
                  <p className="text-base font-black font-mono text-slate-900 leading-tight">{brl(quote.total)}</p>
                </div>

                {/* Datas */}
                <div className="min-w-0 lg:w-[150px] lg:shrink-0 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Validade</p>
                    <p className="text-[11px] font-semibold text-slate-700">{formatDateBR(quote.validUntil)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Criado em</p>
                    <p className="text-[11px] font-semibold text-slate-700">{formatDateBR(quote.createdAt)}</p>
                  </div>
                </div>

                {/* Status + ações */}
                <div className="flex flex-col items-stretch lg:items-end gap-2 lg:w-[200px] lg:shrink-0">
                  <select
                    value={quote.status}
                    onChange={e => updateQuoteStatus(quote.id, e.target.value as QuoteStatus)}
                    aria-label={`Status do orçamento ${quote.id}`}
                    className={`self-start lg:self-end text-[10px] font-bold rounded-full border px-2.5 py-1 focus:outline-hidden cursor-pointer appearance-none text-center ${STATUS_PILL[quote.status]}`}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="recusado">Recusado</option>
                    <option value="convertido">Em OS</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shareQuoteOnWhatsapp(quote)}
                      aria-label="Enviar orçamento no WhatsApp"
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfQuote(quote)}
                      aria-label="Ver PDF do orçamento"
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-[#FFEDD5] text-[#A16207] flex items-center justify-center transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuote(quote);
                        setFormOpen(true);
                      }}
                      aria-label="Editar orçamento"
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-[#FFEDD5] text-[#A16207] flex items-center justify-center transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuote(quote.id)}
                      aria-label="Excluir orçamento"
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-500 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => convertQuoteToOrder(quote)}
                      disabled={quote.status === 'convertido'}
                      className="min-h-[34px] px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-extrabold transition whitespace-nowrap"
                    >
                      Converter Orçamento
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuoteStatus(quote.id, 'recusado')}
                      className="min-h-[34px] px-3 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold transition whitespace-nowrap"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          {filteredQuotes.map(quote => (
            <div
              key={quote.id}
              className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
            >
              <span className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#9A3412] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {quote.clientName} · {quote.plate}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {quote.id} · {formatDateBR(quote.createdAt)} · {quote.services.length} serviço(s)
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-800 shrink-0">{brl(quote.total)}</span>
              <span className={`shrink-0 text-[10px] font-bold rounded-full border px-2 py-0.5 ${STATUS_PILL[quote.status]}`}>
                {STATUS_LABEL[quote.status]}
              </span>
              <button
                type="button"
                onClick={() => convertQuoteToOrder(quote)}
                disabled={quote.status === 'convertido'}
                aria-label="Abrir OS deste orçamento"
                className="shrink-0 w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 text-white flex items-center justify-center transition"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPdfQuote(quote)}
                aria-label="Ver PDF do orçamento"
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeQuote(quote.id)}
                aria-label="Excluir orçamento"
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <QuoteFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={quote => {
          setQuotes(prev => {
            const exists = prev.some(item => item.id === quote.id);
            return exists ? prev.map(item => (item.id === quote.id ? quote : item)) : [quote, ...prev];
          });
          setFormOpen(false);
          setEditingQuote(null);
        }}
        nextNumber={quotes.length + 1}
        initialQuote={editingQuote}
      />

      <QuotePdfModal
        quote={pdfQuote}
        clientPhone={pdfQuote?.clientPhone}
        onClose={() => setPdfQuote(null)}
      />
    </div>
    </>
  );
};

interface QuoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (quote: Quote) => void;
  nextNumber: number;
  initialQuote?: Quote | null;
}

const QUOTE_WIZARD_STEPS: { id: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { id: 1, label: 'Cliente' },
  { id: 2, label: 'Serviços' },
  { id: 3, label: 'Checklist' },
  { id: 4, label: 'Fotos' },
  { id: 5, label: 'Validade' },
  { id: 6, label: 'Confirmar' },
];

const QUOTE_DAMAGE_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Exterior', items: ['Amassados', 'Arranhões na lataria', 'Risco no para-choque', 'Mancha na pintura'] },
  { title: 'Interior', items: ['Manchas no estofado', 'Painel riscado', 'Falta de peça/acessório'] },
  { title: 'Rodas', items: ['Pneus desgastados', 'Roda amassada'] },
  { title: 'Vidros', items: ['Vidros trincados', 'Vidro quebrado'] },
];

const QuoteFormModal: React.FC<QuoteFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextNumber,
  initialQuote = null,
}) => {
  const { clients, motorcycles, services, setActiveModule } = useApp();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [motoId, setMotoId] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [damages, setDamages] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [validUntil, setValidUntil] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setClientSearch('');
    setServiceSearch('');
    setClientId(initialQuote?.clientId || '');
    setMotoId(initialQuote?.motorcycleId || '');
    setSelectedServices(initialQuote?.services.map(line => line.serviceId) || []);
    setDamages(initialQuote?.damages || []);
    setCustomDamage('');
    setPhotos(initialQuote?.photos || []);
    setValidUntil(initialQuote ? getLocalDateKey(initialQuote.validUntil) : getLocalDateKey(addDaysIso(7)));
    setDiscountPercent(initialQuote?.discountPercent || 0);
    setNotes(initialQuote?.notes || '');
    setError('');
  }, [isOpen, initialQuote]);

  const clientMotos = motorcycles.filter(m => m.clientId === clientId);
  const selectedClient = clients.find(c => c.id === clientId);
  const selectedMoto = motorcycles.find(m => m.id === motoId) || clientMotos[0];
  const chosen = services.filter(s => selectedServices.includes(s.id));
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const discount = Math.min(subtotal, (subtotal * (discountPercent || 0)) / 100);
  const total = Math.max(0, subtotal - discount);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        motorcycles.some(m => m.clientId === c.id && m.plate.toLowerCase().includes(q))
    );
  }, [clients, motorcycles, clientSearch]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.toLowerCase().trim();
    return services.filter(s => s.active).filter(s => !q || s.name.toLowerCase().includes(q));
  }, [services, serviceSearch]);

  const customDamages = damages.filter(d => !QUOTE_DAMAGE_GROUPS.some(g => g.items.includes(d)));

  const toggleService = (id: string) => {
    setError('');
    setSelectedServices(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const toggleDamage = (damage: string) => {
    setDamages(prev => (prev.includes(damage) ? prev.filter(d => d !== damage) : [...prev, damage]));
  };

  const addCustomDamage = () => {
    const label = customDamage.trim();
    if (!label) return;
    if (!damages.includes(label)) setDamages(prev => [...prev, label]);
    setCustomDamage('');
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos(prev => [...prev, reader.result as string].slice(0, 6));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const validateStep = (target: number): boolean => {
    setError('');
    if (target === 1) {
      if (!selectedClient) {
        setError('Selecione um cliente para continuar.');
        return false;
      }
      if (!selectedMoto) {
        setError('Selecione a motocicleta do cliente.');
        return false;
      }
    }
    if (target === 2 && chosen.length === 0) {
      setError('Selecione pelo menos um serviço.');
      return false;
    }
    if (target === 5 && !validUntil) {
      setError('Informe a data de validade do orçamento.');
      return false;
    }
    if (target === 6) {
      if (chosen.length === 0) {
        setError('Selecione pelo menos um serviço.');
        return false;
      }
      if (discountPercent < 0 || discountPercent > 100) {
        setError('O desconto deve estar entre 0% e 100%.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 6) {
      if (!validateStep(step)) return;
      setStep(prev => (prev + 1) as 1 | 2 | 3 | 4 | 5 | 6);
      return;
    }
    if (!validateStep(6)) return;
    if (!selectedClient || !selectedMoto) return;

    onSave({
      id: initialQuote?.id || `ORC-${String(nextNumber).padStart(4, '0')}`,
      createdAt: initialQuote?.createdAt || new Date().toISOString(),
      validUntil: new Date(`${validUntil}T12:00:00`).toISOString(),
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientPhone: selectedClient.phone,
      motorcycleId: selectedMoto.id,
      motorcycleLabel: `${selectedMoto.brand} ${selectedMoto.model}`,
      plate: selectedMoto.plate,
      services: chosen.map(s => ({ serviceId: s.id, name: s.name, price: s.price })),
      subtotal,
      discountPercent,
      total,
      notes,
      damages,
      photos,
      status: initialQuote?.status || 'pendente',
    });
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Novo Orçamento" maxWidth="md">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
        {/* Stepper */}
        <div className="px-4 pt-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start">
            {QUOTE_WIZARD_STEPS.map((item, idx) => {
              const isDone = step > item.id;
              const isActive = step === item.id;
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && (
                    <span className={`flex-1 h-[2px] mt-[11px] ${step >= item.id ? 'bg-[#EA580C]' : 'bg-slate-200'}`} />
                  )}
                  <div className="flex flex-col items-center gap-1 w-[46px] shrink-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition ${
                        isActive || isDone
                          ? 'bg-[#EA580C] border-[#EA580C] text-white'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : item.id}
                    </span>
                    <span
                      className={`text-[9px] leading-tight text-center ${
                        isActive || isDone ? 'font-bold text-slate-900' : 'font-medium text-slate-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto pk-scroll-compact px-4 py-3.5 space-y-3">
          {/* ETAPA 1 — CLIENTE */}
          {step === 1 && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente pelo nome ou placa..."
                  className="w-full min-h-[42px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setActiveModule('clientes');
                }}
                className="w-full min-h-[42px] rounded-xl border border-dashed border-[#EA580C] bg-[#FFEDD5]/60 hover:bg-[#FFEDD5] text-[#9A3412] text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Cadastrar Novo Cliente</span>
              </button>

              {filteredClients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum cliente encontrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredClients.slice(0, 40).map(client => {
                    const bikes = motorcycles.filter(m => m.clientId === client.id);
                    const isSelected = client.id === clientId;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id);
                          setMotoId(bikes[0]?.id || '');
                          setError('');
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-2 flex items-center justify-between gap-2 transition ${
                          isSelected ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900 truncate">{client.name}</span>
                          <span className="block text-[10px] text-slate-500 truncate">
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
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Motocicleta</label>
                  <select
                    value={motoId}
                    onChange={e => setMotoId(e.target.value)}
                    className="w-full min-h-[42px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  >
                    {clientMotos.map(moto => (
                      <option key={moto.id} value={moto.id}>
                        {moto.brand} {moto.model} · {moto.plate}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* ETAPA 2 — SERVIÇOS */}
          {step === 2 && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={e => setServiceSearch(e.target.value)}
                  placeholder="Buscar serviço..."
                  className="w-full min-h-[42px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                {filteredServices.map(service => {
                  const isChecked = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                        isChecked ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-semibold text-slate-800 truncate">{service.name}</span>
                      <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">{brl(service.price)}</span>
                    </button>
                  );
                })}
                {filteredServices.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhum serviço encontrado.</p>
                )}
              </div>

              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-1">Serviços selecionados</p>
              <div
                className={`rounded-xl border-2 border-dashed p-3 ${
                  chosen.length > 0 ? 'border-[#EA580C] bg-[#FFEDD5]/40' : 'border-slate-200'
                }`}
              >
                {chosen.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">Nenhum serviço selecionado</p>
                ) : (
                  <div className="space-y-1">
                    {chosen.map(service => (
                      <div key={service.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-700 truncate">{service.name}</span>
                        <span className="font-mono text-slate-600 shrink-0">{brl(service.price)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-900 pt-1.5 border-t border-[#EA580C]/60">
                      <span>Total</span>
                      <span className="font-mono">{brl(subtotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ETAPA 3 — CHECKLIST */}
          {step === 3 && (
            <>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <ClipboardList className="w-4 h-4 text-[#EA580C]" />
                  Checklist de Avarias
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Esta etapa é opcional.</p>
              </div>

              {QUOTE_DAMAGE_GROUPS.map(group => (
                <div key={group.title} className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{group.title}</p>
                  {group.items.map(damage => {
                    const isChecked = damages.includes(damage);
                    return (
                      <label
                        key={damage}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition ${
                          isChecked ? 'border-[#EA580C] bg-[#FFEDD5]' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDamage(damage)}
                          className="w-4 h-4 accent-[#EA580C]"
                        />
                        <span className="text-xs font-medium text-slate-800">{damage}</span>
                      </label>
                    );
                  })}
                </div>
              ))}

              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avaria personalizada</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDamage}
                    onChange={e => setCustomDamage(e.target.value)}
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
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-slate-800 truncate">{damage}</span>
                    <button
                      type="button"
                      onClick={() => toggleDamage(damage)}
                      aria-label={`Remover ${damage}`}
                      className="w-6 h-6 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ETAPA 4 — FOTOS */}
          {step === 4 && (
            <>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <ImageIcon className="w-4 h-4 text-[#EA580C]" />
                  Fotos do Veículo
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Etapa opcional — pode avançar sem foto.</p>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center space-y-3">
                <Camera className="w-6 h-6 mx-auto text-[#FDBA74]" />
                <p className="text-[11px] text-slate-500">Arraste fotos ou clique para fazer upload</p>
                <div className="flex items-center gap-2">
                  <label className="flex-1 min-h-[38px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
                    <Camera className="w-4 h-4" />
                    <span>Tirar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        handlePhotoFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <label className="flex-1 min-h-[38px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition">
                    <ImageIcon className="w-4 h-4" />
                    <span>Galeria</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => {
                        handlePhotoFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Fotos adicionadas ({photos.length})
              </p>

              {photos.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center">
                  <p className="text-[11px] text-slate-400">Nenhuma foto adicionada</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, idx) => (
                    <div key={`quote_photo_${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                      <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                        aria-label="Remover foto"
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ETAPA 5 — VALIDADE */}
          {step === 5 && (
            <>
              <p className="text-xs font-extrabold text-slate-900">Validade do Orçamento</p>

              <div className="relative">
                <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => {
                    setValidUntil(e.target.value);
                    setError('');
                  }}
                  aria-label="Data de validade do orçamento"
                  className="w-full min-h-[42px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Este orçamento é válido até <span className="font-bold text-slate-700">{formatLongDateBR(validUntil)}</span>.
              </p>

              <div className="flex items-center gap-1.5">
                {[7, 15, 30].map(days => {
                  const target = getLocalDateKey(addDaysIso(days));
                  const isActive = validUntil === target;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        setValidUntil(target);
                        setError('');
                      }}
                      className={`flex-1 min-h-[32px] rounded-lg border text-[11px] font-bold transition ${
                        isActive
                          ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {days} dias
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1 pt-1">
                <p className="text-xs font-extrabold text-slate-900">Observações</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden resize-y"
                />
              </div>
            </>
          )}

          {/* ETAPA 6 — CONFIRMAR */}
          {step === 6 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-center text-[11px] font-black uppercase tracking-wider text-slate-900">
                Resumo do Orçamento
              </p>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedClient?.name}</p>
                  <p className="text-[11px] text-slate-600 truncate">{selectedClient?.phone}</p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-[11px] text-slate-600 truncate">{selectedMoto?.model}</p>
                  <p className="text-[11px] text-slate-600 truncate font-mono">{selectedMoto?.plate}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Serviços Selecionados</p>
                <div className="space-y-1 mt-1">
                  {chosen.map(service => (
                    <div key={service.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-700 truncate">• {service.name}</span>
                      <span className="font-mono text-slate-600 shrink-0">{brl(service.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-mono font-semibold text-slate-800">{brl(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600">Desconto geral (%):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={discountPercent || ''}
                      onChange={e => {
                        setDiscountPercent(parseSafeNumber(e.target.value, { min: 0 }));
                        setError('');
                      }}
                      placeholder="0,00"
                      className="w-20 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm font-black text-slate-900 pt-1">
                  <span>Total:</span>
                  <span className="font-mono">{brl(total)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data de Criação</p>
                  <p className="text-[11px] font-semibold text-slate-700">{formatDateBR(new Date().toISOString())}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Validade</p>
                  <p className="text-[11px] font-semibold text-slate-700">{formatDateBR(validUntil)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#EA580C]/80 bg-[#FFEDD5]/80 px-3 py-2 text-center">
                <p className="text-[10px] font-semibold text-[#9A3412]">
                  Este orçamento é válido somente até o dia {formatLongDateBR(validUntil)}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-white shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(prev => (prev - 1) as 1 | 2 | 3 | 4 | 5 | 6);
              }}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Voltar</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="min-h-[40px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
          >
            <span>{step === 6 ? 'Finalizar Orçamento' : 'Próximo'}</span>
            {step < 6 && <ChevronRight className="w-4 h-4 shrink-0" />}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
};
