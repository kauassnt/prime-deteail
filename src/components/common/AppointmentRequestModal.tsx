import React, { useMemo, useState } from 'react';
import { Clock, Calendar, X, Bike, UserCheck, MessageCircle, Plus, AlertCircle } from 'lucide-react';
import { Appointment, Client, ServiceItem } from '../../types';
import { buildWhatsappLink } from '../../utils/whatsappUtils';

interface AppointmentRequestModalProps {
  request: Appointment | null;
  services: ServiceItem[];
  clients: Client[];
  onClose: () => void;
  onAccept: (request: Appointment) => void;
  onReject: (request: Appointment, reason: string) => void;
  onAddService: (request: Appointment, service: ServiceItem) => void;
}

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');

const formatRequestDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('pt-BR');
};

const REJECT_REASONS = ['Horário indisponível', 'Serviço indisponível', 'Não foi possível confirmar', 'Outro'];

export const AppointmentRequestModal: React.FC<AppointmentRequestModalProps> = ({
  request,
  services,
  clients,
  onClose,
  onAccept,
  onReject,
  onAddService,
}) => {
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('Horário indisponível');
  const [rejectNotes, setRejectNotes] = useState('');

  const catalog = useMemo<ServiceItem[]>(() => {
    if (!request) return [];
    return request.serviceIds
      .map(id => services.find(s => s.id === id))
      .filter((service): service is ServiceItem => Boolean(service));
  }, [request, services]);

  const registeredClient = useMemo(() => {
    if (!request) return null;
    const phone = onlyDigits(request.clientPhone);
    return (
      clients.find(c => onlyDigits(c.phone) === phone && phone.length > 0) ||
      clients.find(c => c.name.trim().toLowerCase() === request.clientName.trim().toLowerCase()) ||
      null
    );
  }, [clients, request]);

  const total = catalog.reduce((sum, s) => sum + (s?.price || 0), 0);
  const availableServices = services.filter(s => s.active && request && !request.serviceIds.includes(s.id));
  const nameDiffers =
    registeredClient && registeredClient.name.trim().toLowerCase() !== request?.clientName.trim().toLowerCase();

  if (!request) return null;

  const isPending = request.status === 'agendado';

  const whatsapp = (message: string) => buildWhatsappLink(request.clientPhone, message);

  if (rejectOpen) {
    return (
      <div className="fixed inset-x-0 top-0 z-[60] h-[var(--vvh,100dvh)] bg-black/60 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Recusar solicitação"
          className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900">Recusar solicitação?</h2>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              aria-label="Fechar"
              className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            O cliente não recebe aviso automático. Você pode combinar pelo WhatsApp depois.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => setRejectReason(reason)}
                className={`min-h-[32px] px-3 rounded-lg border text-[11px] font-semibold transition ${
                  rejectReason === reason
                    ? 'bg-slate-100 border-slate-400 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="reject-reason">
              Motivo (opcional)
            </label>
            <textarea
              id="reject-reason"
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const reason = rejectNotes.trim()
                  ? `${rejectReason} — ${rejectNotes.trim()}`
                  : rejectReason;
                onReject(request, reason);
                setRejectOpen(false);
              }}
              className="w-full min-h-[42px] rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-extrabold transition"
            >
              Recusar solicitação
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[var(--vvh,100dvh)] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Solicitação de agendamento"
        className="w-full sm:max-w-[440px] max-h-[min(92dvh,calc(var(--vvh,100dvh)-10px))] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="sm:hidden flex justify-center pt-2">
          <span className="w-9 h-1 rounded-full bg-slate-200" aria-hidden="true" />
        </div>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <h2 className="text-sm font-black text-slate-900">Solicitação de agendamento</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pk-scroll-compact p-4 space-y-3">
          <span
            className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
              isPending
                ? 'bg-[#FFEDD5] text-[#9A3412]'
                : request.status === 'cancelado'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isPending ? 'Pendente' : request.status === 'cancelado' ? 'Recusada' : 'Aceita'}
          </span>

          <div className="rounded-xl border border-slate-200 px-3.5 py-3 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente</p>
            <p className="text-sm font-extrabold text-slate-900 wrap-anywhere">{request.clientName}</p>
            <p className="text-xs text-slate-600 font-mono">{request.clientPhone}</p>
          </div>

          <div className="rounded-xl border border-slate-200 px-3.5 py-3 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Veículo</p>
            <p className="text-sm font-bold text-slate-900 wrap-anywhere">
              {request.motorcycleBrand || request.motorcycleModel}
            </p>
            <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-slate-400" />
              {request.motorcyclePlate}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 px-3.5 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serviços solicitados</p>
            {catalog.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum serviço vinculado a esta solicitação.</p>
            ) : (
              <div className="space-y-1.5">
                {catalog.map(service => (
                  <div key={service.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 wrap-anywhere">{service.name}</span>
                    <span className="font-mono font-bold text-slate-800 shrink-0">{brl(service.price)}</span>
                  </div>
                ))}
              </div>
            )}

            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => setShowServicePicker(prev => !prev)}
                  className="w-full min-h-[36px] rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar serviço</span>
                </button>
                {showServicePicker && (
                  <div className="max-h-[150px] overflow-y-auto pk-scroll-compact divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {availableServices.length === 0 ? (
                      <p className="text-[11px] text-slate-400 p-2">Todos os serviços já estão nesta solicitação.</p>
                    ) : (
                      availableServices.map(service => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            onAddService(request, service);
                            setShowServicePicker(false);
                          }}
                          className="w-full min-h-[34px] px-2.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <span className="wrap-anywhere">{service.name}</span>
                          <span className="font-mono text-slate-500 shrink-0">{brl(service.price)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-black text-slate-900">
              <span>Total</span>
              <span className="font-mono">{brl(total)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 px-3.5 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Agendamento pretendido
            </p>
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatRequestDate(request.date)}
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
              {request.startTime}
            </p>
            <p className="text-[10.5px] text-slate-500 flex items-start gap-1.5 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              Isto é uma preferência de horário do cliente, não uma confirmação.
            </p>
          </div>

          {registeredClient && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100">
                <UserCheck className="w-4 h-4 text-[#EA580C]" />
                <div>
                  <p className="text-[11px] font-bold text-slate-900">Cliente já cadastrado</p>
                  <p className="text-[10px] text-slate-500">
                    O telefone informado corresponde a um cliente da sua conta.
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 px-3.5 py-2.5 space-y-1.5 text-[11px]">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                    Nome informado
                  </p>
                  <p className="font-semibold text-slate-800">{request.clientName}</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">No cadastro</p>
                  <p className="font-semibold text-slate-800">{registeredClient.name}</p>
                </div>
              </div>
              {nameDiffers && (
                <p className="px-3.5 py-2 text-[10px] text-slate-500 border-t border-slate-100 leading-snug">
                  O nome informado está diferente do cadastro. Nada será alterado automaticamente.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 px-3.5 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Falar no WhatsApp
            </p>
            {[
              { label: 'Confirmar recebimento', message: `Olá ${request.clientName}! Recebemos sua solicitação para ${formatRequestDate(request.date)} às ${request.startTime}. Vamos confirmar e já retornamos.` },
              { label: 'Tirar uma dúvida', message: `Olá ${request.clientName}! Sobre sua solicitação de agendamento: em que podemos ajudar?` },
              { label: 'Sugerir outro horário', message: `Olá ${request.clientName}! O horário ${formatRequestDate(request.date)} às ${request.startTime} não está disponível. Podemos sugerir outro horário?` },
            ].map(action => (
              <a
                key={action.label}
                href={whatsapp(action.message)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[36px] rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{action.label}</span>
              </a>
            ))}
          </div>
        </div>

        {isPending && (
          <div className="border-t border-slate-100 p-3 space-y-2 shrink-0 bg-white">
            <button
              type="button"
              onClick={() => onAccept(request)}
              className="w-full min-h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
            >
              Aceitar solicitação
            </button>
            <p className="text-[10px] text-center text-slate-500 leading-snug">
              Todos os serviços solicitados entram em um único agendamento.
            </p>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition"
            >
              Recusar solicitação
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
