import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  Bike,
  CheckCircle2,
  DollarSign,
  Plus,
  MessageCircle,
  ChevronRight,
  Pencil,
  FileText,
  Trash2,
  Search,
  X
} from 'lucide-react';
import { OSStatus, PaymentMethod, ServiceOrder } from '../../types';
import { StartServiceInspectionModal } from '../common/StartServiceInspectionModal';
import { EditOrderSheet } from '../common/EditOrderSheet';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { peekPatioFocus, clearPatioFocus } from '../../services/patioFocus';
import { patioStageOf } from '../../services/patioStage';
import { confirmDialog } from '../../services/dialogService';

type PatioTab = 'para_fazer' | 'em_servico' | 'concluido' | 'pago';

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLUMN_TONE: Record<PatioTab, string> = {
  para_fazer: 'bg-blue-50/50 border-blue-200/70 border-l-blue-500',
  em_servico: 'bg-amber-50/50 border-amber-200/70 border-l-amber-500',
  concluido: 'bg-emerald-50/50 border-emerald-200/70 border-l-emerald-500',
  pago: 'bg-purple-50/50 border-purple-200/70 border-l-purple-500',
};

const PAYMENT_METHOD_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferência' },
];

const NEXT_STATUS_PILL_LABEL: Record<string, string> = {
  para_fazer: 'Em Serviço',
  em_servico: 'Concluído',
  concluido: 'Entregue',
};

export const PatioModule: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    addPaymentToOrder,
    cancelOrder,
    openQuickAction,
    setSelectedOrderId,
    searchQuery,
    setSearchQuery
  } = useApp();

  const [startingOrder, setStartingOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [mobileTab, setMobileTab] = useState<PatioTab>('para_fazer');
  const [expandedCardIds, setExpandedCardIds] = useState<string[]>([]);
  const [filterEmployee] = useState<string>('all');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<PatioTab | null>(null);
  const [payingOrder, setPayingOrder] = useState<ServiceOrder | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [pendingDeliveryId, setPendingDeliveryId] = useState<string | null>(null);
  const [focusedColumn, setFocusedColumn] = useState<PatioTab | null>(null);

  // Veio de um card do dashboard: abre já na coluna certa e destaca o bloco
  useEffect(() => {
    const tab = peekPatioFocus();
    if (!tab) return;
    setMobileTab(tab);
    setFocusedColumn(tab);
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(`[data-patio-column="${tab}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 140);
    const clearTimer = window.setTimeout(() => {
      setFocusedColumn(null);
      clearPatioFocus();
    }, 2800);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  // Entrega a OS só depois que o pagamento entrou no estado (evita sobrescrever o recebimento)
  useEffect(() => {
    if (!pendingDeliveryId) return;
    updateOrderStatus(pendingDeliveryId, 'entregue');
    setPendingDeliveryId(null);
  }, [pendingDeliveryId, updateOrderStatus]);

  // Filter orders
  const activeOrders = orders.filter(o => o.status !== 'cancelado');

  const filteredOrders = activeOrders.filter(o => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      o.clientName.toLowerCase().includes(q) ||
      o.motorcyclePlate.toLowerCase().includes(q) ||
      o.motorcycleBrand.toLowerCase().includes(q) ||
      o.motorcycleModel.toLowerCase().includes(q) ||
      (o.motorcycleVersion && o.motorcycleVersion.toLowerCase().includes(q)) ||
      (o.motorcycleCategory && o.motorcycleCategory.toLowerCase().includes(q)) ||
      o.id.toLowerCase().includes(q);

    const matchEmployee = filterEmployee === 'all' || o.assignedEmployeeId === filterEmployee;

    return matchSearch && matchEmployee;
  });

  // Categorize — cada OS em uma única coluna (nunca duplicada)
  const paraFazerList = filteredOrders.filter(o => patioStageOf(o) === 'para_fazer');
  const emServicoList = filteredOrders.filter(o => patioStageOf(o) === 'em_servico');
  const concluidoList = filteredOrders.filter(o => patioStageOf(o) === 'concluido');
  const pagoList = filteredOrders.filter(o => patioStageOf(o) === 'pago');

  const sumTotals = (list: ServiceOrder[]) => list.reduce((acc, o) => acc + o.total, 0);
  const sumReceived = (list: ServiceOrder[]) => list.reduce((acc, o) => acc + o.amountPaid, 0);

  // Helper for status transition
  const getNextStatus = (current: OSStatus): OSStatus | null => {
    if (current === 'para_fazer') return 'em_servico';
    if (current === 'em_servico') return 'concluido';
    if (current === 'concluido') return 'entregue';
    return null;
  };

  // WhatsApp shortcut link
  const buildWhatsAppUrl = (phone: string, clientName: string, plate: string, status: OSStatus) => {
    let msg = `Olá ${clientName}! Aqui é da PK Detail.`;
    if (status === 'concluido') {
      msg = `Olá ${clientName}! Sua moto (Placa: ${plate}) está pronta e impecável no pátio da PK Detail! Pode vir retirar quando desejar.`;
    } else if (status === 'em_servico') {
      msg = `Olá ${clientName}! Informamos que sua moto (Placa: ${plate}) acabou de entrar na baia de estética e detalhamento.`;
    }
    return buildWhatsappLink(phone, msg);
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedCardIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleCancel = async (order: ServiceOrder) => {
    const confirmed = await confirmDialog(
      `Cancelar a OS de ${order.clientName} (${order.motorcyclePlate})? A moto sai do pátio.`,
      { title: 'Cancelar OS', confirmLabel: 'Cancelar OS', cancelLabel: 'Manter OS', tone: 'danger' }
    );
    if (confirmed) cancelOrder(order.id, 'Cancelado no pátio pelo operador');
  };

  // Move a card to another column (drag & drop) — nunca abre modal nem duplica a OS
  const moveOrderTo = (orderId: string, target: PatioTab) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === 'cancelado') return;

    if (target === 'pago') {
      if (order.status === 'entregue') return;
      const balance = Math.max(0, order.total - order.amountPaid);
      if (order.paymentStatus !== 'pago' && balance > 0) {
        // Soltou em Pago/Quitado com saldo em aberto: registra o pagamento e entrega
        setPayMethod('pix');
        setPayingOrder(order);
        return;
      }
      updateOrderStatus(order.id, 'entregue');
      return;
    }

    const targetStatus: OSStatus =
      target === 'para_fazer' ? 'para_fazer' : target === 'em_servico' ? 'em_servico' : 'concluido';
    if (order.status === targetStatus) return;
    updateOrderStatus(order.id, targetStatus);
  };

  const handleDropOnColumn = (event: React.DragEvent, target: PatioTab) => {
    event.preventDefault();
    const orderId = event.dataTransfer.getData('text/plain') || draggingId;
    setDragOverColumn(null);
    setDraggingId(null);
    if (orderId) moveOrderTo(orderId, target);
  };

  const confirmPatioPayment = () => {
    if (!payingOrder) return;
    const balance = Math.max(0, payingOrder.total - payingOrder.amountPaid);
    if (balance > 0) {
      addPaymentToOrder(payingOrder.id, balance, payMethod, 'Pagamento registrado no pátio');
    }
    setPayingOrder(null);
    setPendingDeliveryId(payingOrder.id);
  };

  // Render Card Component
  const renderCard = (o: ServiceOrder, tone: PatioTab) => {
    const nextStatus = getNextStatus(o.status);
    const isExpanded = expandedCardIds.includes(o.id);
    const visibleServices = isExpanded ? o.services : o.services.slice(0, 2);
    const hiddenServicesCount = Math.max(0, o.services.length - 2);
    const createdDate = new Date(o.entryDateTime).toLocaleDateString('pt-BR');

    return (
      <div
        key={o.id}
        draggable
        onDragStart={event => {
          event.dataTransfer.setData('text/plain', o.id);
          event.dataTransfer.effectAllowed = 'move';
          setDraggingId(o.id);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverColumn(null);
        }}
        title="Arraste para mover de etapa"
        className={`rounded-2xl border border-l-4 ${COLUMN_TONE[tone]} shadow-xs hover:shadow-md transition p-3.5 space-y-3 min-w-0 text-left cursor-grab active:cursor-grabbing select-none ${
          draggingId === o.id ? 'opacity-40 ring-2 ring-[#EA580C]' : ''
        }`}
      >
        {/* Client + Bike + Shortcuts */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h3 className="font-black text-[15px] text-slate-900 leading-tight truncate">
              {o.clientName}
            </h3>
            <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">
              {o.motorcycleBrand} · {o.motorcyclePlate}
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setEditingOrder(o)}
              title="Editar OS"
              aria-label="Editar OS"
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderId(o.id)}
              title="Abrir OS / PDF"
              aria-label="Abrir OS / PDF"
              className="w-7 h-7 rounded-lg text-amber-500 hover:bg-amber-50 flex items-center justify-center transition"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <a
              href={buildWhatsAppUrl(o.clientPhone, o.clientName, o.motorcyclePlate, o.status)}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              onDragStart={event => event.preventDefault()}
              title="Enviar mensagem WhatsApp"
              className="w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-50 flex items-center justify-center transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Services with prices */}
        <div className="space-y-1.5">
          {visibleServices.map((s, idx) => (
            <div key={`${s.serviceId}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-700 font-medium truncate">{s.serviceName}</span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                {brl(s.price)}
              </span>
            </div>
          ))}

          {hiddenServicesCount > 0 && (
            <button
              type="button"
              onClick={() => toggleExpanded(o.id)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 pt-0.5 transition"
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span>{isExpanded ? 'mostrar menos' : `${hiddenServicesCount} outros serviços`}</span>
            </button>
          )}
        </div>

        {/* Total + Action */}
        <div className="border-t border-slate-100 pt-2.5 flex items-end justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total
            </span>
            <span className="text-lg font-black text-slate-900 tabular-nums leading-tight">
              {brl(o.total)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {nextStatus ? (
              <button
                type="button"
                onClick={() => {
                  if (o.status === 'para_fazer' && nextStatus === 'em_servico') {
                    setStartingOrder(o);
                  } else {
                    updateOrderStatus(o.id, nextStatus);
                  }
                }}
                className="min-h-[32px] px-3 py-1.5 rounded-lg bg-[#FDE68A] hover:bg-[#C2410C] text-[#78350F] text-xs font-extrabold flex items-center gap-1 whitespace-nowrap transition"
              >
                <span>{NEXT_STATUS_PILL_LABEL[o.status]}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold whitespace-nowrap">
                Finalizado
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                void handleCancel(o);
              }}
              title="Cancelar OS"
              aria-label="Cancelar OS"
              className="w-6 h-6 rounded-md text-rose-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-medium">Criado em {createdDate}</p>
      </div>
    );
  };

  return (
    <div className="pk-section-stack min-w-0">
      {/* Page Header — Reference Layout */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Pátio</h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-snug">
              Gerencie os veículos em atendimento
              <br className="hidden sm:block" /> na sua estética automotiva
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openQuickAction('os')}
          className="shrink-0 min-h-[42px] px-4 py-2.5 rounded-full bg-[#FDE68A] hover:bg-[#C2410C] text-[#78350F] font-extrabold text-sm flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Nova OS</span>
        </button>
      </div>

      {/* Busca do pátio (a barra superior foi removida) */}
      <div className="relative min-w-0">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar placa, cliente, modelo ou OS..."
          className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Summary Strip (mobile filter) */}
      <div className="md:hidden bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="grid grid-cols-4">
          {[
            {
              id: 'para_fazer' as PatioTab,
              label: 'Para Fazer',
              count: paraFazerList.length,
              total: sumTotals(paraFazerList),
              dot: 'bg-blue-500',
              text: 'text-blue-700',
              activeBg: 'bg-blue-50',
              bar: 'bg-blue-500',
            },
            {
              id: 'em_servico' as PatioTab,
              label: 'Em Serviço',
              count: emServicoList.length,
              total: sumTotals(emServicoList),
              dot: 'bg-amber-400',
              text: 'text-amber-700',
              activeBg: 'bg-amber-50',
              bar: 'bg-amber-400',
            },
            {
              id: 'concluido' as PatioTab,
              label: 'Concluído',
              count: concluidoList.length,
              total: sumTotals(concluidoList),
              dot: 'bg-emerald-400',
              text: 'text-emerald-700',
              activeBg: 'bg-emerald-50',
              bar: 'bg-emerald-400',
            },
            {
              id: 'pago' as PatioTab,
              label: 'Pago',
              count: pagoList.length,
              total: sumReceived(pagoList),
              dot: 'bg-purple-400',
              text: 'text-purple-700',
              activeBg: 'bg-purple-50',
              bar: 'bg-purple-400',
            },
          ].map((col, idx) => {
            const isActive = mobileTab === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setMobileTab(col.id)}
                className={`relative text-left px-2 pt-2 pb-3 transition min-w-0 ${
                  idx > 0 ? 'border-l border-slate-100' : ''
                } ${isActive ? col.activeBg : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="flex items-center gap-1 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                  <span className={`text-[10px] font-bold truncate ${col.text}`}>{col.label}</span>
                </span>
                <span className="block text-lg font-black text-slate-900 tabular-nums leading-none mt-1">
                  {col.count}
                </span>
                <span className="block text-[10px] font-semibold text-slate-500 tabular-nums mt-0.5 truncate">
                  {brl(col.total)}
                </span>
                {isActive && <span className={`absolute left-0 right-0 bottom-0 h-[2px] ${col.bar}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* MOBILE CONTENT VIEW */}
      <div className="md:hidden space-y-2.5">
        {mobileTab === 'para_fazer' && (
          <div className="space-y-2.5 pk-stagger">
            {paraFazerList.length === 0 ? (
              <div className="bg-white p-5 sm:p-6 rounded-2xl text-center text-slate-400 border border-slate-200">
                <Clock className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Pátio limpo: nenhuma moto aguardando início.</p>
              </div>
            ) : (
              paraFazerList.map(o => renderCard(o, 'para_fazer'))
            )}
          </div>
        )}

        {mobileTab === 'em_servico' && (
          <div className="space-y-2.5 pk-stagger">
            {emServicoList.length === 0 ? (
              <div className="bg-white p-5 sm:p-6 rounded-2xl text-center text-slate-400 border border-slate-200">
                <Bike className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Nenhuma moto em atendimento no momento.</p>
              </div>
            ) : (
              emServicoList.map(o => renderCard(o, 'em_servico'))
            )}
          </div>
        )}

        {mobileTab === 'concluido' && (
          <div className="space-y-2.5 pk-stagger">
            {concluidoList.length === 0 ? (
              <div className="bg-white p-5 sm:p-6 rounded-2xl text-center text-slate-400 border border-slate-200">
                <CheckCircle2 className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Nenhuma moto concluída aguardando retirada.</p>
              </div>
            ) : (
              concluidoList.map(o => renderCard(o, 'concluido'))
            )}
          </div>
        )}

        {mobileTab === 'pago' && (
          <div className="space-y-2.5 pk-stagger">
            {pagoList.length === 0 ? (
              <div className="bg-white p-5 sm:p-6 rounded-2xl text-center text-slate-400 border border-slate-200">
                <DollarSign className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Nenhum pagamento registrado ainda.</p>
              </div>
            ) : (
              pagoList.map(o => renderCard(o, 'pago'))
            )}
          </div>
        )}
      </div>

      {/* TABLET (2-COL) & DESKTOP (4-COL) KANBAN BOARD */}
      <p className="hidden md:block text-[11px] font-medium text-slate-400 -mt-1">
        Arraste os cartões entre as colunas para mudar a etapa da OS.
      </p>

      <div className="hidden md:grid grid-cols-2 xl:grid-cols-4 pk-grid-gap items-stretch">
        {/* COLUNA 1: PARA FAZER */}
        <div
          data-patio-column="para_fazer"
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (dragOverColumn !== 'para_fazer') setDragOverColumn('para_fazer');
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null);
          }}
          onDrop={event => handleDropOnColumn(event, 'para_fazer')}
          className={`bg-slate-100/80 p-2.5 sm:p-3 rounded-2xl border flex flex-col gap-2.5 h-full transition ${
            dragOverColumn === 'para_fazer'
              ? 'border-[#EA580C] ring-2 ring-[#EA580C]/50 bg-white'
              : focusedColumn === 'para_fazer'
                ? 'border-[#EA580C] ring-2 ring-[#EA580C]/45 bg-white'
                : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between px-1.5 pt-0.5 shrink-0">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-blue-900">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Para Fazer</span>
            </div>
            <span className="text-xs font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full shadow-xs">
              {paraFazerList.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 pk-stagger">
            {paraFazerList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma moto aguardando
              </div>
            ) : (
              paraFazerList.map(o => renderCard(o, 'para_fazer'))
            )}
          </div>
        </div>

        {/* COLUNA 2: EM SERVIÇO */}
        <div
          data-patio-column="em_servico"
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (dragOverColumn !== 'em_servico') setDragOverColumn('em_servico');
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null);
          }}
          onDrop={event => handleDropOnColumn(event, 'em_servico')}
          className={`bg-amber-50/60 p-2.5 sm:p-3 rounded-2xl border flex flex-col gap-2.5 h-full transition ${
            dragOverColumn === 'em_servico'
              ? 'border-[#EA580C] ring-2 ring-[#EA580C]/50 bg-white'
              : focusedColumn === 'em_servico'
                ? 'border-[#EA580C] ring-2 ring-[#EA580C]/45 bg-white'
                : 'border-amber-200/60'
          }`}
        >
          <div className="flex items-center justify-between px-1.5 pt-0.5 shrink-0">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-900">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Em Serviço</span>
            </div>
            <span className="text-xs font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full shadow-xs">
              {emServicoList.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 pk-stagger">
            {emServicoList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma moto em atendimento
              </div>
            ) : (
              emServicoList.map(o => renderCard(o, 'em_servico'))
            )}
          </div>
        </div>

        {/* COLUNA 3: CONCLUÍDO */}
        <div
          data-patio-column="concluido"
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (dragOverColumn !== 'concluido') setDragOverColumn('concluido');
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null);
          }}
          onDrop={event => handleDropOnColumn(event, 'concluido')}
          className={`bg-emerald-50/60 p-2.5 sm:p-3 rounded-2xl border flex flex-col gap-2.5 h-full transition ${
            dragOverColumn === 'concluido'
              ? 'border-[#EA580C] ring-2 ring-[#EA580C]/50 bg-white'
              : focusedColumn === 'concluido'
                ? 'border-[#EA580C] ring-2 ring-[#EA580C]/45 bg-white'
                : 'border-emerald-200/60'
          }`}
        >
          <div className="flex items-center justify-between px-1.5 pt-0.5 shrink-0">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-emerald-900">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Concluído</span>
            </div>
            <span className="text-xs font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full shadow-xs">
              {concluidoList.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 pk-stagger">
            {concluidoList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma moto pronta no pátio
              </div>
            ) : (
              concluidoList.map(o => renderCard(o, 'concluido'))
            )}
          </div>
        </div>

        {/* COLUNA 4: PAGAMENTO CONFIRMADO */}
        <div
          data-patio-column="pago"
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (dragOverColumn !== 'pago') setDragOverColumn('pago');
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null);
          }}
          onDrop={event => handleDropOnColumn(event, 'pago')}
          className={`bg-slate-100/80 p-2.5 sm:p-3 rounded-2xl border flex flex-col gap-2.5 h-full transition ${
            dragOverColumn === 'pago'
              ? 'border-[#EA580C] ring-2 ring-[#EA580C]/50 bg-white'
              : focusedColumn === 'pago'
                ? 'border-[#EA580C] ring-2 ring-[#EA580C]/45 bg-white'
                : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between px-1.5 pt-0.5 shrink-0">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span>Pago / Quitado</span>
            </div>
            <span className="text-xs font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full shadow-xs">
              {pagoList.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 pk-stagger">
            {pagoList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma ordem quitada
              </div>
            ) : (
              pagoList.map(o => renderCard(o, 'pago'))
            )}
          </div>
        </div>
      </div>

      {/* Step-by-Step Inspection Modal Before Starting Service */}
      <StartServiceInspectionModal
        order={startingOrder}
        onClose={() => setStartingOrder(null)}
      />

      {/* Edit sheet (Pátio) */}
      <EditOrderSheet order={editingOrder} onClose={() => setEditingOrder(null)} />

      {/* Drop na coluna Pago / Quitado: registra o saldo e entrega */}
      {payingOrder && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar pagamento no pátio"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Registrar pagamento</h3>
              <p className="text-xs text-slate-500 mt-1 truncate">
                {payingOrder.clientName} · {payingOrder.motorcyclePlate}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Saldo a receber
              </span>
              <span className="text-base font-black tabular-nums text-slate-900">
                {brl(Math.max(0, payingOrder.total - payingOrder.amountPaid))}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Forma de pagamento
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHOD_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPayMethod(opt.id)}
                    className={`min-h-[38px] rounded-xl border text-xs font-bold transition ${
                      payMethod === opt.id
                        ? 'bg-[#EA580C] border-[#EA580C] text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              A OS será marcada como paga e entregue, saindo do pátio.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPatioPayment}
                className="flex-1 min-h-[40px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-xs font-extrabold text-white transition"
              >
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
