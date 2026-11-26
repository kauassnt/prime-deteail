import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  MessageCircle,
  CalendarDays,
  LayoutGrid,
  List,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { Client } from '../../types';
import { formatDateBR, getLocalDateKey, parseLocalDate } from '../../utils/dateUtils';
import { buildWhatsappLink } from '../../utils/whatsappUtils';

type RangeFilter = 'todos' | '30' | '60' | '90';
type Priority = 'alta' | 'media' | 'baixa';

const RANGE_OPTIONS: { id: RangeFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: '30', label: '30+' },
  { id: '60', label: '60+' },
  { id: '90', label: '90+' },
];

const PRIORITY_LABEL: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

const PRIORITY_PILL: Record<Priority, string> = {
  alta: 'bg-rose-50 text-rose-700 border-rose-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baixa: 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * Diferença em dias de calendário entre a data informada e a data de referência.
 * Usa UTC apenas para contar dias, evitando erros de horário de verão e de fuso.
 * Retorna null quando não existe uma data válida.
 */
const daysBetween = (iso: string | undefined, reference: Date): number | null => {
  if (!iso) return null;
  const key = getLocalDateKey(iso);
  if (!key || key.length !== 10) return null;
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return null;
  const target = Date.UTC(year, month - 1, day);
  const ref = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate());
  if (Number.isNaN(target) || Number.isNaN(ref)) return null;
  return Math.max(0, Math.round((ref - target) / 86400000));
};

const latestDateKey = (...dates: (string | undefined)[]): string | undefined => {
  let latest: string | undefined;
  dates.forEach(date => {
    if (!date) return;
    const key = getLocalDateKey(date);
    if (!key || key.length !== 10) return;
    if (!latest || key > latest) latest = key;
  });
  return latest;
};

const priorityOf = (days: number | null): Priority =>
  days === null ? 'baixa' : days >= 90 ? 'alta' : days >= 60 ? 'media' : 'baixa';

export const AfterSalesModule: React.FC = () => {
  const { clients, motorcycles, orders, setActiveModule } = useApp();

  const [tab, setTab] = useState<'oportunidades' | 'todos'>('oportunidades');

  // Oportunidades
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeFilter>('todos');
  const [priority, setPriority] = useState<'todas' | Priority>('todas');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyReachable, setOnlyReachable] = useState(false);

  // Todos
  const [allSearch, setAllSearch] = useState('');
  const [allRange, setAllRange] = useState<'todas' | '30' | '60' | '90'>('todas');
  const [referenceDate, setReferenceDate] = useState('');
  const [allSort, setAllSort] = useState<'recentes' | 'antigos'>('recentes');
  const [allView, setAllView] = useState<'grid' | 'list'>('grid');

  // Data de referência do cálculo (padrão: hoje).
  const reference = useMemo(() => (referenceDate ? parseLocalDate(referenceDate) : new Date()), [referenceDate]);

  // Última OS realmente concluída/entregue de cada cliente (fonte da verdade do último atendimento).
  const lastServiceByClient = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(order => {
      if (order.status !== 'concluido' && order.status !== 'entregue') return;
      if (!order.clientId) return;
      const key = latestDateKey(order.deliveredDateTime, order.completedDateTime, order.entryDateTime);
      if (!key) return;
      const previous = map.get(order.clientId);
      if (!previous || key > previous) map.set(order.clientId, key);
    });
    return map;
  }, [orders]);

  const clientsWithDays = useMemo(
    () =>
      clients.map(client => {
        const visitDate = latestDateKey(client.lastVisitDate, lastServiceByClient.get(client.id));
        return {
          client,
          visitDate,
          days: daysBetween(visitDate, reference),
          moto: motorcycles.find(m => m.clientId === client.id),
        };
      }),
    [clients, motorcycles, lastServiceByClient, reference]
  );

  const opportunities = useMemo(
    () => clientsWithDays.filter(item => item.days !== null && item.days >= 30),
    [clientsWithDays]
  );

  const stats = useMemo(
    () => ({
      total: opportunities.length,
      d30: opportunities.filter(item => (item.days ?? 0) >= 30 && (item.days ?? 0) < 60).length,
      d60: opportunities.filter(item => (item.days ?? 0) >= 60 && (item.days ?? 0) < 90).length,
      d90: opportunities.filter(item => (item.days ?? 0) >= 90).length,
    }),
    [opportunities]
  );

  const filteredOpportunities = useMemo(() => {
    const q = search.toLowerCase().trim();
    return opportunities
      .filter(item => {
        const matchesSearch =
          !q ||
          item.client.name.toLowerCase().includes(q) ||
          item.client.phone.toLowerCase().includes(q) ||
          (item.moto?.plate || '').toLowerCase().includes(q);
        const days = item.days ?? 0;
        const matchesRange =
          range === 'todos' ? true : range === '30' ? days >= 30 : days >= Number(range);
        const matchesPriority = priority === 'todas' || priorityOf(item.days) === priority;
        const matchesReachable = !onlyReachable || Boolean((item.client.whatsapp || item.client.phone).replace(/\D/g, ''));
        return matchesSearch && matchesRange && matchesPriority && matchesReachable;
      })
      .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  }, [opportunities, search, range, priority, onlyReachable]);

  const allClients = useMemo(() => {
    const q = allSearch.toLowerCase().trim();
    const list = clientsWithDays.filter(item => {
      const matchesSearch =
        !q ||
        item.client.name.toLowerCase().includes(q) ||
        item.client.phone.toLowerCase().includes(q) ||
        (item.moto?.plate || '').toLowerCase().includes(q);
      const matchesRange = allRange === 'todas' ? true : (item.days ?? 0) >= Number(allRange);
      return matchesSearch && matchesRange;
    });

    return [...list].sort((a, b) => {
      const aKey = a.visitDate || '';
      const bKey = b.visitDate || '';
      if (allSort === 'recentes') return bKey.localeCompare(aKey);
      return aKey.localeCompare(bKey);
    });
  }, [clientsWithDays, allSearch, allRange, allSort]);

  const openWhatsapp = (client: Client) => {
    const link = buildWhatsappLink(
      client.whatsapp || client.phone,
      `Olá ${client.name.split(' ')[0]}! Sentimos sua falta na ${'PK Detail'}. Que tal agendar um novo cuidado para a sua moto?`
    );
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Pós-Venda</h1>
          <p className="text-xs text-slate-500 mt-1.5">Acompanhe e fidelize seus clientes após o atendimento</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {([
          { id: 'oportunidades' as const, label: 'Oportunidades' },
          { id: 'todos' as const, label: 'Todos' },
        ]).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[34px] px-4 rounded-lg text-xs font-bold transition ${
              tab === item.id
                ? 'bg-[#EA580C] text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* OPPORTUNITIES */}
      {tab === 'oportunidades' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
            <div className="rounded-xl border border-[#EA580C] bg-[#FFEDD5] px-3.5 py-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#9A3412]">Clientes em Pós-Venda</p>
              <p className="text-2xl font-black text-slate-900 leading-tight">{stats.total}</p>
              <p className="text-[10px] text-[#9A3412]">Total na base de Pós-Venda</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                30+ dias
              </p>
              <p className="text-2xl font-black text-slate-900 leading-tight">{stats.d30}</p>
              <p className="text-[10px] text-slate-400">Prontos para contato</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                60+ dias
              </p>
              <p className="text-2xl font-black text-slate-900 leading-tight">{stats.d60}</p>
              <p className="text-[10px] text-slate-400">Merecem retomada</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                90+ dias
              </p>
              <p className="text-2xl font-black text-slate-900 leading-tight">{stats.d90}</p>
              <p className="text-[10px] text-slate-400">Prioridade de reativação</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2.5 space-y-2">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente, serviço ou placa..."
                  className="w-full min-h-[38px] bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0 bg-slate-50 rounded-lg p-0.5">
                {RANGE_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRange(option.id)}
                    className={`min-h-[32px] px-3 rounded-md text-[11px] font-bold transition ${
                      range === option.id ? 'bg-[#EA580C] text-white' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'todas' | Priority)}
                aria-label="Filtrar por prioridade"
                className="shrink-0 min-h-[38px] bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
              >
                <option value="todas">Prioridade</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>

              <button
                type="button"
                onClick={() => setShowFilters(prev => !prev)}
                aria-pressed={showFilters}
                className={`shrink-0 min-h-[38px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition ${
                  showFilters
                    ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtros</span>
              </button>
            </div>

            {showFilters && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[11px] text-slate-600">Mostrar apenas clientes com telefone válido</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onlyReachable}
                  aria-label="Mostrar apenas clientes com telefone válido"
                  onClick={() => setOnlyReachable(prev => !prev)}
                  className={`shrink-0 w-10 h-[22px] rounded-full transition relative ${onlyReachable ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${onlyReachable ? 'left-[20px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
            )}
          </div>

          {filteredOpportunities.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-16 px-6 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-extrabold text-slate-900">🤷 Tudo em dia por aqui</p>
              <p className="text-xs text-slate-500 mt-1">
                Não encontramos clientes que precisem de contato neste momento
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {filteredOpportunities.map(({ client, days, visitDate, moto }) => (
                <article
                  key={client.id}
                  className="relative bg-white rounded-xl border border-slate-200/80 shadow-xs pl-3 pr-3.5 py-3 space-y-2 min-w-0 overflow-hidden"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{client.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{client.phone}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${PRIORITY_PILL[priorityOf(days)]}`}
                    >
                      {PRIORITY_LABEL[priorityOf(days)]}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    {moto ? `${moto.model} · ${moto.plate}` : 'Sem veículo cadastrado'}
                  </p>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {days === null ? 'Sem atendimento registrado' : `${days} dias sem retorno`}
                      {visitDate ? ` · ${formatDateBR(visitDate)}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openWhatsapp(client)}
                      className="flex-1 min-h-[32px] rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('clientes')}
                      className="flex-1 min-h-[32px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                    >
                      <span>Ver cadastro</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* ALL CLIENTS */}
      {tab === 'todos' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2.5 space-y-2">
            <p className="flex items-center gap-2 px-1 text-sm font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-[#EA580C]" />
              Clientes em Pós-Venda
            </p>

            <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={allSearch}
                  onChange={e => setAllSearch(e.target.value)}
                  placeholder="Digite nome, telefone ou placa..."
                  className="w-full min-h-[38px] bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <select
                value={allRange}
                onChange={e => setAllRange(e.target.value as 'todas' | '30' | '60' | '90')}
                aria-label="Filtrar por faixa"
                className="shrink-0 min-h-[38px] bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
              >
                <option value="todas">Todas as faixas</option>
                <option value="30">30+ dias</option>
                <option value="60">60+ dias</option>
                <option value="90">90+ dias</option>
              </select>

              <div className="relative shrink-0 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={referenceDate}
                  onChange={e => setReferenceDate(e.target.value)}
                  aria-label="Calcular os dias sem retorno a partir desta data"
                  title="Calcular os dias sem retorno a partir desta data"
                  className={`min-h-[38px] bg-white border rounded-lg pl-8 pr-2 py-2 text-[11px] font-semibold focus:border-[#EA580C] focus:outline-hidden ${
                    referenceDate ? 'border-[#EA580C] text-[#9A3412]' : 'border-slate-200 text-slate-700'
                  }`}
                />
                {referenceDate && (
                  <button
                    type="button"
                    onClick={() => setReferenceDate('')}
                    className="min-h-[38px] px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    title="Voltar para hoje"
                  >
                    Hoje
                  </button>
                )}
              </div>

              <select
                value={allSort}
                onChange={e => setAllSort(e.target.value as 'recentes' | 'antigos')}
                aria-label="Ordenar clientes"
                className="shrink-0 min-h-[38px] bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
              </select>

              <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setAllView('grid')}
                  aria-label="Visualizar em cartões"
                  aria-pressed={allView === 'grid'}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                    allView === 'grid'
                      ? 'border-[#EA580C] bg-[#EA580C] text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAllView('list')}
                  aria-label="Visualizar em lista"
                  aria-pressed={allView === 'list'}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                    allView === 'list'
                      ? 'border-[#EA580C] bg-[#EA580C] text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {allClients.length} {allClients.length === 1 ? 'cliente' : 'clientes'}
            </p>
          </div>

          {allClients.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-16 px-6 flex flex-col items-center justify-center text-center">
              <MessageSquare className="w-7 h-7 text-slate-400 mb-2" />
              <p className="text-sm font-extrabold text-slate-900">Nenhum cliente no Pós-Venda ainda</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[320px]">
                Clientes aparecem aqui após serem movidos para Pós-Venda no Pátio ou na Ordem de Serviço.
              </p>
            </div>
          ) : allView === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {allClients.map(({ client, days, visitDate, moto }) => (
                <article
                  key={client.id}
                  className="relative bg-white rounded-xl border border-slate-200/80 shadow-xs pl-3 pr-3.5 py-3 space-y-2 min-w-0 overflow-hidden"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{client.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {client.phone} · {moto ? moto.plate : 'sem veículo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {visitDate ? formatDateBR(visitDate) : 'sem visita'} · {days === null ? 'sem data' : `${days} dias`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openWhatsapp(client)}
                      className="flex-1 min-h-[32px] rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('clientes')}
                      className="flex-1 min-h-[32px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                    >
                      <span>Ver cadastro</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              {allClients.map(({ client, days, visitDate, moto }) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{client.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {client.phone} · {moto ? moto.plate : 'sem veículo'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {days === null ? 'sem data' : `${days} dias`}
                  </span>
                  <button
                    type="button"
                    onClick={() => openWhatsapp(client)}
                    aria-label={`Enviar WhatsApp para ${client.name}`}
                    className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
