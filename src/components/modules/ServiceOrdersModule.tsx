import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Plus,
  Copy,
  MessageCircle,
  AlertTriangle,
  Play,
  Search,
  SlidersHorizontal,
  Archive,
  CreditCard,
  ArrowUpDown,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { OSStatus, ServiceOrder } from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { formatDateBR, getLocalDateKey } from '../../utils/dateUtils';
import { StartServiceInspectionModal } from '../common/StartServiceInspectionModal';
import { useProgressiveList } from '../../hooks/useProgressiveRender';

type PeriodFilter = 'max' | 'hoje' | 'ontem' | '7dias' | 'mes';

const STATUS_ACCENT: Record<OSStatus, string> = {
  para_fazer: 'border-l-blue-500',
  em_servico: 'border-l-amber-500',
  concluido: 'border-l-emerald-500',
  entregue: 'border-l-purple-500',
  cancelado: 'border-l-rose-400',
};

const STATUS_TINT: Record<OSStatus, string> = {
  para_fazer: 'bg-blue-50/50 border-blue-200/70',
  em_servico: 'bg-amber-50/50 border-amber-200/70',
  concluido: 'bg-emerald-50/50 border-emerald-200/70',
  entregue: 'bg-purple-50/50 border-purple-200/70',
  cancelado: 'bg-rose-50/40 border-rose-200/70',
};

const STATUS_PILL: Record<OSStatus, string> = {
  para_fazer: 'bg-blue-50 text-blue-700 border-blue-200',
  em_servico: 'bg-amber-50 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  entregue: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelado: 'bg-rose-50 text-rose-700 border-rose-200',
};

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ServiceOrdersModule: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    sendWhatsappForOrderStatus,
    duplicateOrder,
    cancelOrder,
    openQuickAction,
    setSelectedOrderId,
    searchQuery,
    setSearchQuery,
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

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('max');
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recentes' | 'antigos'>('recentes');
  const [showArchived, setShowArchived] = useState(false);
  const [onlyReceivable, setOnlyReceivable] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<ServiceOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelado pelo operador');
  const [startingOrder, setStartingOrder] = useState<ServiceOrder | null>(null);

  const handleStatusTransition = (o: ServiceOrder, nextStatus: OSStatus) => {
    if (o.status === 'para_fazer' && nextStatus === 'em_servico') {
      setStartingOrder(o);
      return;
    }
    updateOrderStatus(o.id, nextStatus);
  };

  const shiftMonth = (delta: number) => {
    const base = monthFilter ?? currentMonthKey;
    const d = new Date(`${base}-01T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    // Filtro de mês explícito: deixa de parecer "Máximo" enquanto esconde ordens.
    setPeriod('mes');
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

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return orders
      .filter(o => {
        const matchSearch =
          !q ||
          o.id.toLowerCase().includes(q) ||
          o.clientName.toLowerCase().includes(q) ||
          o.motorcyclePlate.toLowerCase().includes(q) ||
          o.motorcycleBrand.toLowerCase().includes(q) ||
          o.motorcycleModel.toLowerCase().includes(q) ||
          (o.motorcycleVersion && o.motorcycleVersion.toLowerCase().includes(q)) ||
          (o.motorcycleCategory && o.motorcycleCategory.toLowerCase().includes(q));

        const dateKey = getLocalDateKey(o.entryDateTime);
        const matchPeriod =
          period === 'max' ||
          (period === 'hoje' && dateKey === todayIso) ||
          (period === 'ontem' && dateKey === yesterdayIso) ||
          (period === '7dias' && dateKey >= sevenDaysAgoIso && dateKey <= todayIso);

        const matchMonth = period !== 'mes' || !monthFilter || dateKey.startsWith(monthFilter);
        const matchStatus = statusFilter === 'all' || o.status === statusFilter;
        const matchArchived = showArchived || o.status !== 'cancelado';
        const matchReceivable = !onlyReceivable || o.pendingBalance > 0;

        return matchSearch && matchPeriod && matchMonth && matchStatus && matchArchived && matchReceivable;
      })
      .sort((a, b) =>
        sortMode === 'recentes'
          ? b.entryDateTime.localeCompare(a.entryDateTime)
          : a.entryDateTime.localeCompare(b.entryDateTime)
      );
  }, [
    orders,
    searchQuery,
    statusFilter,
    period,
    monthFilter,
    showArchived,
    onlyReceivable,
    sortMode,
    todayIso,
    yesterdayIso,
    sevenDaysAgoIso,
  ]);

  const progressiveOrders = useProgressiveList(filteredOrders, {
    initialCount: 20,
    stepCount: 20,
    resetKey: `${searchQuery}::${statusFilter}::${period}::${monthFilter}::${sortMode}::${showArchived}::${onlyReceivable}`,
  });

  const openOrder = (o: ServiceOrder) => setSelectedOrderId(o.id);

  const renderActions = (o: ServiceOrder, align: 'start' | 'end') => (
    <div className={`flex items-center gap-1.5 ${align === 'end' ? 'lg:justify-end' : ''}`}>
      {o.status === 'para_fazer' && (
        <button
          type="button"
          onClick={() => setStartingOrder(o)}
          title="Revisar checklist, 4 ângulos e iniciar serviço"
          aria-label="Iniciar serviço"
          className="w-7 h-7 rounded-md bg-[#FFEDD5] text-[#9A3412] hover:bg-[#FDE68A] flex items-center justify-center transition"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={() => sendWhatsappForOrderStatus(o.id)}
        title="Enviar status no WhatsApp"
        aria-label="Enviar status no WhatsApp"
        className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition"
      >
        <MessageCircle className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => openOrder(o)}
        title="Abrir OS e gerar PDF"
        aria-label="Abrir OS e gerar PDF"
        className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition"
      >
        <FileText className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => duplicateOrder(o.id)}
        title="Duplicar esta OS"
        aria-label="Duplicar esta OS"
        className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => openOrder(o)}
        title="Editar OS"
        aria-label="Editar OS"
        className="w-7 h-7 rounded-md bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {o.status !== 'cancelado' && (
        <button
          type="button"
          onClick={() => {
            setCancelReason('Cancelado pelo operador');
            setConfirmCancelOrder(o);
          }}
          title="Cancelar OS"
          aria-label="Cancelar OS"
          className="w-7 h-7 rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const renderStatusPill = (o: ServiceOrder) => {
    if (o.status === 'cancelado') {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${STATUS_PILL.cancelado}`}>
          Cancelado
        </span>
      );
    }

    return (
      <select
        aria-label={`Alterar status da ${o.id}`}
        value={o.status}
        onChange={e => handleStatusTransition(o, e.target.value as OSStatus)}
        className={`max-w-[130px] text-[11px] font-bold rounded-full border px-2.5 py-1 focus:outline-hidden cursor-pointer appearance-none text-center ${STATUS_PILL[o.status]}`}
      >
        <option value="para_fazer">Para Fazer</option>
        <option value="em_servico">Em Serviço</option>
        <option value="concluido">Concluído</option>
        <option value="entregue">Entregue</option>
      </select>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header — Reference Layout */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Ordem de Serviço</h1>
            <p className="text-xs text-slate-500 mt-1.5">Gerencie as ordens de serviço da sua estética automotiva</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openQuickAction('os')}
          className="shrink-0 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>Nova OS</span>
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
              period === p.id
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
          <span className={`px-3 py-1.5 rounded-md border text-xs font-bold capitalize whitespace-nowrap transition ${
            period === 'mes' ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]' : 'border-slate-200 bg-white text-slate-700'
          }`}>
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
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, placa ou veículo..."
            className="w-full min-h-[40px] bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
          />
        </div>

        <div className="relative shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filtro por status"
            className="min-h-[40px] bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-xs font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
          >
            <option value="all">Filtro por Status</option>
            <option value="para_fazer">Para Fazer</option>
            <option value="em_servico">Em Serviço</option>
            <option value="concluido">Concluído</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setSortMode(prev => (prev === 'recentes' ? 'antigos' : 'recentes'))}
          className="shrink-0 min-h-[40px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition"
          title="Alternar ordenação"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          <span className="whitespace-nowrap">{sortMode === 'recentes' ? 'Mais recentes' : 'Mais antigas'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowArchived(prev => !prev)}
          aria-pressed={showArchived}
          className={`shrink-0 min-h-[40px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
            showArchived
              ? 'bg-[#FFEDD5] border-[#EA580C] text-[#9A3412]'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Mostrar Arquivadas</span>
        </button>

        <button
          type="button"
          onClick={() => setOnlyReceivable(prev => !prev)}
          aria-pressed={onlyReceivable}
          className={`shrink-0 min-h-[40px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
            onlyReceivable
              ? 'bg-[#FFEDD5] border-[#EA580C] text-[#9A3412]'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">A Receber</span>
        </button>

        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Visualizar em cartões"
            aria-pressed={viewMode === 'grid'}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition border ${
              viewMode === 'grid'
                ? 'bg-[#EA580C] border-[#EA580C] text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="Visualizar em lista"
            aria-pressed={viewMode === 'list'}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition border ${
              viewMode === 'list'
                ? 'bg-[#EA580C] border-[#EA580C] text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resumo dos filtros ativos: deixa claro quando alguma OS está oculta */}
      <div className="flex items-center justify-between gap-2 -mt-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
          {filteredOrders.length} de {orders.filter(o => showArchived || o.status !== 'cancelado').length} ordens
        </p>
        {(statusFilter !== 'all' || period !== 'max' || Boolean(monthFilter) || onlyReceivable || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPeriod('max');
              setMonthFilter(null);
              setOnlyReceivable(false);
              setShowArchived(false);
              setSearchQuery('');
            }}
            className="shrink-0 text-[11px] font-bold text-[#9A3412] hover:text-[#EA580C] underline underline-offset-2 transition"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Orders list */}
      <div className={`pk-stagger ${viewMode === 'grid' ? 'space-y-2.5 sm:space-y-3' : 'space-y-2'}`}>
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-7 sm:p-9 text-center flex flex-col items-center justify-center min-h-[190px]">
            <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-extrabold text-slate-900">Nenhuma Ordem de Serviço encontrada.</p>
            <p className="text-xs text-slate-500 mt-1">Ajuste os filtros de busca ou crie uma nova OS.</p>
            <button
              type="button"
              onClick={() => openQuickAction('os')}
              className="mt-4 min-h-[42px] px-5 py-2.5 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
            >
              <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
              <span>Nova OS</span>
            </button>
          </div>
        ) : (
          progressiveOrders.visibleItems.map(o => {
            const hiddenServices = Math.max(0, o.services.length - 3);
            const createdDate = formatDateBR(getLocalDateKey(o.entryDateTime));

            if (viewMode === 'list') {
              return (
                <div
                  key={o.id}
                  className={`rounded-xl border border-l-4 ${STATUS_TINT[o.status]} ${STATUS_ACCENT[o.status]} shadow-xs px-3.5 py-2.5 flex flex-wrap items-center gap-3 min-w-0`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-slate-900 truncate">{o.clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {o.motorcycleBrand} · {o.motorcyclePlate}
                    </p>
                  </div>

                  {renderStatusPill(o)}

                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">Criado em {createdDate}</span>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                    <span className="text-sm font-black text-slate-900 tabular-nums">{brl(o.total)}</span>
                  </div>

                  {renderActions(o, 'start')}
                </div>
              );
            }

            return (
              <div
                key={o.id}
                className={`rounded-xl border border-l-4 ${STATUS_TINT[o.status]} ${STATUS_ACCENT[o.status]} shadow-xs hover:shadow-md transition p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start min-w-0`}
              >
                {/* Client */}
                <div className="lg:col-span-3 min-w-0">
                  <p className="font-extrabold text-sm text-slate-900 truncate">{o.clientName}</p>
                  <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                    {o.motorcycleBrand} · {o.motorcyclePlate}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">OS #{o.id}</p>
                </div>

                {/* Services */}
                <div className="lg:col-span-4 min-w-0 space-y-0.5">
                  {o.services.slice(0, 3).map((s, idx) => (
                    <div key={`${s.serviceId}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-600 truncate">{s.serviceName}</span>
                      <span className="text-slate-600 font-mono tabular-nums shrink-0">{brl(s.price)}</span>
                    </div>
                  ))}
                  {hiddenServices > 0 && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      + outros {hiddenServices} serviços
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="lg:col-span-2 min-w-0 space-y-1.5">
                  {renderStatusPill(o)}
                  <p className="text-[10px] text-slate-400 tabular-nums">Criado em {createdDate}</p>
                </div>

                {/* Total + actions */}
                <div className="lg:col-span-3 min-w-0 lg:text-right space-y-1.5">
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Total</span>
                    <span className="text-lg font-black text-slate-900 tabular-nums leading-tight">{brl(o.total)}</span>
                  </div>

                  {o.pendingBalance > 0 && (
                    <p className="text-[10px] font-bold text-amber-600 tabular-nums">
                      Falta {brl(o.pendingBalance)}
                    </p>
                  )}

                  {renderActions(o, 'end')}
                </div>
              </div>
            );
          })
        )}

        {progressiveOrders.hasMore && (
          <div ref={progressiveOrders.sentinelRef} className="pt-2 text-center">
            <button
              type="button"
              onClick={progressiveOrders.showMore}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#9A3412] bg-[#FFEDD5] hover:bg-[#FDE68A] transition"
            >
              Carregar mais ordens de serviço ({progressiveOrders.remainingCount} restantes)
            </button>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <ResponsiveModal
        isOpen={Boolean(confirmCancelOrder)}
        onClose={() => setConfirmCancelOrder(null)}
        title={`Cancelar Ordem ${confirmCancelOrder?.id || ''}`}
        maxWidth="sm"
      >
        {confirmCancelOrder && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Tem certeza que deseja cancelar a ordem <strong>{confirmCancelOrder.id}</strong> ({confirmCancelOrder.clientName} · {confirmCancelOrder.motorcyclePlate})?
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Motivo do cancelamento</label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmCancelOrder(null)}
                className="min-h-[42px] py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelOrder(confirmCancelOrder.id, cancelReason.trim() || 'Cancelado pelo operador');
                  setConfirmCancelOrder(null);
                }}
                className="min-h-[42px] py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Pre-Service Checklist & 4-Angle Photo Step Modal */}
      <StartServiceInspectionModal
        order={startingOrder}
        onClose={() => setStartingOrder(null)}
      />
    </div>
  );
};
