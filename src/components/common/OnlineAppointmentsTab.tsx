import React, { useMemo, useState } from 'react';
import { CalendarCheck, Bike, Calendar, Clock, Store, Inbox } from 'lucide-react';
import { Appointment, ServiceItem } from '../../types';

interface OnlineAppointmentsTabProps {
  appointments: Appointment[];
  services: ServiceItem[];
  onOpen: (request: Appointment) => void;
  onViewStore: () => void;
}

type FilterKey = 'pendentes' | 'aceitas' | 'recusadas' | 'todas';

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('pt-BR');
};

export const OnlineAppointmentsTab: React.FC<OnlineAppointmentsTabProps> = ({
  appointments,
  services,
  onOpen,
  onViewStore,
}) => {
  const [filter, setFilter] = useState<FilterKey>('pendentes');

  const requests = useMemo(
    () =>
      appointments
        .filter(a => a.isOnlineBooking)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [appointments]
  );

  const counts = {
    pendentes: requests.filter(a => a.status === 'agendado').length,
    aceitas: requests.filter(a => a.status === 'confirmado' || a.status === 'em_atendimento' || a.status === 'concluido' || a.serviceOrderId).length,
    recusadas: requests.filter(a => a.status === 'cancelado' || a.status === 'nao_compareceu').length,
    todas: requests.length,
  };

  const visible = requests.filter(a => {
    if (filter === 'todas') return true;
    if (filter === 'pendentes') return a.status === 'agendado';
    if (filter === 'aceitas')
      return a.status === 'confirmado' || a.status === 'em_atendimento' || a.status === 'concluido' || Boolean(a.serviceOrderId);
    return a.status === 'cancelado' || a.status === 'nao_compareceu';
  });

  const priceOf = (request: Appointment) =>
    request.serviceIds.reduce((sum, id) => sum + (services.find(s => s.id === id)?.price || 0), 0);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'aceitas', label: 'Aceitas' },
    { key: 'recusadas', label: 'Recusadas' },
    { key: 'todas', label: 'Todas' },
  ];

  return (
    <div className="pk-section-stack min-w-0">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#FFEDD5] flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5 text-[#9A3412]" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Com o Agendamento Online, sua empresa terá uma Vitrine Digital com um link próprio para seus
            clientes conhecerem seus serviços e solicitarem agendamentos.
          </p>
          <button
            type="button"
            onClick={onViewStore}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center gap-1.5 transition sm:ml-auto sm:flex"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Ver minha Vitrine</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {filters.map(item => {
          const isActive = filter === item.key;
          const count = counts[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#FFEDD5] border-[#EA580C] text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{item.label}</span>
              {count > 0 && <span className="tabular-nums">({count})</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center space-y-1">
          <Inbox className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="text-sm font-extrabold text-slate-900">Nenhuma solicitação por aqui.</p>
          <p className="text-xs text-slate-500">
            Compartilhe o link da Vitrine para receber solicitações de agendamento.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pk-stagger">
          {visible.map(request => {
            const price = priceOf(request);
            const isPending = request.status === 'agendado';
            return (
              <div
                key={request.id}
                className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-[#EA580C] p-3.5 space-y-2 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 wrap-anywhere">{request.clientName}</h3>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="wrap-anywhere">
                        {request.motorcycleBrand || request.motorcycleModel}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono font-bold text-slate-700">{request.motorcyclePlate}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-md shrink-0 ${
                      isPending
                        ? 'bg-[#FFEDD5] text-[#9A3412]'
                        : request.status === 'cancelado' || request.status === 'nao_compareceu'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {isPending
                      ? 'Pendente'
                      : request.status === 'cancelado' || request.status === 'nao_compareceu'
                        ? 'Recusada'
                        : 'Aceita'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDate(request.date)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {request.startTime}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-600">
                    {request.serviceNames.length}{' '}
                    {request.serviceNames.length === 1 ? 'serviço' : 'serviços'}
                  </span>
                  <span className="font-mono font-black text-slate-900 tabular-nums">{brl(price)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpen(request)}
                  className="w-full min-h-[36px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
                >
                  Ver detalhes
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
