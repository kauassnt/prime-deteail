import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Receipt,
  Calculator,
  Hourglass,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  SlidersHorizontal,
  Plus,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod } from '../../types';
import { formatDateBR, getLocalDateKey } from '../../utils/dateUtils';
import { parseSafeNumber, preventInvalidNumericKeys } from '../../utils/inputValidation';
import { confirmDialog } from '../../services/dialogService';

type PeriodFilter = 'hoje' | 'ontem' | '7dias' | 'mes' | 'periodo';
type TabId = 'lucro' | 'faturamento' | 'despesas';

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const brlCompact = (value: number) =>
  value >= 1000
    ? `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
    : `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Produtos',
  'Materiais',
  'Equipamentos',
  'Água',
  'Energia',
  'Aluguel',
  'Internet',
  'Manutenção',
  'Funcionários',
  'Marketing',
  'Outros',
];

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  credito: 'Crédito',
  debito: 'Débito',
  transferencia: 'Transferência',
};

const shiftDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const addMonths = (monthKey: string, delta: number) => {
  const d = new Date(`${monthKey}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelOf = (monthKey: string) => {
  const d = new Date(`${monthKey}-01T12:00:00`);
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${month} ${d.getFullYear()}`;
};

interface Range {
  start: string;
  end: string;
}

export const FinancialModule: React.FC = () => {
  const { orders, expenses, settings, createExpense, payExpense, deleteExpense } = useApp();
  const commissionsEnabled = settings.commissionsEnabled !== false;

  const todayKey = getLocalDateKey(new Date().toISOString());
  const [period, setPeriod] = useState<PeriodFilter>('mes');
  const [monthCursor, setMonthCursor] = useState(todayKey.slice(0, 7));
  const [customRange, setCustomRange] = useState<Range>({ start: todayKey.slice(0, 8) + '01', end: todayKey });
  const [tab, setTab] = useState<TabId>('lucro');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'todas' | ExpenseCategory>('todas');

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Produtos');
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(todayKey);
  const [isPaid, setIsPaid] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [formError, setFormError] = useState('');

  const range = useMemo<Range>(() => {
    const base = new Date(`${todayKey}T12:00:00`);
    if (period === 'hoje') return { start: todayKey, end: todayKey };
    if (period === 'ontem') {
      const key = getLocalDateKey(shiftDays(base, -1).toISOString());
      return { start: key, end: key };
    }
    if (period === '7dias') {
      return { start: getLocalDateKey(shiftDays(base, -6).toISOString()), end: todayKey };
    }
    if (period === 'periodo') return customRange;
    const first = `${monthCursor}-01`;
    const lastDay = new Date(`${monthCursor}-01T12:00:00`);
    lastDay.setMonth(lastDay.getMonth() + 1);
    lastDay.setDate(0);
    return { start: first, end: getLocalDateKey(lastDay.toISOString()) };
  }, [period, todayKey, monthCursor, customRange]);

  const previousRange = useMemo<Range>(() => {
    const start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);
    if (period === 'mes') {
      const prevMonth = addMonths(monthCursor, -1);
      const lastDay = new Date(`${prevMonth}-01T12:00:00`);
      lastDay.setMonth(lastDay.getMonth() + 1);
      lastDay.setDate(0);
      return { start: `${prevMonth}-01`, end: getLocalDateKey(lastDay.toISOString()) };
    }
    const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return {
      start: getLocalDateKey(shiftDays(start, -span).toISOString()),
      end: getLocalDateKey(shiftDays(start, -1).toISOString()),
    };
  }, [range, period, monthCursor]);

  const inRange = (iso: string | undefined, target: Range) => {
    if (!iso) return false;
    const key = getLocalDateKey(iso);
    return key >= target.start && key <= target.end;
  };

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'cancelado'), [orders]);

  /**
   * Recebimentos do período (regime de caixa): cada transação conta na data em que
   * foi paga, mesmo de OS abertas antes do período. OS antigas sem transação
   * detalhada entram pela data de entrada, para o total não ficar menor que o real.
   */
  const receiptsOf = (target: Range) => {
    const list: {
      id: string;
      orderId: string;
      date: string;
      clientName: string;
      plate: string;
      amount: number;
      method: PaymentMethod | 'nao_informado';
    }[] = [];
    activeOrders.forEach(order => {
      if (order.paymentTransactions?.length) {
        order.paymentTransactions.forEach(tx => {
          // Estornos não são receita: só pagamentos confirmados entram no caixa.
          if (tx.status !== 'confirmado') return;
          if (inRange(tx.date, target)) {
            list.push({
              id: tx.id,
              orderId: order.id,
              date: tx.date,
              clientName: order.clientName,
              plate: order.motorcyclePlate,
              amount: tx.amount,
              method: tx.method,
            });
          }
        });
      } else if (order.amountPaid > 0 && inRange(order.entryDateTime, target)) {
        list.push({
          id: `fallback_${order.id}`,
          orderId: order.id,
          date: order.entryDateTime,
          clientName: order.clientName,
          plate: order.motorcyclePlate,
          amount: order.amountPaid,
          method: 'nao_informado',
        });
      }
    });
    return list;
  };

  /**
   * Comissões entram no lucro quando a OS é quitada (regime de caixa),
   * na data do último pagamento confirmado.
   */
  const commissionEntriesOf = (target: Range) => {
    if (!commissionsEnabled) return [];
    return activeOrders.flatMap(order => {
      const amount = order.commissionAmount || 0;
      if (amount <= 0) return [];
      const confirmed = (order.paymentTransactions || []).filter(tx => tx.status === 'confirmado');
      const received = confirmed.reduce((sum, tx) => sum + tx.amount, 0);
      const settled = order.total > 0 && (order.paymentStatus === 'pago' || received >= order.total - 0.005);
      if (!settled) return [];
      const lastPayment = confirmed
        .map(tx => tx.date)
        .sort()
        .at(-1);
      const date = lastPayment || order.entryDateTime;
      if (!inRange(date, target)) return [];
      return [{ id: `com_${order.id}`, date, amount, employeeName: order.assignedEmployeeName, order }];
    });
  };

  const totalsOf = (target: Range) => {
    const periodOrders = activeOrders.filter(o => inRange(o.entryDateTime, target));
    const periodOrderIds = new Set(periodOrders.map(o => o.id));
    // Faturamento = valor das OS emitidas no período.
    const faturamento = periodOrders.reduce((sum, o) => sum + o.total, 0);
    // Recebido = dinheiro que realmente entrou no período (regime de caixa).
    const receipts = receiptsOf(target);
    const recebido = receipts.reduce((sum, tx) => sum + tx.amount, 0);
    const recebidoDasOsDoPeriodo = receipts
      .filter(tx => periodOrderIds.has(tx.orderId))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const recebidoDeOsAnteriores = recebido - recebidoDasOsDoPeriodo;
    // Lucro é caixa: só despesas efetivamente pagas saem do resultado.
    const periodExpenses = expenses.filter(e => inRange(e.paymentDate || e.dueDate, target));
    const despesas = periodExpenses
      .filter(e => e.status === 'pago')
      .reduce((sum, e) => sum + e.amount, 0);
    const despesasPendentes = periodExpenses
      .filter(e => e.status !== 'pago')
      .reduce((sum, e) => sum + e.amount, 0);
    const comissoes = commissionEntriesOf(target).reduce((sum, entry) => sum + entry.amount, 0);
    const lucro = recebido - despesas - comissoes;
    const margem = recebido > 0 ? (lucro / recebido) * 100 : 0;
    const paidCount = periodOrders.filter(o => (o.pendingBalance ?? 0) <= 0).length;
    const receivable = periodOrders.reduce((sum, o) => sum + Math.max(0, o.pendingBalance ?? 0), 0);
    const ticket = periodOrders.length > 0 ? faturamento / periodOrders.length : 0;
    return {
      faturamento,
      recebido,
      recebidoDasOsDoPeriodo,
      recebidoDeOsAnteriores,
      despesas,
      despesasPendentes,
      comissoes,
      lucro,
      margem,
      ordersCount: periodOrders.length,
      paidCount,
      receivable,
      ticket,
    };
  };

  const current = useMemo(() => totalsOf(range), [activeOrders, expenses, range, commissionsEnabled]);
  const previous = useMemo(() => totalsOf(previousRange), [activeOrders, expenses, previousRange, commissionsEnabled]);

  // Chart: one point per day of the selected range (max 31 points)
  const chartSeries = useMemo(() => {
    const start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);
    // Série cobre TODO o período selecionado (antes era cortada em 31 dias).
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

    // Recebimentos por dia (mesma regra do total: data do pagamento).
    const receiptsByDay = new Map<string, number>();
    receiptsOf(range).forEach(tx => {
      const key = getLocalDateKey(tx.date);
      receiptsByDay.set(key, (receiptsByDay.get(key) || 0) + tx.amount);
    });
    const commissionsByDay = new Map<string, number>();
    commissionEntriesOf(range).forEach(entry => {
      const key = getLocalDateKey(entry.date);
      commissionsByDay.set(key, (commissionsByDay.get(key) || 0) + entry.amount);
    });

    const points: {
      key: string;
      label: string;
      faturamento: number;
      recebido: number;
      despesas: number;
      comissoes: number;
      lucro: number;
      ordersCount: number;
    }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const day = shiftDays(start, i);
      const key = getLocalDateKey(day.toISOString());
      const dayOrders = activeOrders.filter(o => getLocalDateKey(o.entryDateTime) === key);
      const faturamento = dayOrders.reduce((sum, o) => sum + o.total, 0);
      const recebido = receiptsByDay.get(key) || 0;
      const despesas = expenses
        .filter(e => e.status === 'pago' && getLocalDateKey(e.paymentDate || e.dueDate) === key)
        .reduce((sum, e) => sum + e.amount, 0);
      const comissoes = commissionsByDay.get(key) || 0;
      points.push({
        key,
        label: key.slice(8, 10),
        faturamento,
        recebido,
        despesas,
        comissoes,
        lucro: recebido - despesas - comissoes,
        ordersCount: dayOrders.length,
      });
    }
    return points;
  }, [activeOrders, expenses, range, commissionsEnabled]);

  const chartValueOf = (point: (typeof chartSeries)[number]) =>
    tab === 'despesas' ? point.despesas : tab === 'lucro' ? point.lucro : point.faturamento;

  // Escala com suporte a valores negativos (dias de prejuízo no gráfico de lucro).
  const chartScale = useMemo(() => {
    const values = chartSeries.map(chartValueOf);
    const rawMax = Math.max(0, ...values);
    const rawMin = Math.min(0, ...values);
    const max = rawMax > 0 ? rawMax * 1.15 : 1;
    const min = rawMin < 0 ? rawMin * 1.15 : 0;
    return { max, min, span: Math.max(1e-6, max - min) };
  }, [chartSeries, tab]);

  const chartYTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio =>
    chartScale.max - ratio * (chartScale.max - chartScale.min)
  );

  const chartX = (index: number) =>
    chartSeries.length <= 1 ? 50 : (index / (chartSeries.length - 1)) * 100;
  const chartY = (point: (typeof chartSeries)[number]) =>
    100 - ((chartValueOf(point) - chartScale.min) / chartScale.span) * 100;
  const chartZeroY = 100 - ((0 - chartScale.min) / chartScale.span) * 100;

  const chartPoints = chartSeries.map((point, index) => `${chartX(index)},${chartY(point)}`).join(' ');

  const hoverPoint = hoverIndex !== null ? chartSeries[hoverIndex] : null;

  const chartSummary = useMemo(() => {
    const total = chartSeries.reduce((sum, point) => sum + chartValueOf(point), 0);
    const best = chartSeries.reduce(
      (acc, point) => (chartValueOf(point) > chartValueOf(acc) ? point : acc),
      chartSeries[0] ?? { key: '', faturamento: 0, recebido: 0, despesas: 0, comissoes: 0, lucro: 0, label: '', ordersCount: 0 }
    );
    return {
      total,
      average: chartSeries.length > 0 ? total / chartSeries.length : 0,
      best,
      bestValue: chartSeries.length > 0 ? chartValueOf(best) : 0,
    };
  }, [chartSeries, tab]);

  // Rótulos do eixo X sem poluir: no máximo 6 datas, sempre incluindo a última.
  const chartLabelIndexes = useMemo(() => {
    const total = chartSeries.length;
    if (total <= 1) return [0];
    const step = Math.max(1, Math.ceil(total / 6));
    const indexes: number[] = [];
    for (let i = 0; i < total; i += step) indexes.push(i);
    if (indexes[indexes.length - 1] !== total - 1) indexes.push(total - 1);
    return indexes;
  }, [chartSeries.length]);

  const handleChartPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (chartSeries.length - 1));
    setHoverIndex(Math.min(chartSeries.length - 1, Math.max(0, index)));
  };

  const chartTone =
    tab === 'despesas'
      ? { stroke: '#EF4444', dot: 'bg-red-500', label: 'Despesas', title: 'Resumo das Despesas', subtitle: 'Despesas por dia no período' }
      : tab === 'lucro'
        ? { stroke: '#10B981', dot: 'bg-emerald-500', label: 'Lucro', title: 'Resumo do Lucro', subtitle: 'Lucro por dia no período' }
        : { stroke: '#3B82F6', dot: 'bg-blue-500', label: 'Faturamento', title: 'Resumo do Faturamento', subtitle: 'Faturamento por dia no período' };

  const transactions = useMemo(
    () => receiptsOf(range).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [activeOrders, range]
  );

  const periodExpenses = useMemo(
    () =>
      expenses
        .filter(e => inRange(e.paymentDate || e.dueDate, range))
        .sort((a, b) =>
          getLocalDateKey(b.paymentDate || b.dueDate).localeCompare(getLocalDateKey(a.paymentDate || a.dueDate))
        ),
    [expenses, range]
  );

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setFormError('Informe a descrição da despesa.');
      return;
    }
    if (!(amount > 0)) {
      setFormError('Informe um valor maior que zero.');
      return;
    }
    createExpense({
      description: description.trim(),
      category,
      amount,
      dueDate,
      paymentDate: isPaid ? dueDate : undefined,
      paymentMethod: isPaid ? paymentMethod : undefined,
      status: isPaid ? 'pago' : 'pendente',
      notes: '',
    });
    setShowExpenseModal(false);
    setDescription('');
    setAmount(0);
    setFormError('');
  };

  const pctLine = (nowValue: number, prevValue: number) => {
    if (prevValue <= 0) return '— vs período anterior';
    const pct = ((nowValue - prevValue) / prevValue) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}% vs período anterior`;
  };

  const filteredExpenses = useMemo(
    () => periodExpenses.filter(expense => categoryFilter === 'todas' || expense.category === categoryFilter),
    [periodExpenses, categoryFilter]
  );

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    // Só despesas pagas, para bater com o total e com o lucro do período.
    filteredExpenses
      .filter(expense => expense.status === 'pago')
      .forEach(expense => {
        map.set(expense.category, (map.get(expense.category) || 0) + expense.amount);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const expensesTotalByCategory = expensesByCategory.reduce((sum, [, value]) => sum + value, 0);

  const chartCard = (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">{chartTone.title}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{chartTone.subtitle}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 shrink-0">
          <span className={`w-2 h-2 rounded-full ${chartTone.dot}`} /> {chartTone.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 border border-slate-200/70 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="text-[11.5px] font-extrabold text-slate-900 tabular-nums truncate">{brl(chartSummary.total)}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Média/dia</p>
          <p className="text-[11.5px] font-extrabold text-slate-900 tabular-nums truncate">{brl(chartSummary.average)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Melhor dia</p>
          <p className="text-[11.5px] font-extrabold text-slate-900 tabular-nums truncate">
            {chartSummary.best.key ? brl(chartSummary.bestValue) : '—'}
            {chartSummary.best.key && (
              <span className="ml-1 text-[9.5px] font-semibold text-slate-500">{formatDateBR(chartSummary.best.key)}</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 min-w-0">
        <div className="flex flex-col justify-between py-0.5 w-9 shrink-0 text-right text-[9.5px] text-slate-400 tabular-nums">
          {chartYTicks.map(value => (
            <span key={value}>{brlCompact(value)}</span>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative h-[200px]" onPointerLeave={event => event.pointerType === 'mouse' && setHoverIndex(null)}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
              role="img"
              aria-label={`${chartTone.title}${hoverPoint ? `: ${formatDateBR(hoverPoint.key)}, ${brl(chartValueOf(hoverPoint))}` : ''}`}
            >
              <defs>
                <linearGradient id={`pkChartFill-${tab}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTone.stroke} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={chartTone.stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map(y => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#EEF2F6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              ))}
              {chartScale.min < 0 && (
                <line
                  x1="0"
                  y1={chartZeroY}
                  x2="100"
                  y2={chartZeroY}
                  stroke="#CBD5E1"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <polygon
                points={`0,${chartZeroY} ${chartPoints} 100,${chartZeroY}`}
                fill={`url(#pkChartFill-${tab})`}
              />
              <polyline
                points={chartPoints}
                fill="none"
                stroke={chartTone.stroke}
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {/* Guia vertical do ponto em foco */}
            {hoverIndex !== null && hoverPoint && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed"
                style={{ left: `${chartX(hoverIndex)}%`, borderColor: chartTone.stroke, opacity: 0.55 }}
              />
            )}

            {/* Ponto destacado */}
            {hoverIndex !== null && hoverPoint && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow-md"
                style={{
                  left: `${chartX(hoverIndex)}%`,
                  top: `${chartY(hoverPoint)}%`,
                  background: chartTone.stroke,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}

            {/* Área de captura do mouse e do dedo */}
            <div
              className="absolute inset-0 cursor-crosshair touch-pan-y"
              role="presentation"
              onPointerMove={handleChartPointer}
              onPointerDown={handleChartPointer}
              onPointerEnter={handleChartPointer}
            />

            {/* Cartão de detalhes */}
            {hoverIndex !== null && hoverPoint && (
              <div
                className="pointer-events-none absolute top-1 z-20"
                style={{ left: `${Math.min(86, Math.max(14, chartX(hoverIndex)))}%`, transform: 'translateX(-50%)' }}
              >
                <div className="rounded-xl border border-slate-200 bg-white/98 shadow-lg px-2.5 py-2 min-w-[142px] backdrop-blur-sm">
                  <p className="text-[10px] font-extrabold text-slate-900">{formatDateBR(hoverPoint.key)}</p>
                  <div className="mt-1 space-y-0.5 text-[10px] tabular-nums">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Faturamento
                      </span>
                      <span className="font-bold text-slate-900">{brl(hoverPoint.faturamento)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Recebido
                      </span>
                      <span className="font-bold text-slate-900">{brl(hoverPoint.recebido)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Despesas
                      </span>
                      <span className="font-bold text-slate-900">{brl(hoverPoint.despesas)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-0.5">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" /> Lucro
                      </span>
                      <span className={`font-extrabold ${hoverPoint.lucro < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {brl(hoverPoint.lucro)}
                      </span>
                    </div>
                    <p className="pt-0.5 text-[9.5px] font-semibold text-slate-400">
                      {hoverPoint.ordersCount} {hoverPoint.ordersCount === 1 ? 'ordem' : 'ordens'} no dia
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative h-3 mt-1.5">
            {chartLabelIndexes.map(index => (
              <span
                key={chartSeries[index].key}
                className="absolute -translate-x-1/2 text-[9px] text-slate-400 tabular-nums whitespace-nowrap"
                style={{ left: `${chartX(index)}%` }}
              >
                {chartSeries[index].label}/{chartSeries[index].key.slice(5, 7)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-slate-400 sm:hidden">Toque no gráfico para ver os detalhes do dia.</p>
    </section>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Finanças</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Acompanhe o faturamento, despesas e lucro da sua estética automotiva
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <div className="flex w-full sm:w-auto items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 min-w-0 max-w-full">
          {([
            { id: 'hoje' as PeriodFilter, label: 'Hoje' },
            { id: 'ontem' as PeriodFilter, label: 'Ontem' },
            { id: '7dias' as PeriodFilter, label: '7 Dias' },
            { id: 'mes' as PeriodFilter, label: 'Mês' },
            { id: 'periodo' as PeriodFilter, label: 'Período' },
          ]).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`h-9 flex-1 sm:flex-none px-1.5 sm:px-3.5 rounded-lg text-[11px] sm:text-xs whitespace-nowrap transition ${
                period === item.id
                  ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                  : 'text-slate-600 font-semibold hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === 'mes' ? (
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shrink-0">
            <button
              type="button"
              onClick={() => setMonthCursor(prev => addMonths(prev, -1))}
              aria-label="Mês anterior"
              className="w-8 h-9 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="h-9 min-w-[104px] px-3 rounded-lg bg-[#EA580C] text-white text-xs font-extrabold capitalize flex items-center justify-center whitespace-nowrap">
              {monthLabelOf(monthCursor)}
            </span>
            <button
              type="button"
              onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
              aria-label="Próximo mês"
              className="w-8 h-9 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : period === 'periodo' ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="date"
              value={customRange.start}
              onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value || prev.start }))}
              aria-label="Início do período"
              className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
            />
            <span className="text-[11px] text-slate-400">até</span>
            <input
              type="date"
              value={customRange.end}
              onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value || prev.end }))}
              aria-label="Fim do período"
              className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
            />
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="inline-flex w-full sm:w-auto self-start items-center rounded-xl border border-slate-200 bg-white p-1">
        {([
          { id: 'lucro' as TabId, label: 'Lucro' },
          { id: 'faturamento' as TabId, label: 'Faturamento' },
          { id: 'despesas' as TabId, label: 'Despesas' },
        ]).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 sm:flex-none h-9 px-5 rounded-lg text-xs whitespace-nowrap transition ${
              tab === item.id
                ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                : 'text-slate-600 font-semibold hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Faturamento summary */}
      {tab === 'faturamento' && (
        <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-w-0 pk-stagger">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col min-w-0">
              <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Faturado</p>
              <p className="mt-1.5 text-[30px] leading-none font-black text-blue-600 tabular-nums break-words">
                {brl(current.faturamento)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 truncate">
                {pctLine(current.faturamento, previous.faturamento)}
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">OS Pagas</p>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 leading-none tabular-nums">{current.paidCount}</p>
                <p className="mt-1.5 text-[10.5px] text-slate-400 truncate">
                  {pctLine(current.paidCount, previous.paidCount)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Calculator className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Ticket Médio</p>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 leading-none tabular-nums break-words">
                  {current.ticket > 0 ? brl(current.ticket) : '—'}
                </p>
                <p className="mt-1.5 text-[10.5px] text-slate-400 truncate">
                  {pctLine(current.ticket, previous.ticket)}
                </p>
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Hourglass className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">A Receber</p>
                </div>
                <p className="mt-2 text-xl font-black text-slate-900 leading-none tabular-nums break-words">
                  {brl(current.receivable)}
                </p>
              </div>
            </div>
          </div>

          {chartCard}
        </div>
      )}

      {/* Despesas summary */}
      {tab === 'despesas' && (
        <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as 'todas' | ExpenseCategory)}
                aria-label="Filtrar por categoria"
                className="appearance-none w-full sm:w-[220px] h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
              >
                <option value="todas">Todas as categorias</option>
                {EXPENSE_CATEGORIES.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => setCategoryFilter('todas')}
              aria-label="Limpar filtro de categoria"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0 transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setDescription('');
                setAmount(0);
                setDueDate(todayKey);
                setIsPaid(true);
                setFormError('');
                setShowExpenseModal(true);
              }}
              className="ml-auto min-h-[40px] px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs shrink-0 transition"
            >
              <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
              <span>Nova Despesa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-w-0 pk-stagger">
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col min-w-0 min-h-[240px]">
              <span className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </span>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Despesas pagas</p>
              <p className="mt-1.5 text-[30px] leading-none font-black text-rose-600 tabular-nums break-words">
                {brl(current.despesas)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 truncate">{pctLine(current.despesas, previous.despesas)}</p>
              {current.despesasPendentes > 0.005 && (
                <p className="mt-1 text-[10.5px] font-semibold text-amber-600">
                  + {brl(current.despesasPendentes)} ainda a pagar
                </p>
              )}
            </div>

            <div className="lg:col-span-8 min-w-0">{chartCard}</div>
          </div>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 min-w-0 lg:max-w-[620px]">
            <h2 className="text-sm font-extrabold text-slate-900">Despesas por Categoria</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Distribuição das despesas pagas no período</p>

            {expensesByCategory.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-12 px-4 text-center">
                <p className="text-xs font-semibold text-slate-500">Nenhuma despesa paga no período</p>
                <p className="text-[11px] text-slate-400 mt-1">Pagamentos pendentes não entram nesta distribuição</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {expensesByCategory.map(([name, value]) => {
                  const pct = expensesTotalByCategory > 0 ? (value / expensesTotalByCategory) * 100 : 0;
                  return (
                    <div key={name} className="min-w-0">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-slate-600 truncate">{name}</span>
                        <span className="font-mono font-bold text-slate-900 shrink-0">{brl(value)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Lucro summary */}
      {tab === 'lucro' && (
        <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-w-0 pk-stagger">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col min-w-0">
              <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </span>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Lucro Líquido</p>
              <p
                className={`mt-1.5 text-[30px] leading-none font-black tabular-nums break-words ${
                  current.lucro < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {brl(current.lucro)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 truncate">{pctLine(current.lucro, previous.lucro)}</p>
              <p className="mt-1 text-[10.5px] text-slate-400">Recebido − despesas pagas − comissões.</p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Faturamento</p>
                </div>
                <p className="mt-2 text-xl font-black text-slate-900 leading-none tabular-nums break-words">
                  {brl(current.faturamento)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Recebido</p>
                </div>
                <p className="mt-2 text-xl font-black text-emerald-700 leading-none tabular-nums break-words">
                  {brl(current.recebido)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Despesas pagas</p>
                </div>
                <p className="mt-2 text-xl font-black text-slate-900 leading-none tabular-nums break-words">
                  {brl(current.despesas)}
                </p>
                {current.despesasPendentes > 0.005 && (
                  <p className="mt-1 text-[10px] text-slate-400 font-semibold">
                    + {brl(current.despesasPendentes)} a pagar (fora do lucro)
                  </p>
                )}
                {current.comissoes > 0 && (
                  <p className="mt-1 text-[10px] text-amber-600 font-semibold">
                    + {brl(current.comissoes)} de comissões
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Calculator className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Margem de Lucro</p>
                </div>
                <p className="mt-2 text-xl font-black text-slate-900 leading-none tabular-nums">
                  {current.recebido > 0 ? `${current.margem.toFixed(1).replace('.', ',')}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          {chartCard}
        </div>
      )}

      {/* Tab content */}
      {tab === 'lucro' && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">Demonstrativo do período</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Faturamento = OS emitidas no período · Recebido = pagamentos confirmados · Lucro = recebido − despesas pagas − comissões.
          </p>

          <div className="mt-3">
            {[
              { label: 'Faturamento bruto (OS do período)', value: current.faturamento, className: 'text-blue-600' },
              {
                label: 'A receber (saldo das OS do período)',
                value: current.receivable > 0.005 ? -current.receivable : 0,
                className: 'text-amber-600',
              },
              {
                label: 'Recebido das OS do período',
                value: current.recebidoDasOsDoPeriodo,
                className: 'text-emerald-700',
              },
              ...(current.recebidoDeOsAnteriores > 0.005
                ? [
                    {
                      label: 'Recebimentos de OS anteriores',
                      value: current.recebidoDeOsAnteriores,
                      className: 'text-emerald-700',
                    },
                  ]
                : []),
              { label: 'Recebido no período (caixa)', value: current.recebido, className: 'text-emerald-700' },
              {
                label: 'Despesas pagas',
                value: current.despesas > 0.005 ? -current.despesas : 0,
                className: 'text-rose-600',
              },
              ...(current.despesasPendentes > 0.005
                ? [
                    {
                      label: 'Despesas a pagar (não descontadas)',
                      value: current.despesasPendentes,
                      className: 'text-slate-400',
                    },
                  ]
                : []),
              {
                label: 'Comissões (OS quitadas)',
                value: current.comissoes > 0.005 ? -current.comissoes : 0,
                className: 'text-amber-600',
              },
              {
                label: 'Lucro líquido',
                value: current.lucro,
                className: current.lucro < 0 ? 'text-rose-600' : 'text-emerald-600',
              },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0 py-2.5">
                <span className="text-xs text-slate-600">{row.label}</span>
                <span className={`text-xs font-bold font-mono tabular-nums ${row.className}`}>{brl(row.value)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ordens no período</span>
            <span className="text-xs font-bold text-slate-900 tabular-nums">{current.ordersCount}</span>
          </div>
        </section>
      )}

      {tab === 'faturamento' && (
        <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden min-w-0">
          <div className="px-5 py-4">
            <h2 className="text-sm font-extrabold text-slate-900">Últimos Lançamentos</h2>
          </div>

          {transactions.length === 0 ? (
            <p className="px-5 pb-12 pt-2 text-center text-xs text-slate-400">Nenhuma receita no período.</p>
          ) : (
            <div className="border-t border-slate-100">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-b-0 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{tx.clientName}</p>
                    <p className="text-[10.5px] text-slate-500 truncate">
                      {tx.plate} · {PAYMENT_LABEL[tx.method as PaymentMethod] ?? 'Não informado'} ·{' '}
                      {getLocalDateKey(tx.date).split('-').reverse().join('/')}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 shrink-0 tabular-nums">{brl(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'despesas' && (
        <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden min-w-0">
          <div className="px-5 py-4">
            <h2 className="text-sm font-extrabold text-slate-900">Últimos Lançamentos</h2>
          </div>

          {filteredExpenses.length === 0 ? (
            <p className="px-5 pb-12 pt-2 text-center text-xs text-slate-400">Nenhuma despesa no período.</p>
          ) : (
            <div className="border-t border-slate-100">
              {filteredExpenses.map((expense: Expense) => (
                <div key={expense.id} className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 last:border-b-0 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{expense.description}</p>
                    <p className="text-[10.5px] text-slate-500 truncate">
                      {expense.category} · {getLocalDateKey(expense.paymentDate || expense.dueDate).split('-').reverse().join('/')}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600 shrink-0 tabular-nums">{brl(expense.amount)}</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                      expense.status === 'pago'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {expense.status === 'pago' ? 'Pago' : 'Pendente'}
                  </span>
                  {expense.status === 'pendente' && (
                    <button
                      type="button"
                      onClick={() => payExpense(expense.id, 'pix')}
                      aria-label={`Marcar ${expense.description} como paga`}
                      className="shrink-0 w-8 h-8 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirmDialog(
                        `Excluir a despesa "${expense.description}"? Esta ação não pode ser desfeita.`,
                        {
                          title: 'Excluir despesa',
                          confirmLabel: 'Excluir',
                          cancelLabel: 'Manter',
                          tone: 'danger'
                        }
                      );
                      if (confirmed) deleteExpense(expense.id);
                    }}
                    aria-label={`Excluir ${expense.description}`}
                    className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* New expense modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <form
            onSubmit={handleCreateExpense}
            role="dialog"
            aria-modal="true"
            aria-label="Nova despesa"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-black text-slate-900">Nova despesa</h2>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Descrição</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex.: Compra de shampoo"
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                >
                  {EXPENSE_CATEGORIES.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Valor</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount || ''}
                  onChange={e => setAmount(parseSafeNumber(e.target.value, { min: 0 }))}
                  onKeyDown={e => preventInvalidNumericKeys(e, true)}
                  placeholder="0,00"
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Forma de pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  disabled={!isPaid}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden disabled:opacity-50"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={e => setIsPaid(e.target.checked)}
                className="w-4 h-4 accent-[#EA580C]"
              />
              <span>Despesa já paga</span>
            </label>

            {formError && (
              <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
