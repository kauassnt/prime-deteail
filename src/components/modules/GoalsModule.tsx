import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Target,
  Settings2,
  Banknote,
  History,
  TrendingUp,
  X
} from 'lucide-react';
import { getLocalDateKey } from '../../utils/dateUtils';
import { parseSafeNumber } from '../../utils/inputValidation';
import { notifyRealtimeKey } from '../../services/realtimeService';

interface MonthGoal {
  target: number;
  weekdays: number[];
}

interface GoalsState {
  enabled: boolean;
  goals: Record<string, MonthGoal>;
}

const GOALS_KEY = 'pk_detail_goals_v1';

const WEEKDAY_CHIPS: { id: number; label: string }[] = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthLabel = (monthKey: string, style: 'long' | 'short' = 'long') => {
  const d = new Date(`${monthKey}-01T12:00:00`);
  const label = d.toLocaleDateString('pt-BR', { month: style, year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const loadGoals = (): GoalsState => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && parsed.goals) {
      return { enabled: Boolean(parsed.enabled), goals: parsed.goals };
    }
  } catch {
    // dados corrompidos: começa vazio
  }
  return { enabled: false, goals: {} };
};

const countBusinessDays = (monthKey: string, weekdays: number[]) => {
  const d = new Date(`${monthKey}-01T12:00:00`);
  const month = d.getMonth();
  let count = 0;
  while (d.getMonth() === month) {
    if (weekdays.includes(d.getDay())) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

export const GoalsModule: React.FC = () => {
  const { orders } = useApp();

  const todayKey = getLocalDateKey(new Date().toISOString());
  const currentMonth = todayKey.slice(0, 7);

  const [state, setState] = useState<GoalsState>(() => loadGoals());
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTarget, setDraftTarget] = useState(0);
  const [draftWeekdays, setDraftWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  // Não grava no primeiro render: evita publicar metas vazias antes da
  // sincronização e apagar a meta configurada em outro dispositivo.
  const goalsSaveReady = useRef(false);
  useEffect(() => {
    if (!goalsSaveReady.current) {
      goalsSaveReady.current = true;
      return;
    }
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(GOALS_KEY, serialized);
      notifyRealtimeKey(GOALS_KEY, serialized);
    } catch {
      // segue em memória
    }
  }, [state]);

  // Metas configuradas em outro dispositivo/aba entram sem recarregar a página.
  useEffect(() => {
    const reload = () => setState(loadGoals());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === GOALS_KEY) reload();
    };
    const handleRealtime = (e: Event) => {
      const keys = (e as CustomEvent<{ keys?: string[] }>).detail?.keys;
      if (!keys || keys.includes(GOALS_KEY)) reload();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pk:realtime-state', handleRealtime);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pk:realtime-state', handleRealtime);
    };
  }, []);

  const monthGoal = state.goals[currentMonth];

  // Mesmo critério do Dashboard, Finanças e Relatórios: valor das OS emitidas no mês.
  const monthOrders = useMemo(
    () =>
      orders
        .filter(o => o.status !== 'cancelado' && getLocalDateKey(o.entryDateTime).startsWith(currentMonth))
        .map(o => ({ id: o.id, date: o.entryDateTime, clientName: o.clientName, amount: o.total }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [orders, currentMonth]
  );

  const monthRevenue = monthOrders.reduce((sum, item) => sum + item.amount, 0);

  const businessDays = monthGoal ? countBusinessDays(currentMonth, monthGoal.weekdays) : 0;
  const dailyBase = monthGoal && businessDays > 0 ? monthGoal.target / businessDays : 0;
  const progressPct = monthGoal && monthGoal.target > 0 ? Math.min(100, (monthRevenue / monthGoal.target) * 100) : 0;

  const history = useMemo(
    () =>
      Object.keys(state.goals)
        .filter(key => key < currentMonth)
        .sort((a, b) => b.localeCompare(a))
        .map(key => {
          const goal = state.goals[key];
          const revenue = orders
            .filter(order => order.status !== 'cancelado' && getLocalDateKey(order.entryDateTime).startsWith(key))
            .reduce((sum, order) => sum + order.total, 0);
          return { key, goal, revenue };
        }),
    [state.goals, orders, currentMonth]
  );

  const draftBusinessDays = useMemo(() => countBusinessDays(currentMonth, draftWeekdays), [currentMonth, draftWeekdays]);
  const draftDailyBase = draftBusinessDays > 0 ? draftTarget / draftBusinessDays : 0;

  const openConfigure = () => {
    setDraftTarget(monthGoal?.target || 0);
    setDraftWeekdays(monthGoal?.weekdays?.length ? monthGoal.weekdays : [1, 2, 3, 4, 5, 6]);
    setModalOpen(true);
  };

  const toggleMetas = () => {
    setState(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const saveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({
      ...prev,
      enabled: true,
      goals: {
        ...prev.goals,
        [currentMonth]: { target: draftTarget, weekdays: draftWeekdays },
      },
    }));
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Metas</h1>
            <p className="text-xs text-slate-500 mt-1.5">Acompanhe seu faturamento em relação ao objetivo do mês</p>
          </div>
        </div>

        {state.enabled && (
          <button
            type="button"
            onClick={openConfigure}
            className="shrink-0 min-h-[36px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configurar meta</span>
          </button>
        )}
      </div>

      {/* Toggle card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Metas</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">Ativar Metas</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[560px] leading-snug">
            {state.enabled
              ? 'Metas está ativada. Seu progresso de faturamento está sendo acompanhado no Dashboard e nesta página.'
              : 'Ative para definir um objetivo mensal de faturamento e acompanhar seu progresso. Suas configurações e histórico continuam guardados.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label="Ativar metas"
          onClick={toggleMetas}
          className={`shrink-0 mt-1 w-11 h-6 rounded-full transition relative ${state.enabled ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${state.enabled ? 'left-[22px]' : 'left-0.5'}`}
          />
        </button>
      </section>

      {/* Enabled content */}
      {state.enabled && (
        <>
          {!monthGoal ? (
            <section className="rounded-2xl border border-slate-200/80 bg-white py-12 px-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="w-9 h-9 rounded-full bg-[#FFEDD5] text-[#A16207] flex items-center justify-center">
                <Target className="w-4 h-4" />
              </span>
              <p className="text-sm font-extrabold text-slate-900">Defina sua meta de faturamento</p>
              <p className="text-xs text-slate-500 max-w-[340px]">
                Acompanhe diariamente seu progresso e quanto falta para atingir seu objetivo.
              </p>
              <button
                type="button"
                onClick={openConfigure}
                className="mt-1 min-h-[36px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
              >
                Configurar meta
              </button>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 space-y-2.5 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                    Meta de {monthLabel(currentMonth, 'short')}
                  </p>
                  <p className="text-lg font-black text-slate-900 leading-tight">{brl(monthGoal.target)}</p>
                  <p className="text-[11px] text-slate-500">
                    Faturado: <span className="font-bold text-emerald-600">{brl(monthRevenue)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Atingido</p>
                  <p className="text-lg font-black text-[#A16207] leading-tight">
                    {progressPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </p>
                </div>
              </div>

              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#EA580C]" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Falta</p>
                  <p className="text-xs font-bold text-slate-900">{brl(Math.max(0, monthGoal.target - monthRevenue))}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Dias de funcionamento</p>
                  <p className="text-xs font-bold text-slate-900">{businessDays}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Meta diária base</p>
                  <p className="text-xs font-bold text-slate-900">{brl(dailyBase)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Ordens que compõem a meta */}
          <section className="space-y-2 min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Banknote className="w-4 h-4 text-[#EA580C]" />
              Faturamento que compõe a meta
            </p>

            <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
              {monthOrders.length === 0 ? (
                <div className="py-10 px-6 flex flex-col items-center justify-center text-center gap-1">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </span>
                  <p className="text-xs font-bold text-slate-900">Nenhuma OS neste mês ainda</p>
                  <p className="text-[11px] text-slate-500 max-w-[320px]">
                    Assim que uma OS for emitida, o valor dela entra aqui compondo a sua meta.
                  </p>
                </div>
              ) : (
                monthOrders.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.clientName}</p>
                      <p className="text-[10.5px] text-slate-500">
                        {getLocalDateKey(item.date).split('-').reverse().join('/')}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 shrink-0">{brl(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* History */}
          <section className="space-y-2 min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <History className="w-4 h-4 text-[#EA580C]" />
              Histórico de metas
            </p>

            <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
              {history.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-8">
                  Ainda não há meses anteriores com meta definida.
                </p>
              ) : (
                history.map(item => {
                  const pct = item.goal.target > 0 ? (item.revenue / item.goal.target) * 100 : 0;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 capitalize">{monthLabel(item.key)}</p>
                        <p className="text-[10.5px] text-slate-500">
                          Meta {brl(item.goal.target)} · Faturado {brl(item.revenue)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                          pct >= 100
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}

      {/* Configure modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <form
            onSubmit={saveGoal}
            role="dialog"
            aria-modal="true"
            aria-label="Configurar meta"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Meta de {monthLabel(currentMonth, 'short').split(' ')[0]}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Defina quanto você quer faturar no mês e em quais dias a empresa funciona.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Meta mensal</label>
              <div className="flex items-center min-h-[42px] bg-white border border-slate-200 rounded-xl px-3 focus-within:border-[#EA580C]">
                <span className="text-xs font-bold text-slate-500 mr-1.5">R$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={draftTarget || ''}
                  onChange={e => setDraftTarget(parseSafeNumber(e.target.value, { min: 0 }))}
                  placeholder="0,00"
                  className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden py-2"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Dias de funcionamento</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {WEEKDAY_CHIPS.map(chip => {
                  const isActive = draftWeekdays.includes(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() =>
                        setDraftWeekdays(prev =>
                          prev.includes(chip.id) ? prev.filter(day => day !== chip.id) : [...prev, chip.id]
                        )
                      }
                      className={`min-h-[34px] w-10 rounded-lg border text-[11px] font-bold transition ${
                        isActive
                          ? 'border-[#EA580C] bg-[#EA580C] text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 min-w-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-[11px] text-slate-600">Dias de funcionamento no mês</span>
                <span className="text-[11px] font-bold text-slate-900">{draftBusinessDays}</span>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-[11px] text-slate-600">Meta diária base</span>
                <span className="text-[11px] font-bold text-slate-900">
                  {draftBusinessDays > 0 && draftTarget > 0 ? brl(draftDailyBase) : '—'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[40px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
              >
                Salvar meta
              </button>
            </div>
          </form>
        </div>
      )}

      {state.enabled && monthGoal && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Progresso atualizado com as OS emitidas neste mês.
        </p>
      )}
    </div>
  );
};
