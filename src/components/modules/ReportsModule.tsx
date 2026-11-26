import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Download,
  DollarSign,
  Sparkles,
  Inbox,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Users,
  Percent,
  UserPlus,
  Repeat,
  UserX,
  CalendarDays,
  Hash,
  FileText,
  CheckCircle2,
  Wallet,
  ClipboardList,
  Printer
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateBR, getLocalDateKey } from '../../utils/dateUtils';
import { companyDisplayName } from '../../utils/company';
import { useBrandIdentity } from '../../core/brandIdentityEngine';
import { alertDialog } from '../../services/dialogService';
import type { Appointment } from '../../types';

type PeriodFilter = 'hoje' | 'ontem' | 'semana' | 'mes' | 'ano' | 'periodo';
type ReportTab = 'visao' | 'servicos' | 'conversoes' | 'clientes' | 'faturamento';
type ServiceSort = 'receita' | 'quantidade';
type BaseFilter = 'todos' | '0-29' | '30-59' | '60-89' | '90-179' | '180+' | 'sem';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'visao', label: 'Visão Geral' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'conversoes', label: 'Conversões' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'faturamento', label: 'Faturamento' }
];

const PERIODS: { id: PeriodFilter; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
  { id: 'periodo', label: 'Período' }
];

const BASE_FILTERS: { id: BaseFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: '0-29', label: '0-29 dias' },
  { id: '30-59', label: '30-59 dias' },
  { id: '60-89', label: '60-89 dias' },
  { id: '90-179', label: '90-179 dias' },
  { id: '180+', label: '180+ dias' },
  { id: 'sem', label: 'Sem atendimento pago' }
];

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

const dateBR = (iso?: string) => (iso ? getLocalDateKey(iso).split('-').reverse().join('/') : '—');
const dayTick = (dayKey: string) => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;

const bucketOf = (days: number | null): BaseFilter => {
  if (days === null) return 'sem';
  if (days <= 29) return '0-29';
  if (days <= 59) return '30-59';
  if (days <= 89) return '60-89';
  if (days <= 179) return '90-179';
  return '180+';
};

interface Range {
  start: string;
  end: string;
}

interface LocalQuote {
  id: string;
  createdAt: string;
  clientName: string;
  total: number;
  status: 'pendente' | 'aprovado' | 'recusado' | 'convertido';
}

const loadQuotes = (): LocalQuote[] => {
  try {
    const raw = localStorage.getItem('pk_detail_quotes_v1');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LocalQuote[]) : [];
  } catch {
    return [];
  }
};

interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
  valueClass: string;
  delta?: number | null;
  note?: string;
  detail?: string;
}

const KpiCard: React.FC<{ card: Kpi }> = ({ card }) => {
  const Icon = card.icon;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 min-w-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${card.iconClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <p className="text-[11px] font-semibold text-slate-500 truncate">{card.label}</p>
      </div>
      <p className={`text-[26px] leading-none font-black mt-3 truncate ${card.valueClass}`}>{card.value}</p>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 min-h-[14px]">
        {card.delta !== undefined &&
          (card.delta === null ? (
            <span>— vs período anterior</span>
          ) : (
            <>
              {card.delta >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
              )}
              <span>
                {card.delta >= 0 ? '+' : ''}
                {card.delta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% vs
                período anterior
              </span>
            </>
          ))}
        {card.note && <span className="font-semibold text-slate-500">{card.note}</span>}
        {card.detail && <span className="tabular-nums">{card.detail}</span>}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 flex flex-col items-center justify-center text-center">
    <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
      <Inbox className="w-4 h-4" />
    </span>
    <p className="text-[13px] font-extrabold text-slate-900">{title}</p>
    <p className="text-[11.5px] text-slate-500 mt-1 max-w-[360px] leading-relaxed">{description}</p>
  </div>
);

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, right, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
    <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13.5px] font-extrabold text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const Badge: React.FC<{ tone: 'green' | 'slate' | 'amber' | 'red'; children: React.ReactNode }> = ({
  tone,
  children
}) => {
  const tones: Record<string, string> = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-rose-100 bg-rose-50 text-rose-700'
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

export const ReportsModule: React.FC = () => {
  const { orders, clients, appointments, services, settings } = useApp();
  const brandIdentity = useBrandIdentity();
  const activeLogoUrl = brandIdentity.activeLogo?.assetUrl || null;

  const todayKey = getLocalDateKey(new Date().toISOString());
  const [period, setPeriod] = useState<PeriodFilter>('mes');
  const [monthCursor, setMonthCursor] = useState(todayKey.slice(0, 7));
  const [yearCursor, setYearCursor] = useState(Number(todayKey.slice(0, 4)));
  const [customRange, setCustomRange] = useState<Range>({
    start: todayKey.slice(0, 8) + '01',
    end: todayKey
  });
  const [tab, setTab] = useState<ReportTab>('visao');
  const [serviceSort, setServiceSort] = useState<ServiceSort>('receita');
  const [baseFilter, setBaseFilter] = useState<BaseFilter>('todos');

  const range = useMemo<Range>(() => {
    const base = new Date(`${todayKey}T12:00:00`);
    if (period === 'hoje') return { start: todayKey, end: todayKey };
    if (period === 'ontem') {
      const key = getLocalDateKey(shiftDays(base, -1).toISOString());
      return { start: key, end: key };
    }
    // Semana = últimos 7 dias (hoje + 6 dias anteriores).
    if (period === 'semana') return { start: getLocalDateKey(shiftDays(base, -6).toISOString()), end: todayKey };
    if (period === 'periodo') return customRange;
    if (period === 'ano') return { start: `${yearCursor}-01-01`, end: `${yearCursor}-12-31` };
    const lastDay = new Date(`${monthCursor}-01T12:00:00`);
    lastDay.setMonth(lastDay.getMonth() + 1);
    lastDay.setDate(0);
    return { start: `${monthCursor}-01`, end: getLocalDateKey(lastDay.toISOString()) };
  }, [period, todayKey, monthCursor, customRange, yearCursor]);

  const previousRange = useMemo<Range>(() => {
    const start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);
    if (period === 'mes') {
      const prev = addMonths(monthCursor, -1);
      const lastDay = new Date(`${prev}-01T12:00:00`);
      lastDay.setMonth(lastDay.getMonth() + 1);
      lastDay.setDate(0);
      return { start: `${prev}-01`, end: getLocalDateKey(lastDay.toISOString()) };
    }
    if (period === 'ano') {
      return { start: `${yearCursor - 1}-01-01`, end: `${yearCursor - 1}-12-31` };
    }
    const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return {
      start: getLocalDateKey(shiftDays(start, -span).toISOString()),
      end: getLocalDateKey(shiftDays(start, -1).toISOString())
    };
  }, [range, period, monthCursor, yearCursor]);

  const inRange = (iso: string | undefined, target: Range) => {
    if (!iso) return false;
    const key = getLocalDateKey(iso);
    return key >= target.start && key <= target.end;
  };

  const periodOrders = useMemo(
    () => orders.filter(o => o.status !== 'cancelado' && inRange(o.entryDateTime, range)),
    [orders, range]
  );

  const previousOrders = useMemo(
    () => orders.filter(o => o.status !== 'cancelado' && inRange(o.entryDateTime, previousRange)),
    [orders, previousRange]
  );

  const paidPeriodOrders = useMemo(
    () => periodOrders.filter(o => o.paymentStatus === 'pago'),
    [periodOrders]
  );

  const metricsOf = (list: typeof orders) => {
    const faturamento = list.reduce((sum, o) => sum + o.total, 0);
    const paidOrders = list.filter(o => o.paymentStatus === 'pago');
    // "Serviços realizados" = serviços de OS concluídas/entregues (serviço executado),
    // não de motos que apenas entraram no pátio.
    const servicesCount = list
      .filter(o => o.status === 'concluido' || o.status === 'entregue')
      .reduce((sum, o) => sum + o.services.length, 0);
    return {
      faturamento,
      paidOrders: paidOrders.length,
      // Ticket médio = faturamento ÷ todas as OS do período (pago ou não),
      // mesma regra usada em Finanças.
      ticket: list.length > 0 ? faturamento / list.length : 0,
      services: servicesCount
    };
  };

  /**
   * Recebimentos (regime de caixa): cada transação confirmada conta na data em que
   * foi paga, inclusive de OS abertas antes do período. OS antigas sem transação
   * detalhada entram pela data de entrada, como em Finanças.
   */
  const receiptTotalOf = (target: Range) =>
    orders.reduce((sum, order) => {
      if (order.status === 'cancelado') return sum;
      const transactions = order.paymentTransactions || [];
      if (transactions.length > 0) {
        return (
          sum +
          transactions
            .filter(tx => tx.status === 'confirmado' && inRange(tx.date, target))
            .reduce((txSum, tx) => txSum + tx.amount, 0)
        );
      }
      return sum + (order.amountPaid > 0 && inRange(order.entryDateTime, target) ? order.amountPaid : 0);
    }, 0);

  const received = receiptTotalOf(range);
  const previousReceived = receiptTotalOf(previousRange);

  const current = useMemo(() => metricsOf(periodOrders), [periodOrders]);
  const previous = useMemo(() => metricsOf(previousOrders), [previousOrders]);

  const deltaOf = (nowValue: number, prevValue: number) => {
    if (prevValue <= 0) return null;
    return ((nowValue - prevValue) / prevValue) * 100;
  };

  /* ------------------------------- Serviços ------------------------------- */
  const serviceRows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    paidPeriodOrders.forEach(order => {
      // A receita de cada serviço é proporcional ao valor real da OS,
      // para descontos/acréscimos não inflarem o total por preço de tabela.
      const priceSum = order.services.reduce((sum, service) => sum + service.price, 0);
      const factor = priceSum > 0 ? order.total / priceSum : 0;
      order.services.forEach(service => {
        const entry = map.get(service.serviceName) || { name: service.serviceName, count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += service.price * factor;
        map.set(service.serviceName, entry);
      });
    });
    return [...map.values()];
  }, [paidPeriodOrders]);

  const servicesDone = serviceRows.reduce((sum, item) => sum + item.count, 0);
  const servicesRevenue = serviceRows.reduce((sum, item) => sum + item.revenue, 0);
  const servicesTicket = servicesDone > 0 ? servicesRevenue / servicesDone : 0;
  const sortedServiceRows = useMemo(
    () =>
      [...serviceRows].sort((a, b) =>
        serviceSort === 'receita' ? b.revenue - a.revenue : b.count - a.count
      ),
    [serviceRows, serviceSort]
  );
  const serviceBarPeak = Math.max(
    1,
    ...serviceRows.map(item => (serviceSort === 'receita' ? item.revenue : item.count))
  );

  /* ------------------------------ Conversões ------------------------------ */
  // Recarrega ao trocar de aba/período para refletir orçamentos criados em outra tela.
  const quotes = useMemo(() => loadQuotes(), [tab, range.start, range.end]);
  const periodQuotes = useMemo(
    () => quotes.filter(quote => inRange(quote.createdAt, range)),
    [quotes, range]
  );
  const wonQuotes = periodQuotes.filter(q => q.status === 'aprovado' || q.status === 'convertido');
  const quotesConversion = periodQuotes.length > 0 ? (wonQuotes.length / periodQuotes.length) * 100 : 0;
  const quotesTotal = periodQuotes.reduce((sum, q) => sum + q.total, 0);
  const quotesWonTotal = wonQuotes.reduce((sum, q) => sum + q.total, 0);
  const quotesTicket = periodQuotes.length > 0 ? quotesTotal / periodQuotes.length : 0;

  const priceById = useMemo(() => new Map(services.map(s => [s.id, s.price])), [services]);
  const appointmentValue = (appointment: Appointment) =>
    appointment.serviceIds.reduce((sum, id) => sum + (priceById.get(id) ?? 0), 0);

  const periodAppointments = useMemo(
    () => appointments.filter(a => inRange(`${a.date}T12:00:00`, range)),
    [appointments, range]
  );
  const activeAppointments = periodAppointments.filter(a => a.status !== 'cancelado');
  // Cancelados não entram na taxa de conversão (nem no numerador nem no denominador).
  const convertedAppointments = activeAppointments.filter(
    a => Boolean(a.serviceOrderId) || a.status === 'concluido'
  );
  const appointmentsConversion =
    activeAppointments.length > 0 ? (convertedAppointments.length / activeAppointments.length) * 100 : 0;
  const appointmentsTotal = activeAppointments.reduce((sum, a) => sum + appointmentValue(a), 0);

  const [hoverCreationIndex, setHoverCreationIndex] = useState<number | null>(null);

  // No ano o gráfico agrega por mês (365 barras diárias seriam ilegíveis e pesadas).
  const isYearView = period === 'ano';
  const currentYear = Number(todayKey.slice(0, 4));

  const chartBuckets = useMemo(() => {
    if (period === 'ano') {
      const monthCount =
        yearCursor === currentYear ? Number(todayKey.slice(5, 7)) : yearCursor < currentYear ? 12 : 0;
      return Array.from({ length: monthCount }, (_, index) => {
        const month = index + 1;
        return {
          key: `${yearCursor}-${String(month).padStart(2, '0')}`,
          label: new Date(yearCursor, month - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'short' })
            .replace('.', '')
        };
      });
    }
    const start = new Date(`${range.start}T12:00:00`);
    const endRaw = new Date(`${range.end}T12:00:00`);
    const today = new Date(`${todayKey}T12:00:00`);
    const end = endRaw.getTime() > today.getTime() ? today : endRaw;
    const buckets: { key: string; label: string }[] = [];
    for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const key = getLocalDateKey(cursor.toISOString());
      buckets.push({ key, label: dayTick(key) });
    }
    return buckets;
  }, [period, range, todayKey, yearCursor, currentYear]);

  const bucketKeyOf = (iso: string) => (isYearView ? getLocalDateKey(iso).slice(0, 7) : getLocalDateKey(iso));

  const quotesByDay = useMemo(() => {
    const map = new Map<string, number>();
    periodQuotes.forEach(q => {
      const key = bucketKeyOf(q.createdAt);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [periodQuotes, isYearView]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    periodAppointments.forEach(a => {
      const key = isYearView ? a.date.slice(0, 7) : a.date;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [periodAppointments, isYearView]);

  const creationPeak = Math.max(
    1,
    ...chartBuckets.map(bucket => Math.max(quotesByDay.get(bucket.key) || 0, appointmentsByDay.get(bucket.key) || 0))
  );

  /* -------------------------------- Clientes ------------------------------- */
  const clientRows = useMemo(() => {
    const todayTime = new Date(`${todayKey}T12:00:00`).getTime();
    return clients
      .map(client => {
        const allPaid = orders.filter(
          o => o.clientId === client.id && o.paymentStatus === 'pago' && o.status !== 'cancelado'
        );
        const lastPaidOrder = [...allPaid]
          .sort((a, b) =>
            (b.deliveredDateTime || b.completedDateTime || b.entryDateTime).localeCompare(
              a.deliveredDateTime || a.completedDateTime || a.entryDateTime
            )
          )[0];
        const lastPaidKey = lastPaidOrder
          ? getLocalDateKey(
              lastPaidOrder.deliveredDateTime || lastPaidOrder.completedDateTime || lastPaidOrder.entryDateTime
            )
          : null;
        const daysSince = lastPaidKey
          ? Math.max(0, Math.floor((todayTime - new Date(`${lastPaidKey}T12:00:00`).getTime()) / 86400000))
          : null;
        const periodClientOrders = periodOrders.filter(o => o.clientId === client.id);
        return {
          id: client.id,
          name: client.name,
          lastPaidKey,
          daysSince,
          ordersInPeriod: periodClientOrders.length,
          totalInPeriod: periodClientOrders.reduce((sum, o) => sum + o.total, 0),
          paidInPeriod: periodClientOrders.filter(o => o.paymentStatus === 'pago').length,
          paidTotalInPeriod: periodClientOrders
            .filter(o => o.paymentStatus === 'pago')
            .reduce((sum, o) => sum + o.total, 0)
        };
      })
      .sort((a, b) => b.totalInPeriod - a.totalInPeriod || a.name.localeCompare(b.name));
  }, [clients, orders, periodOrders, todayKey]);

  const attendedClients = clientRows.filter(row => row.paidInPeriod > 0).length;
  const newClients = clients.filter(client => inRange(client.createdAt, range)).length;
  const recurringClients = clientRows.filter(row => row.paidInPeriod >= 2).length;
  const inactiveClients = clientRows.filter(row => row.daysSince !== null && row.daysSince > 90).length;
  const topClients = clientRows
    .filter(row => row.paidInPeriod > 0)
    .sort((a, b) => b.paidTotalInPeriod - a.paidTotalInPeriod)
    .slice(0, 5);

  const retentionBuckets = useMemo(() => {
    const buckets: { id: BaseFilter; label: string; count: number }[] = [
      { id: '0-29', label: '0-29', count: 0 },
      { id: '30-59', label: '30-59', count: 0 },
      { id: '60-89', label: '60-89', count: 0 },
      { id: '90-179', label: '90-179', count: 0 },
      { id: '180+', label: '180+', count: 0 }
    ];
    clientRows.forEach(row => {
      const bucket = bucketOf(row.daysSince);
      const target = buckets.find(b => b.id === bucket);
      if (target) target.count += 1;
    });
    return buckets;
  }, [clientRows]);

  const retentionPeak = Math.max(1, ...retentionBuckets.map(b => b.count));
  const filteredClientRows =
    baseFilter === 'todos'
      ? clientRows
      : clientRows.filter(row => bucketOf(row.daysSince) === baseFilter);

  /* ------------------------------ Faturamento ----------------------------- */
  // Melhor dia considera cada recebimento na data em que foi efetivamente pago.
  const bestDay = useMemo(() => {
    const map = new Map<string, number>();
    // Conta todo recebimento do período, inclusive de OS com pagamento parcial.
    orders.forEach(order => {
      if (order.status === 'cancelado') return;
      const transactions = order.paymentTransactions || [];
      if (transactions.length > 0) {
        transactions.forEach(tx => {
          if (tx.status !== 'confirmado') return;
          if (!inRange(tx.date, range)) return;
          const key = getLocalDateKey(tx.date);
          map.set(key, (map.get(key) || 0) + tx.amount);
        });
        return;
      }
      if (order.amountPaid > 0 && inRange(order.entryDateTime, range)) {
        const key = getLocalDateKey(order.entryDateTime);
        map.set(key, (map.get(key) || 0) + order.amountPaid);
      }
    });
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return entries[0] ?? null;
  }, [orders, range]);

  /**
   * Recebimentos por forma de pagamento: conta toda transação com data dentro do
   * período, mesmo de OS abertas antes dele. OS antigas sem transação detalhada
   * entram em "Não informado" para o total não ficar menor que o real.
   */
  const revenueByMethod = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(order => {
      if (order.status === 'cancelado') return;
      const transactions = order.paymentTransactions || [];
      if (transactions.length > 0) {
        transactions.forEach(tx => {
          if (tx.status !== 'confirmado') return;
          if (!inRange(tx.date, range)) return;
          map.set(tx.method, (map.get(tx.method) || 0) + tx.amount);
        });
      } else if (order.amountPaid > 0 && inRange(order.entryDateTime, range)) {
        map.set('nao_informado', (map.get('nao_informado') || 0) + order.amountPaid);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders, range]);

  const PAYMENT_METHOD_LABEL: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    credito: 'Crédito',
    debito: 'Débito',
    transferencia: 'Transferência',
    nao_informado: 'Não informado'
  };

  /* -------------------------------- Download ------------------------------- */
  const buildReportRows = (): string[][] => {
    const rows: string[][] = [];

    if (tab === 'visao') {
      rows.push(['Indicador', 'Valor']);
      rows.push(['Faturamento emitido (OS do período)', current.faturamento.toFixed(2)]);
      rows.push(['Recebido no período (caixa)', received.toFixed(2)]);
      rows.push(['OS pagas', String(current.paidOrders)]);
      rows.push(['Ticket médio', current.ticket.toFixed(2)]);
      rows.push(['Serviços realizados', String(current.services)]);
    } else if (tab === 'servicos') {
      rows.push(['Serviço', 'Quantidade', 'Receita']);
      sortedServiceRows.forEach(item => rows.push([item.name, String(item.count), item.revenue.toFixed(2)]));
    } else if (tab === 'conversoes') {
      rows.push(['Orçamentos do período']);
      rows.push(['Criado em', 'Cliente', 'Status', 'Valor']);
      periodQuotes.forEach(q =>
        rows.push([dateBR(q.createdAt), q.clientName, q.status, q.total.toFixed(2)])
      );
      rows.push([]);
      rows.push(['Agendamentos do período']);
      rows.push(['Criado em', 'Agendado', 'Cliente', 'Conversão', 'Valor']);
      periodAppointments.forEach(a =>
        rows.push([
          dateBR(a.requestedAt || `${a.date}T12:00:00`),
          dateBR(`${a.date}T12:00:00`),
          a.clientName,
          a.serviceOrderId || a.status === 'concluido' ? 'Convertido' : 'Não convertido',
          appointmentValue(a).toFixed(2)
        ])
      );
    } else if (tab === 'clientes') {
      rows.push(['Cliente', 'Última OS paga', 'Dias sem retornar', 'OS no período', 'Total no período']);
      filteredClientRows.forEach(row =>
        rows.push([
          row.name,
          row.lastPaidKey ? dateBR(`${row.lastPaidKey}T12:00:00`) : '—',
          row.daysSince === null ? '—' : String(row.daysSince),
          String(row.ordersInPeriod),
          row.totalInPeriod.toFixed(2)
        ])
      );
    } else {
      rows.push(['Forma de pagamento', 'Valor']);
      revenueByMethod.forEach(([method, amount]) =>
        rows.push([PAYMENT_METHOD_LABEL[method] ?? method, amount.toFixed(2)])
      );
    }

    return rows;
  };

  const reportDescription =
    period === 'mes'
      ? monthLabelOf(monthCursor)
      : period === 'ano'
        ? String(yearCursor)
        : period === 'semana'
          ? `${dateBR(range.start)} a ${dateBR(range.end)} (últimos 7 dias)`
          : period === 'periodo'
            ? `${dateBR(range.start)} a ${dateBR(range.end)}`
            : dateBR(range.start);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const handleDownloadPdf = async () => {
    // Abre a janela antes do fetch da logo para não perder o gesto do usuário.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      void alertDialog('Permita pop-ups para gerar o PDF do relatório.', { title: 'Pop-ups bloqueados' });
      return;
    }
    printWindow.document.write(
      '<!doctype html><meta charset="utf-8"><title>Gerando relatório…</title><body style="font-family:Arial,Helvetica,sans-serif;padding:24px;color:#475569">Preparando o relatório…</body>'
    );

    // Visão Geral vira um painel de indicadores no PDF; as demais abas usam tabelas.
    const rows = tab === 'visao' ? [] : buildReportRows();
    const blocks: string[] = [];
    let tableBuffer: string[] = [];
    let headerPending = true;
    let columnCount = 0;

    const flush = () => {
      if (!tableBuffer.length) return;
      // Tabela sem registros: mantém o cabeçalho e avisa o vazio no PDF.
      if (tableBuffer.length === 1 && columnCount > 0) {
        tableBuffer.push(`<tr class="empty"><td colspan="${columnCount}">Nenhum registro no período.</td></tr>`);
      }
      blocks.push(`<div class="table-wrap"><table>${tableBuffer.join('')}</tbody></table></div>`);
      tableBuffer = [];
    };

    rows.forEach(row => {
      if (row.length === 0) {
        flush();
        headerPending = true;
        return;
      }
      if (row.length === 1) {
        flush();
        blocks.push(`<h2>${escapeHtml(row[0])}</h2>`);
        headerPending = true;
        return;
      }
      const cells = row.map(cell => escapeHtml(String(cell)));
      if (headerPending) {
        columnCount = cells.length;
        tableBuffer.push(`<thead><tr>${cells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>`);
        headerPending = false;
      } else {
        tableBuffer.push(`<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`);
      }
    });
    flush();

    const tabLabel = TABS.find(item => item.id === tab)?.label ?? 'Relatório';
    // Nome do arquivo salvo: período legível em pt-BR, sem ISO e sem “/”.
    const filePeriod = `${dateBR(range.start)} a ${dateBR(range.end)}`.replace(/\//g, '-');
    const companyName = companyDisplayName(settings);
    // Monograma: sigla curta no primeiro nome ("PK DETAIL" → "PK") ou iniciais
    // das duas primeiras palavras ("Ricardo Santos" → "RS").
    const nameWords = companyName.split(/\s+/).filter(Boolean);
    const initials =
      (nameWords[0] && nameWords[0].length <= 3
        ? nameWords[0]
        : nameWords
            .slice(0, 2)
            .map(word => word[0])
            .join('')
      ).toUpperCase() || 'PK';
    const generatedAt = new Date().toLocaleString('pt-BR');

    // Logomarca real da empresa embutida como data URL (o pop-up imprime na hora,
    // então uma URL remota poderia sair em branco). Sem logo, mantém o monograma.
    let logoDataUrl: string | null = null;
    if (activeLogoUrl) {
      try {
        const response = await fetch(activeLogoUrl, { credentials: 'same-origin' });
        if (response.ok) {
          const blob = await response.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        logoDataUrl = null;
      }
    }

    const logoMarkup = logoDataUrl
      ? `<img class="logo-img" src="${logoDataUrl}" alt="Logomarca ${escapeHtml(companyName)}" />`
      : `<div class="logo">${escapeHtml(initials)}</div>`;

    const kpiTiles =
      tab === 'visao'
        ? `<section class="kpis">${[
            ['Faturamento emitido', brl(current.faturamento), 'OS emitidas no período'],
            ['Recebido no período', brl(received), 'Caixa, inclui OS antigas'],
            ['OS pagas', String(current.paidOrders), 'No período'],
            ['Ticket médio', current.ticket > 0 ? brl(current.ticket) : '—', 'Faturamento ÷ OS do período'],
            ['Serviços realizados', String(current.services), 'OS concluídas/entregues']
          ]
            .map(
              ([label, value, note], index) =>
                `<div class="kpi${index === 4 ? ' wide' : ''}"><span class="kpi-label">${escapeHtml(
                  label
                )}</span><span class="kpi-value">${escapeHtml(value)}</span><span class="kpi-note">${escapeHtml(
                  note
                )}</span></div>`
            )
            .join('')}</section>`
        : '';

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Relatório ${escapeHtml(tabLabel)} ${escapeHtml(filePeriod)}</title>
      <style>
        @page{size:A4 portrait;margin:12mm;}
        *{box-sizing:border-box;}
        html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#0f172a;margin:0;font-size:11px;}
        .topbar{height:4px;background:#EA580C;border-radius:2px;}
        header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 0 14px;border-bottom:1px solid #e2e8f0;}
        .brand{display:flex;gap:10px;align-items:center;min-width:0;}
        .logo{width:40px;height:40px;border-radius:11px;background:#EA580C;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .logo-img{height:46px;max-width:130px;object-fit:contain;display:block;flex-shrink:0;}
        .brand-name{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;font-weight:700;margin:0 0 3px;}
        h1{font-size:20px;line-height:1.15;margin:0;}
        .meta{font-size:10px;color:#64748b;margin:5px 0 0;}
        .period{display:inline-block;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:999px;padding:5px 11px;font-size:10px;font-weight:700;white-space:nowrap;}
        .kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 4px;}
        .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fbfcfe;break-inside:avoid;page-break-inside:avoid;}
        .kpi.wide{grid-column:1 / -1;}
        .kpi-label{display:block;font-size:8.5px;letter-spacing:.11em;text-transform:uppercase;color:#64748b;font-weight:700;}
        .kpi-value{display:block;font-size:18px;font-weight:800;margin-top:5px;color:#0f172a;}
        .kpi-note{display:block;font-size:9px;color:#94a3b8;margin-top:3px;}
        h2{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#334155;margin:20px 0 8px;padding-left:8px;border-left:3px solid #EA580C;line-height:1.2;}
        table{width:100%;border-collapse:collapse;font-size:10.5px;}
        thead th{background:#0f172a;color:#fff;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;text-align:left;font-weight:700;padding:7px 9px;}
        tbody td{padding:6px 9px;border-bottom:1px solid #eef2f7;color:#1e293b;font-variant-numeric:tabular-nums;}
        tbody tr:nth-child(even) td{background:#f8fafc;}
        th:last-child,td:last-child{text-align:right;}
        tr{break-inside:avoid;page-break-inside:avoid;}
        tr.empty td{color:#94a3b8;font-style:italic;text-align:left;background:#fff;}
        footer{margin-top:24px;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#94a3b8;}
        .table-wrap{width:100%;}
        /* Tela pequena (celular): cabeçalho quebra, indicadores em 1 coluna e
           tabelas com rolagem horizontal em vez de esmagar as colunas. */
        @media screen and (max-width:640px){
          body{padding:16px 14px 24px;}
          header{flex-wrap:wrap;gap:10px;padding:12px 0;}
          h1{font-size:17px;}
          .period{align-self:flex-start;}
          .kpis{grid-template-columns:1fr;}
          .kpi-value{font-size:16px;}
          /* Tabelas: fonte e espaçamento compactos para caber na largura do celular
             sem rolar; o overflow fica só como rede de segurança em telas < 360px. */
          .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
          table{font-size:10px;}
          thead th{padding:5px 4px;font-size:8px;letter-spacing:.04em;}
          tbody td{padding:5px 4px;}
          footer{flex-direction:column;gap:4px;}
        }
        @media print{
          body{padding:0;}
          .table-wrap{overflow:visible;}
          thead{display:table-header-group;}
        }
      </style></head><body>
      <div class="topbar"></div>
      <header>
        <div class="brand">
          ${logoMarkup}
          <div>
            <p class="brand-name">${escapeHtml(companyName)}</p>
            <h1>Relatório de ${escapeHtml(tabLabel)}</h1>
            <p class="meta">Gerado em ${escapeHtml(generatedAt)}</p>
          </div>
        </div>
        <span class="period">${escapeHtml(reportDescription)}</span>
      </header>
      ${kpiTiles}
      ${blocks.join('')}
      <footer><span>${escapeHtml(companyName)} · Relatórios</span><span>${escapeHtml(
        generatedAt
      )} · Documento gerado pelo PK Detail</span></footer>
      </body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadCsv = () => {
    const rows = buildReportRows();

    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${tab}-${range.start}-a-${range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* --------------------------------- KPI sets ------------------------------ */
  const kpiSets: Record<ReportTab, Kpi[]> = {
    visao: [
      {
        label: 'Faturamento emitido',
        value: brl(current.faturamento),
        icon: DollarSign,
        iconClass: 'bg-blue-50 text-blue-600',
        valueClass: 'text-[#1D4ED8]',
        delta: deltaOf(current.faturamento, previous.faturamento),
        note: 'OS emitidas no período',
        // Recebimentos de OS antigas não entram no faturamento emitido; exibe à parte
        // para o card não parecer zerado quando houve caixa no período.
        detail:
          received > 0 && Math.abs(received - current.faturamento) > 0.005
            ? `· Recebido ${brl(received)}`
            : undefined
      },
      {
        label: 'OS pagas',
        value: String(current.paidOrders),
        icon: ClipboardList,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: deltaOf(current.paidOrders, previous.paidOrders)
      },
      {
        label: 'Ticket médio',
        value: current.ticket > 0 ? brl(current.ticket) : '—',
        icon: Sparkles,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        delta: deltaOf(current.ticket, previous.ticket)
      },
      {
        label: 'Serviços realizados',
        value: String(current.services),
        icon: ClipboardList,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: deltaOf(current.services, previous.services)
      }
    ],
    servicos: [
      {
        label: 'Serviços realizados',
        value: String(servicesDone),
        icon: ClipboardList,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: null
      },
      {
        label: 'Receita de serviços',
        value: brl(servicesRevenue),
        icon: DollarSign,
        iconClass: 'bg-blue-50 text-blue-600',
        valueClass: 'text-[#1D4ED8]',
        delta: null
      },
      {
        label: 'Ticket médio por serviço',
        value: servicesDone > 0 ? brl(servicesTicket) : '—',
        icon: Sparkles,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        delta: null
      },
      {
        label: 'Serviços distintos',
        value: String(serviceRows.length),
        icon: Hash,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: null
      }
    ],
    conversoes: [
      {
        label: 'Orçamentos criados',
        value: String(periodQuotes.length),
        icon: FileText,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        note: periodQuotes.length > 0 ? 'Novo no período' : undefined,
        detail: undefined
      },
      {
        label: 'Conversão de orçamentos',
        value: `${quotesConversion.toFixed(1).replace('.', ',')}%`,
        icon: Percent,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        detail: `${wonQuotes.length} de ${periodQuotes.length}`
      },
      {
        label: 'Agendamentos criados',
        value: String(periodAppointments.length),
        icon: CalendarDays,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        note: periodAppointments.length > 0 ? 'Novo no período' : undefined
      },
      {
        label: 'Conversão de agendamentos',
        value: `${appointmentsConversion.toFixed(1).replace('.', ',')}%`,
        icon: CheckCircle2,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        detail: `${convertedAppointments.length} de ${activeAppointments.length}`
      }
    ],
    clientes: [
      {
        label: 'Clientes atendidos',
        value: String(attendedClients),
        icon: Users,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: null
      },
      {
        label: 'Clientes novos',
        value: String(newClients),
        icon: UserPlus,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        note: newClients > 0 ? 'Novo no período' : undefined
      },
      {
        label: 'Recorrentes (2+ OS pagas)',
        value: String(recurringClients),
        icon: Repeat,
        iconClass: 'bg-blue-50 text-blue-600',
        valueClass: 'text-slate-900',
        delta: null
      },
      {
        label: 'Inativos há 90+ dias',
        value: String(inactiveClients),
        icon: UserX,
        iconClass: 'bg-rose-50 text-rose-500',
        valueClass: 'text-rose-600',
        note: 'Oportunidade de reativação'
      }
    ],
    faturamento: [
      {
        label: 'Recebido no período',
        value: brl(received),
        icon: DollarSign,
        iconClass: 'bg-blue-50 text-blue-600',
        valueClass: 'text-[#1D4ED8]',
        delta: deltaOf(received, previousReceived)
      },
      {
        label: 'OS pagas',
        value: String(current.paidOrders),
        icon: ClipboardList,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        delta: deltaOf(current.paidOrders, previous.paidOrders)
      },
      {
        label: 'Ticket médio',
        value: current.ticket > 0 ? brl(current.ticket) : '—',
        icon: Sparkles,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-emerald-600',
        delta: deltaOf(current.ticket, previous.ticket)
      },
      {
        label: 'Melhor dia',
        value: bestDay ? dateBR(`${bestDay[0]}T12:00:00`).slice(0, 5) : '—',
        icon: CalendarDays,
        iconClass: 'bg-slate-100 text-slate-500',
        valueClass: 'text-slate-900',
        note: bestDay ? brl(bestDay[1]) : 'Sem faturamento no período'
      }
    ]
  };

  const periodLabel =
    period === 'mes'
      ? monthCursor.split('-').reverse().join('/')
      : period === 'ano'
        ? String(yearCursor)
        : period === 'semana'
          ? `${dateBR(range.start)} a ${dateBR(range.end)}`
          : dateBR(range.start);

  const headerRow = 'text-[9.5px] font-bold uppercase tracking-wider text-slate-400';
  const cellRow = 'text-[11.5px] text-slate-700';

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">Relatórios</h1>
          <p className="text-[11.5px] text-slate-500 mt-1.5">
            Analise serviços, conversões, clientes e faturamento da sua estética automotiva
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto sm:items-center sm:gap-0 sm:divide-x sm:divide-slate-100">
          {PERIODS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`min-h-[30px] w-full px-2 text-[11.5px] whitespace-nowrap rounded-lg transition sm:w-auto sm:px-3.5 ${
                period === item.id
                  ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                  : 'font-semibold text-slate-600 hover:bg-[#FFEDD5]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === 'mes' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMonthCursor(prev => addMonths(prev, -1))}
              aria-label="Mês anterior"
              className="w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1.5 rounded-lg border border-[#C2410C] bg-[#EA580C] text-[11.5px] font-extrabold whitespace-nowrap text-white">
              {monthLabelOf(monthCursor)}
            </span>
            <button
              type="button"
              onClick={() => setMonthCursor(prev => addMonths(prev, 1))}
              aria-label="Próximo mês"
              className="w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {period === 'ano' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setYearCursor(prev => prev - 1)}
              aria-label="Ano anterior"
              className="w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1.5 rounded-lg border border-[#C2410C] bg-[#EA580C] text-[11.5px] font-extrabold whitespace-nowrap text-white tabular-nums">
              {yearCursor}
            </span>
            <button
              type="button"
              onClick={() => setYearCursor(prev => prev + 1)}
              aria-label="Próximo ano"
              className="w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {period === 'periodo' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="date"
              value={customRange.start}
              onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value || prev.start }))}
              aria-label="Início do período"
              className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
            />
            <span className="text-[11px] text-slate-400">até</span>
            <input
              type="date"
              value={customRange.end}
              onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value || prev.end }))}
              aria-label="Fim do período"
              className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto sm:items-center sm:gap-0 sm:divide-x sm:divide-slate-100">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[30px] w-full px-2 text-[11.5px] font-bold whitespace-nowrap rounded-lg transition sm:w-auto sm:px-4 ${
              tab === item.id
                ? 'bg-[#EA580C] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-[#FFEDD5]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Period label / sort toggle + download */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {tab === 'servicos' ? (
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 gap-1">
            {([
              { id: 'receita' as ServiceSort, label: 'Por receita' },
              { id: 'quantidade' as ServiceSort, label: 'Por quantidade' }
            ]).map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setServiceSort(option.id)}
                className={`min-h-[28px] px-3 rounded-lg text-[11px] whitespace-nowrap transition ${
                  serviceSort === option.id
                    ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                    : 'font-semibold text-slate-600 hover:bg-[#FFEDD5]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] font-semibold text-slate-500 tabular-nums">{periodLabel}</p>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="min-h-[32px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition"
            title="Baixar planilha CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="min-h-[32px] px-3 rounded-lg border border-[#C2410C] bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-bold flex items-center gap-1.5 transition"
            title="Abre a caixa de impressão do navegador: escolha “Salvar como PDF” para baixar o arquivo A4"
            aria-label="Imprimir relatório ou salvar como PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0 pk-stagger">
        {kpiSets[tab].map(card => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* ------------------------------ Visão Geral ----------------------------- */}
      {tab === 'visao' &&
        (periodOrders.length === 0 && received === 0 ? (
          <EmptyState
            title="Sem dados no período"
            description="Nenhuma ordem de serviço ou recebimento registrado neste período. Ajuste o filtro para visualizar os indicadores."
          />
        ) : (
          <SectionCard title="Resumo do período" subtitle="Recebimentos, ordens, agendamentos e cancelamentos.">
            <div className="px-4 pb-2">
              {[
                {
                  label: 'Recebido no período',
                  value: brl(received),
                  tone: received > 0 ? 'text-[#1D4ED8]' : 'text-slate-900'
                },
                { label: 'Ordens de serviço', value: String(periodOrders.length), tone: 'text-slate-900' },
                {
                  label: 'Agendamentos',
                  value: String(periodAppointments.length),
                  tone: 'text-slate-900'
                },
                {
                  label: 'Agendamentos cancelados',
                  value: String(periodAppointments.filter(a => a.status === 'cancelado').length),
                  tone: 'text-rose-600'
                }
              ].map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                >
                  <span className="text-[11.5px] text-slate-600">{row.label}</span>
                  <span className={`text-[12px] font-extrabold tabular-nums ${row.tone}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}

      {/* -------------------------------- Serviços ------------------------------ */}
      {tab === 'servicos' &&
        (serviceRows.length === 0 ? (
          <EmptyState
            title="Sem dados no período"
            description="Nenhum serviço vinculado a OS pagas neste período."
          />
        ) : (
          <SectionCard
            title="Serviços do período"
            subtitle={`Ordenado por ${serviceSort === 'receita' ? 'receita' : 'quantidade'}.`}
            right={<span className="text-[11px] font-mono font-bold text-emerald-600">{brl(servicesRevenue)}</span>}
          >
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className={`${headerRow} px-4 py-2`}>Serviço</th>
                    <th className={`${headerRow} px-4 py-2 text-right`}>Qtd.</th>
                    <th className={`${headerRow} px-4 py-2 text-right`}>Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedServiceRows.map(item => {
                    const width =
                      ((serviceSort === 'receita' ? item.revenue : item.count) / serviceBarPeak) * 100;
                    return (
                      <tr key={item.name}>
                        <td className="px-4 py-2.5">
                          <p className="text-[11.5px] font-bold text-slate-800 truncate">{item.name}</p>
                          <div className="mt-1.5 h-1 w-40 max-w-full rounded-full bg-slate-100 overflow-hidden">
                            <span
                              className="block h-full rounded-full bg-[#EA580C]"
                              style={{ width: `${Math.max(3, width)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[11.5px] font-semibold text-slate-600 tabular-nums">
                          {item.count}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[11.5px] font-mono font-bold text-slate-900">
                          {brl(item.revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))}

      {/* ------------------------------- Conversões ----------------------------- */}
      {tab === 'conversoes' && (
        <div className="flex flex-col gap-3 min-w-0">
          <SectionCard
            title={isYearView ? 'Criações por mês' : 'Criações por dia'}
            subtitle={
              isYearView
                ? 'Orçamentos e agendamentos criados em cada mês do período.'
                : 'Orçamentos e agendamentos criados em cada dia do período.'
            }
          >
            <div className="px-4 pt-1 flex items-center gap-4">
              <LegendDot color="#7C3AED" label="Orçamentos" />
              <LegendDot color="#0D9488" label="Agendamentos" />
            </div>
            <div className="px-4 pb-4 pt-3">
              {chartBuckets.length === 0 ? (
                <p className="text-[11.5px] text-slate-400 py-6 text-center">Período sem dados para exibir.</p>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <div style={{ minWidth: Math.max(chartBuckets.length * 30, 300) }}>
                    <div className="relative h-[180px]" onPointerLeave={event => event.pointerType === 'mouse' && setHoverCreationIndex(null)}>
                      {[0, 25, 50, 75, 100].map(position => (
                        <span
                          key={position}
                          className="absolute left-0 right-0 border-t border-dashed border-slate-200"
                          style={{ top: `${position}%` }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-end gap-1">
                        {chartBuckets.map((bucket, index) => {
                          const quoteCount = quotesByDay.get(bucket.key) || 0;
                          const appointmentCount = appointmentsByDay.get(bucket.key) || 0;
                          const isActive = hoverCreationIndex === index;
                          return (
                            <div
                              key={bucket.key}
                              role="presentation"
                              onPointerEnter={() => setHoverCreationIndex(index)}
                              onPointerDown={() => setHoverCreationIndex(index)}
                              className={`flex-1 min-w-[26px] h-full flex items-end justify-center gap-[3px] rounded-md transition-colors ${
                                isActive ? 'bg-slate-100/80' : ''
                              }`}
                            >
                              {quoteCount > 0 && (
                                <span
                                  className={`w-[40%] max-w-[11px] rounded-t-[2px] bg-[#7C3AED] transition-opacity ${
                                    hoverCreationIndex === null || isActive ? 'opacity-100' : 'opacity-45'
                                  }`}
                                  style={{ height: `${Math.max(4, (quoteCount / creationPeak) * 100)}%` }}
                                />
                              )}
                              {appointmentCount > 0 && (
                                <span
                                  className={`w-[40%] max-w-[11px] rounded-t-[2px] bg-[#0D9488] transition-opacity ${
                                    hoverCreationIndex === null || isActive ? 'opacity-100' : 'opacity-45'
                                  }`}
                                  style={{ height: `${Math.max(4, (appointmentCount / creationPeak) * 100)}%` }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {hoverCreationIndex !== null && chartBuckets[hoverCreationIndex] && (
                        <div
                          className="pointer-events-none absolute top-0 z-20"
                          style={{
                            left: `${Math.min(86, Math.max(14, ((hoverCreationIndex + 0.5) / chartBuckets.length) * 100))}%`,
                            transform: 'translateX(-50%)',
                          }}
                        >
                          <div className="rounded-xl border border-slate-200 bg-white shadow-lg px-2.5 py-1.5 min-w-[140px]">
                            <p className="text-[10px] font-extrabold text-slate-900">
                              {isYearView
                                ? monthLabelOf(chartBuckets[hoverCreationIndex].key)
                                : formatDateBR(chartBuckets[hoverCreationIndex].key)}
                            </p>
                            <div className="mt-0.5 space-y-0.5 text-[10px] tabular-nums">
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1 text-slate-500">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" /> Orçamentos
                                </span>
                                <span className="font-bold text-slate-900">
                                  {quotesByDay.get(chartBuckets[hoverCreationIndex].key) || 0}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1 text-slate-500">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" /> Agendamentos
                                </span>
                                <span className="font-bold text-slate-900">
                                  {appointmentsByDay.get(chartBuckets[hoverCreationIndex].key) || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1.5 border-t border-slate-100 pt-1.5">
                      {chartBuckets.map(bucket => (
                        <span
                          key={bucket.key}
                          className="flex-1 min-w-[26px] text-center text-[8.5px] text-slate-400 tabular-nums whitespace-nowrap"
                        >
                          {bucket.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
            <SectionCard
              title="Valores em orçamentos"
              subtitle="Comparativo entre o total orçado e o que virou OS."
            >
              <div className="px-4 pb-2">
                {[
                  { label: 'Total orçado', value: brl(quotesTotal) },
                  { label: 'Convertido em OS', value: brl(quotesWonTotal) },
                  { label: 'Ticket médio do orçamento', value: brl(quotesTicket) },
                  { label: 'Total em agendamentos', value: brl(appointmentsTotal) }
                ].map(row => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                  >
                    <span className="text-[11.5px] text-slate-600">{row.label}</span>
                    <span className="text-[11.5px] font-mono font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Orçamentos do período"
              subtitle={`${periodQuotes.length} registro${periodQuotes.length === 1 ? '' : 's'}`}
            >
              {periodQuotes.length === 0 ? (
                <p className="px-4 py-8 text-center text-[11.5px] text-slate-400">
                  Nenhum orçamento criado neste período.
                </p>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full min-w-[460px] text-left">
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/60">
                        <th className={`${headerRow} px-4 py-2`}>Criado em</th>
                        <th className={`${headerRow} px-4 py-2`}>Cliente</th>
                        <th className={`${headerRow} px-4 py-2`}>Status</th>
                        <th className={`${headerRow} px-4 py-2 text-right`}>Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodQuotes.map(quote => (
                        <tr key={quote.id}>
                          <td className={`${cellRow} px-4 py-2.5 tabular-nums whitespace-nowrap`}>
                            {dateBR(quote.createdAt)}
                          </td>
                          <td className={`${cellRow} px-4 py-2.5 font-semibold text-slate-800 truncate`}>
                            {quote.clientName}
                          </td>
                          <td className="px-4 py-2.5">
                            {quote.status === 'convertido' ? (
                              <Badge tone="green">Em OS</Badge>
                            ) : quote.status === 'aprovado' ? (
                              <Badge tone="green">Aprovado</Badge>
                            ) : quote.status === 'recusado' ? (
                              <Badge tone="red">Recusado</Badge>
                            ) : (
                              <Badge tone="amber">Pendente</Badge>
                            )}
                          </td>
                          <td className={`${cellRow} px-4 py-2.5 text-right font-mono font-bold text-slate-900`}>
                            {brl(quote.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Agendamentos do período"
            subtitle={`${periodAppointments.length} registro${periodAppointments.length === 1 ? '' : 's'}`}
          >
            {periodAppointments.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11.5px] text-slate-400">
                Nenhum agendamento neste período.
              </p>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60">
                      <th className={`${headerRow} px-4 py-2`}>Criado em</th>
                      <th className={`${headerRow} px-4 py-2`}>Agendado</th>
                      <th className={`${headerRow} px-4 py-2`}>Cliente</th>
                      <th className={`${headerRow} px-4 py-2`}>Conversão</th>
                      <th className={`${headerRow} px-4 py-2 text-right`}>Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodAppointments.map(appointment => {
                      const converted =
                        Boolean(appointment.serviceOrderId) || appointment.status === 'concluido';
                      return (
                        <tr key={appointment.id}>
                          <td className={`${cellRow} px-4 py-2.5 tabular-nums whitespace-nowrap`}>
                            {dateBR(appointment.requestedAt || `${appointment.date}T12:00:00`)}
                          </td>
                          <td className={`${cellRow} px-4 py-2.5 tabular-nums whitespace-nowrap`}>
                            {dateBR(`${appointment.date}T12:00:00`)}
                          </td>
                          <td className={`${cellRow} px-4 py-2.5 font-semibold text-slate-800 truncate`}>
                            {appointment.clientName}
                          </td>
                          <td className="px-4 py-2.5">
                            {appointment.status === 'cancelado' ? (
                              <Badge tone="red">Cancelado</Badge>
                            ) : converted ? (
                              <Badge tone="green">Convertido</Badge>
                            ) : (
                              <Badge tone="slate">Não convertido</Badge>
                            )}
                          </td>
                          <td className={`${cellRow} px-4 py-2.5 text-right font-mono font-bold text-slate-900`}>
                            {brl(appointmentValue(appointment))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* -------------------------------- Clientes ------------------------------ */}
      {tab === 'clientes' && (
        <div className="flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
            <SectionCard title="Tempo sem retornar" subtitle="Distribuição da base pela última OS paga.">
              <div className="px-4 pb-4 pt-2">
                <div className="h-[170px] flex items-end gap-2">
                  {retentionBuckets.map(bucket => (
                    <div key={bucket.id} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                        {bucket.count > 0 ? bucket.count : ''}
                      </span>
                      <span
                        className="w-full max-w-[52px] rounded-t-[3px] bg-[#EA580C]"
                        style={{ height: `${Math.max(2, (bucket.count / retentionPeak) * 100)}%` }}
                        title={`${bucket.label} dias · ${bucket.count} cliente(s)`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2 border-t border-slate-100 pt-1.5">
                  {retentionBuckets.map(bucket => (
                    <span
                      key={bucket.id}
                      className="flex-1 text-center text-[9.5px] text-slate-400 tabular-nums"
                    >
                      {bucket.label}
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Top clientes por faturamento" subtitle="Base: OS pagas dentro do período.">
              {topClients.length === 0 ? (
                <p className="px-4 py-16 text-center text-[11.5px] text-slate-400">
                  Nenhuma OS paga no período.
                </p>
              ) : (
                <div className="px-4 pb-2">
                  {topClients.map((row, index) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-[11.5px] font-semibold text-slate-800 truncate flex-1">
                        {row.name}
                      </span>
                      <span className="text-[11.5px] text-slate-500 tabular-nums shrink-0">
                        {row.paidInPeriod} OS
                      </span>
                      <span className="text-[11.5px] font-mono font-bold text-slate-900 shrink-0">
                        {brl(row.paidTotalInPeriod)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Base de clientes"
            subtitle={`${filteredClientRows.length} de ${clientRows.length} cliente${
              clientRows.length === 1 ? '' : 's'
            }`}
          >
            <div className="px-4 pt-3 pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {BASE_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setBaseFilter(filter.id)}
                  className={`min-h-[28px] px-3 rounded-full text-[10.5px] whitespace-nowrap transition ${
                    baseFilter === filter.id
                      ? 'bg-[#EA580C] text-white font-extrabold shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-[#FFEDD5]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {filteredClientRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-[11.5px] text-slate-400">
                Nenhum cliente neste filtro.
              </p>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60">
                      <th className={`${headerRow} px-4 py-2`}>Cliente</th>
                      <th className={`${headerRow} px-4 py-2`}>Última OS paga</th>
                      <th className={`${headerRow} px-4 py-2`}>Dias sem retornar</th>
                      <th className={`${headerRow} px-4 py-2 text-right`}>OS no período</th>
                      <th className={`${headerRow} px-4 py-2 text-right`}>Total no período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClientRows.map(row => (
                      <tr key={row.id}>
                        <td className={`${cellRow} px-4 py-2.5 font-semibold text-slate-800 truncate`}>
                          {row.name}
                        </td>
                        <td className={`${cellRow} px-4 py-2.5 tabular-nums whitespace-nowrap`}>
                          {row.lastPaidKey ? dateBR(`${row.lastPaidKey}T12:00:00`) : '—'}
                        </td>
                        <td className={`${cellRow} px-4 py-2.5 tabular-nums`}>
                          {row.daysSince === null ? '—' : row.daysSince}
                        </td>
                        <td className={`${cellRow} px-4 py-2.5 text-right tabular-nums`}>
                          {row.ordersInPeriod}
                        </td>
                        <td className={`${cellRow} px-4 py-2.5 text-right font-mono font-bold text-slate-900`}>
                          {brl(row.totalInPeriod)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ------------------------------ Faturamento ---------------------------- */}
      {tab === 'faturamento' &&
        (revenueByMethod.length === 0 ? (
          <EmptyState
            title="Sem dados no período"
            description="Nenhum recebimento registrado neste período."
          />
        ) : (
          <div className="flex flex-col gap-3 min-w-0">
            {(
              <SectionCard
                title="Recebimentos por forma de pagamento"
                subtitle="Somente transações registradas dentro do período."
                right={
                  <span className="text-[11.5px] font-mono font-bold text-[#1D4ED8]">
                    {brl(revenueByMethod.reduce((sum, [, amount]) => sum + amount, 0))}
                  </span>
                }
              >
                <div className="px-4 pb-3">
                  {revenueByMethod.map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <span className="text-[11.5px] font-semibold text-slate-700 capitalize flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-slate-400" />
                        {PAYMENT_METHOD_LABEL[method] ?? method}
                      </span>
                      <span className="text-[11.5px] font-mono font-bold text-slate-900">{brl(amount)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        ))}
    </div>
  );
};
