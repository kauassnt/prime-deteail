import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { requestNewAppointment, requestNewQuote } from '../../utils/quickActions';
import { getActiveDailyGoal } from '../../utils/goalsStorage';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Target,
  FileText,
  FileCheck,
  Wrench,
  Car,
  ChevronRight
} from 'lucide-react';
import { useCurrentDate, getLocalDateKey, isDateStrInPeriod } from '../../utils/dateUtils';
import { requestPatioFocus, PatioFocusTab } from '../../services/patioFocus';
import { patioStageOf } from '../../services/patioStage';

export const DashboardModule: React.FC = () => {
  const { orders, appointments, setActiveModule, openQuickAction } = useApp();
  const { now, todayStr, yesterdayStr } = useCurrentDate();

  const [heroPeriod, setHeroPeriod] = useState<'hoje' | 'ontem' | '7dias'>('hoje');
  const [showRevenueValue, setShowRevenueValue] = useState(true);

  // Cada card do pátio abre a coluna correspondente já destacada
  const openPatioColumn = (tab: PatioFocusTab | null) => {
    requestPatioFocus(tab);
    setActiveModule('patio');
  };

  // Meta diária derivada da aba Metas (só existe quando as metas estão ativas).
  // O contador força a releitura quando outra aba/dispositivo altera as metas.
  const [goalsTick, setGoalsTick] = useState(0);
  useEffect(() => {
    const refreshGoals = () => setGoalsTick(tick => tick + 1);
    window.addEventListener('pk:realtime-state', refreshGoals);
    window.addEventListener('storage', refreshGoals);
    return () => {
      window.removeEventListener('pk:realtime-state', refreshGoals);
      window.removeEventListener('storage', refreshGoals);
    };
  }, []);
  const activeGoal = useMemo(() => getActiveDailyGoal(todayStr.slice(0, 7)), [todayStr, goalsTick]);
  const dailyGoal = activeGoal?.dailyGoal || 0;

  const validOrders = useMemo(() => orders.filter(o => o.status !== 'cancelado'), [orders]);

  // Specific Day Metrics (auto-updates at midnight)
  // Meta de Hoje: dinheiro que realmente entrou hoje (qualquer forma de pagamento)
  const recebidoHoje = useMemo(
    () =>
      validOrders.reduce((acc, order) => {
        const txs = order.paymentTransactions || [];
        if (txs.length > 0) {
          return (
            acc +
            txs
              .filter(tx => tx.status === 'confirmado' && getLocalDateKey(tx.date) === todayStr)
              .reduce((sum, tx) => sum + tx.amount, 0)
          );
        }
        return order.amountPaid > 0 && getLocalDateKey(order.entryDateTime) === todayStr
          ? acc + order.amountPaid
          : acc;
      }, 0),
    [validOrders, todayStr]
  );

  // Dinheiro que realmente entrou no período (transações confirmadas, qualquer forma de pagamento)
  const recebidoNoPeriodo = useMemo(() => {
    const inHeroPeriod = (dateStr: string) => {
      const key = getLocalDateKey(dateStr);
      if (heroPeriod === 'hoje') return key === todayStr;
      if (heroPeriod === 'ontem') return key === yesterdayStr;
      return isDateStrInPeriod(dateStr, '7dias', now);
    };

    return validOrders.reduce((acc, order) => {
      const txs = order.paymentTransactions || [];
      if (txs.length > 0) {
        return (
          acc +
          txs
            .filter(tx => tx.status === 'confirmado' && inHeroPeriod(tx.date))
            .reduce((sum, tx) => sum + tx.amount, 0)
        );
      }
      return order.amountPaid > 0 && inHeroPeriod(order.entryDateTime) ? acc + order.amountPaid : acc;
    }, 0);
  }, [validOrders, heroPeriod, todayStr, yesterdayStr, now]);

  // Operational metrics — mesma regra do Pátio: cada OS em uma única coluna
  const motosAguardando = validOrders.filter(o => patioStageOf(o) === 'para_fazer').length;
  const motosEmAtendimento = validOrders.filter(o => patioStageOf(o) === 'em_servico').length;
  const motosConcluidas = validOrders.filter(o => patioStageOf(o) === 'concluido').length;
  const motosPagas = validOrders.filter(o => patioStageOf(o) === 'pago').length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
      {/* Hero Card (Faturamento de Hoje — Reference Layout) */}
      <div className="relative min-w-0">
        <div className="relative bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#9A3412] rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-orange-950/15 overflow-hidden min-w-0">
          {/* Background Decorative Rings */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-white/15 pointer-events-none" />
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute right-12 top-12 w-24 h-24 rounded-full border border-white/25 pointer-events-none" />

          <div className="relative z-10 space-y-4 pt-1">
            {/* Top Row: Dollar Title + Eye Icon */}
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center font-black text-xs shrink-0">
                  $
                </div>
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate">
                  {heroPeriod === 'hoje' ? 'Recebido Hoje' : heroPeriod === 'ontem' ? 'Recebido Ontem' : 'Recebido (7 Dias)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRevenueValue(!showRevenueValue)}
                aria-label="Alternar visibilidade do valor"
                className="w-7 h-7 rounded-full text-white/70 hover:text-white flex items-center justify-center transition shrink-0"
              >
                {showRevenueValue ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Main Revenue Amount */}
            <div>
              <h2 className="text-[2.15rem] sm:text-4xl lg:text-5xl font-black text-white tracking-tight tabular-nums leading-none">
                {showRevenueValue
                  ? `R$ ${recebidoNoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'R$ ••••••'}
              </h2>

            </div>

            {/* Period Selector inside Hero Card */}
            <div className="flex items-center gap-1 bg-black/20 rounded-2xl p-1">
              {(['hoje', 'ontem', '7dias'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHeroPeriod(p)}
                  className={`flex-1 min-h-[36px] py-2 px-2.5 rounded-xl text-xs transition ${
                    heroPeriod === p
                      ? 'bg-white text-[#9A3412] font-black shadow-sm'
                      : 'text-white/85 hover:bg-white/10 font-bold'
                  }`}
                >
                  {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : 'Últimos 7 dias'}
                </button>
              ))}
            </div>

            {/* META DE HOJE Box — só aparece com as metas ativas na aba Metas */}
            {dailyGoal > 0 && (
            <div className="pt-3 border-t border-white/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-white">
                <div className="flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                  <Target className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Meta de Hoje</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('metas')}
                  className="font-bold text-orange-100 hover:text-white hover:underline inline-flex items-center gap-0.5 text-xs"
                >
                  <span>Ver metas</span>
                  <span className="text-[10px]">›</span>
                </button>
              </div>

              <div className="text-xs sm:text-sm font-black text-white tabular-nums">
                R$ {recebidoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {dailyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden p-0.5">
                <div
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, recebidoHoje / Math.max(1, dailyGoal)))})` }}
                  className="w-full h-full rounded-full bg-white origin-left transition-transform duration-300"
                />
              </div>

              <div className="text-[10px] sm:text-[11px] font-bold text-orange-100 tabular-nums">
                {((recebidoHoje / Math.max(1, dailyGoal)) * 100).toLocaleString('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                % atingido · faltam R$ {Math.max(0, dailyGoal - recebidoHoje).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 Quick Action Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => openQuickAction('os')}
          className="bg-white rounded-2xl p-3 sm:p-4 border-2 border-orange-200/90 shadow-xs hover:border-[#EA580C] hover:shadow-md transition flex flex-col items-center text-center group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[11px] sm:text-xs font-black text-slate-900">+ Nova OS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('agenda');
            requestNewAppointment();
          }}
          className="bg-white rounded-2xl p-3 sm:p-4 border-2 border-orange-200/90 shadow-xs hover:border-[#EA580C] hover:shadow-md transition flex flex-col items-center text-center group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[11px] sm:text-xs font-black text-slate-900">+ Novo Agendamento</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('orcamentos');
            requestNewQuote();
          }}
          className="bg-white rounded-2xl p-3 sm:p-4 border-2 border-orange-200/90 shadow-xs hover:border-[#EA580C] hover:shadow-md transition flex flex-col items-center text-center group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <span className="text-[11px] sm:text-xs font-black text-slate-900">+ Novo Orçamento</span>
        </button>
      </div>

      {/* MOTOS NO PÁTIO */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] shrink-0 inline-block" />
            <h3 className="text-xs sm:text-sm font-black tracking-wider uppercase text-slate-800">
              MOTOS NO PÁTIO
            </h3>
          </div>
          <button
            type="button"
            onClick={() => openPatioColumn(null)}
            className="px-2.5 py-1 rounded-full border border-slate-200/90 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* 4 Cards in 4-column Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {/* 1. Para fazer */}
          <button
            type="button"
            onClick={() => openPatioColumn('para_fazer')}
            aria-label={`Ver ${motosAguardando} moto(s) para fazer no pátio`}
            className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-xs relative flex flex-col items-center justify-between text-center min-h-[96px] sm:min-h-[108px] cursor-pointer hover:shadow-md hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 transition group"
          >
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-300" />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Car className="w-4 h-4" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Para fazer</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-none">{motosAguardando}</span>
          </button>

          {/* 2. Em serviço */}
          <button
            type="button"
            onClick={() => openPatioColumn('em_servico')}
            aria-label={`Ver ${motosEmAtendimento} moto(s) em serviço no pátio`}
            className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-xs relative flex flex-col items-center justify-between text-center min-h-[96px] sm:min-h-[108px] cursor-pointer hover:shadow-md hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 transition group"
          >
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-300" />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Em serviço</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-none">{motosEmAtendimento}</span>
          </button>

          {/* 3. Concluído */}
          <button
            type="button"
            onClick={() => openPatioColumn('concluido')}
            aria-label={`Ver ${motosConcluidas} moto(s) concluída(s) no pátio`}
            className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-xs relative flex flex-col items-center justify-between text-center min-h-[96px] sm:min-h-[108px] cursor-pointer hover:shadow-md hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 transition group"
          >
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-300" />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Concluído</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-none">{motosConcluidas}</span>
          </button>

          {/* 4. Pago */}
          <button
            type="button"
            onClick={() => openPatioColumn('pago')}
            aria-label={`Ver ${motosPagas} ordem(ns) paga(s) no pátio`}
            className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-xs relative flex flex-col items-center justify-between text-center min-h-[96px] sm:min-h-[108px] cursor-pointer hover:shadow-md hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 transition group"
          >
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-purple-300" />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Pago</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-none">{motosPagas}</span>
          </button>
        </div>
      </div>

      {/* AGENDAMENTOS DE HOJE */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] shrink-0 inline-block" />
            <h3 className="text-[11px] font-black tracking-[0.08em] uppercase text-slate-900 truncate">
              AGENDAMENTOS DE HOJE
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('agenda')}
            className="shrink-0 min-h-[34px] px-3.5 rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-800 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {appointments.filter(a => a.date === todayStr && a.status !== 'cancelado').length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-6 min-h-[92px] flex flex-col items-center justify-center text-center">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs font-medium text-slate-500">Nenhum agendamento para hoje.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments
              .filter(a => a.date === todayStr && a.status !== 'cancelado')
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(apt => (
                <button
                  type="button"
                  key={apt.id}
                  onClick={() => setActiveModule('agenda')}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 border-l-4 border-l-[#EA580C] hover:border-[#EA580C]/50 transition px-3.5 py-3 flex items-center gap-3 min-h-[62px]"
                >
                  <span className="w-9 h-9 rounded-full bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 tabular-nums shrink-0">
                    {apt.startTime}
                  </span>
                  <span className="text-sm font-bold text-slate-900 truncate min-w-0 flex-1 sm:pl-3">
                    {apt.clientName}
                  </span>
                  <span className="hidden sm:block text-[11px] font-medium text-slate-500 truncate max-w-[45%]">
                    {apt.motorcycleBrand || apt.motorcycleModel} ·{' '}
                    <span className="font-mono font-semibold text-slate-600">{apt.motorcyclePlate}</span>
                  </span>
                  <span className="sm:hidden text-[10.5px] font-medium text-slate-500 font-mono shrink-0">
                    {apt.motorcyclePlate}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
          </div>
        )}
      </div>

    </div>
  );
};
