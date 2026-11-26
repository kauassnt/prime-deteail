import React, { useState, useEffect } from 'react';
import { companyDisplayName } from '../../utils/company';

import { useApp } from '../../context/AppContext';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import { CameraPhotoCapture } from '../common/CameraPhotoCapture';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { PrintableDocumentHeader } from '../common/PrintableDocumentHeader';
import {
  documentAccentInk,
  documentOnAccent,
  resolveDocumentColor,
} from '../../utils/documentTheme';
import { useBrandIdentity } from '../../core/brandIdentityEngine';
import {
  ArrowLeft,
  Printer,
  DollarSign,
  ShieldCheck,
  Bike,
  User,
  Plus,
  Trash2,
  MessageCircle,
  AlertCircle,
  FileText,
  LayoutGrid,
  Phone,
  Wrench,
  Package,
  Fuel,
  ClipboardCheck,
  Calendar,
  Check,
  Pencil,
  Camera,
  Save,
  Play
} from 'lucide-react';
import { InspectionAnglePhotos, InspectionChecklist, OSStatus, PaymentMethod, PaymentStatus } from '../../types';
import { formatDateBR, getLocalDateKey } from '../../utils/dateUtils';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { StartServiceInspectionModal } from '../common/StartServiceInspectionModal';
import {
  DEFAULT_CHECKLIST_ITEMS,
  EditableChecklistEditor,
  FourAnglePhotoStep,
  INSPECTION_ANGLES,
  countCapturedAngles,
  mergeInspectionPhotosIntoBefore,
  splitOrderBeforePhotos
} from '../common/InspectionWorkflowSteps';

interface ServiceOrderModalProps {
  orderId: string | null;
  onClose: () => void;
}

const OS_STEPS: { id: Exclude<OSStatus, 'cancelado'>; label: string; short: string }[] = [
  { id: 'para_fazer', label: 'Aguardando Início', short: 'Aguardando' },
  { id: 'em_servico', label: 'Em Serviço / Baia', short: 'Em Serviço' },
  { id: 'concluido', label: 'Serviço Concluído', short: 'Concluído' },
  { id: 'entregue', label: 'Entregue ao Cliente', short: 'Entregue' },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Cartão de Débito',
  credito: 'Cartão de Crédito',
  transferencia: 'Transferência Bancária',
};

const getStatusLabel = (status: OSStatus) => {
  switch (status) {
    case 'para_fazer':
      return 'Aguardando';
    case 'em_servico':
      return 'Em Serviço';
    case 'concluido':
      return 'Concluído';
    case 'entregue':
      return 'Entregue';
    case 'cancelado':
      return 'Cancelado';
  }
};

const getPaymentStatusLabel = (status: PaymentStatus) => {
  switch (status) {
    case 'pago':
      return 'Quitado';
    case 'parcial':
      return 'Pagamento Parcial';
    case 'pendente':
      return 'A Receber';
    case 'estornado':
      return 'Estornado';
  }
};

export const ServiceOrderModal: React.FC<ServiceOrderModalProps> = ({ orderId, onClose }) => {
  const {
    orders,
    updateOrder,
    updateOrderStatus,
    addPaymentToOrder,
    settings,
    services: serviceCatalog,
  } = useApp();

  const brandIdentity = useBrandIdentity();
  const showServiceDescriptions = settings.showServiceDescriptions === true;
  const serviceDescriptionById = new Map(
    serviceCatalog.filter(s => s.description).map(s => [s.id, s.description] as const)
  );
  const documentColor = resolveDocumentColor(settings.documentColor);
  const documentTextOnAccent = documentOnAccent(settings.documentColor);
  const documentAccentText = documentAccentInk(settings.documentColor);

  const [viewMode, setViewMode] = useState<'workspace' | 'pdf'>('workspace');
  const [pdfDocType, setPdfDocType] = useState<'Ordem de Serviço' | 'Orçamento' | 'Recibo / Comprovante' | 'Documento de Atendimento'>('Ordem de Serviço');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; label: string } | null>(null);
  const [showStartInspection, setShowStartInspection] = useState(false);
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [draftChecklist, setDraftChecklist] = useState<InspectionChecklist | null>(null);
  const [showFourAngleEditor, setShowFourAngleEditor] = useState(false);
  const [draftAnglePhotos, setDraftAnglePhotos] = useState<InspectionAnglePhotos>({});
  const [draftExtraBeforePhotos, setDraftExtraBeforePhotos] = useState<string[]>([]);

  useEffect(() => {
    setShowPaymentForm(false);
    setPaymentNotes('');
    setPaymentAmount(0);
    setViewMode('workspace');
    setPdfDocType('Ordem de Serviço');
    setShowStartInspection(false);
    setIsEditingChecklist(false);
    setDraftChecklist(null);
    setShowFourAngleEditor(false);
  }, [orderId]);

  const { overlayProps, modalProps } = useModalResponsive({
    isOpen: Boolean(orderId),
    onClose,
    closeOnOverlayClick: false,
    maxHeight: '100dvh',
    ariaLabel: orderId ? `Ordem de Serviço ${orderId}` : 'Ordem de Serviço',
  });

  if (!orderId) return null;

  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  const currentStepIndex = OS_STEPS.findIndex(s => s.id === order.status);
  const paidPct = order.total > 0 ? Math.min(100, Math.round((order.amountPaid / order.total) * 100)) : 0;
  const totalEstimatedMins = order.services.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) return;
    addPaymentToOrder(order.id, Number(paymentAmount), paymentMethod, paymentNotes.trim() || undefined);
    setPaymentAmount(0);
    setPaymentNotes('');
    setShowPaymentForm(false);
  };

  const handleRequestStatusChange = (nextStatus: OSStatus) => {
    if (order.status === 'para_fazer' && nextStatus === 'em_servico') {
      setShowStartInspection(true);
      return;
    }
    updateOrderStatus(order.id, nextStatus);
  };

  const getBeforePhotoLabel = (url: string, index: number) => {
    const angles = order.checklist?.anglePhotosBefore;
    if (angles) {
      const matched = INSPECTION_ANGLES.find(a => angles[a.key] === url);
      if (matched) return `Antes · ${matched.label}`;
    }
    return `Antes #${index + 1}`;
  };

  const handleOpenChecklistEdit = () => {
    const baseChecklist: InspectionChecklist = order.checklist
      ? {
          ...order.checklist,
          items: order.checklist.items?.length
            ? order.checklist.items.map(i => ({ ...i }))
            : DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i })),
          accessoriesLeft: [...(order.checklist.accessoriesLeft || [])],
        }
      : {
          entryDate: order.entryDateTime || new Date().toISOString(),
          fuelLevel: '1/2',
          items: DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i })),
          accessoriesLeft: [],
          entryNotes: '',
        };
    setDraftChecklist(baseChecklist);
    setIsEditingChecklist(true);
  };

  const handleSaveChecklistEdit = () => {
    if (!draftChecklist) return;
    updateOrder({
      ...order,
      checklist: {
        ...order.checklist,
        ...draftChecklist,
      },
    });
    setIsEditingChecklist(false);
  };

  const handleToggleFourAngleEditor = () => {
    if (showFourAngleEditor) {
      setShowFourAngleEditor(false);
      return;
    }
    const { anglePhotos, extraPhotos } = splitOrderBeforePhotos(
      order.photosBefore || [],
      order.checklist?.anglePhotosBefore
    );
    setDraftAnglePhotos(anglePhotos);
    setDraftExtraBeforePhotos(extraPhotos);
    setShowFourAngleEditor(true);
  };

  const handleSaveFourAngles = () => {
    const mergedBefore = mergeInspectionPhotosIntoBefore(draftAnglePhotos, draftExtraBeforePhotos);
    updateOrder({
      ...order,
      photosBefore: mergedBefore,
      checklist: {
        ...(order.checklist || {
          entryDate: order.entryDateTime || new Date().toISOString(),
          fuelLevel: '1/2',
          items: DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i })),
          accessoriesLeft: [],
        }),
        anglePhotosBefore: draftAnglePhotos,
      },
    });
    setShowFourAngleEditor(false);
  };

  const handlePhotoCaptured = (dataUrl: string, type: 'before' | 'after') => {
    if (type === 'before') {
      updateOrder({ ...order, photosBefore: [...order.photosBefore, dataUrl] });
    } else {
      updateOrder({ ...order, photosAfter: [...order.photosAfter, dataUrl] });
    }
  };

  const handleRemovePhoto = (type: 'before' | 'after', index: number) => {
    if (type === 'before') {
      const removedUrl = order.photosBefore[index];
      const nextBefore = order.photosBefore.filter((_, i) => i !== index);
      let nextChecklist = order.checklist;
      if (order.checklist?.anglePhotosBefore && removedUrl) {
        const cleanedAngles: InspectionAnglePhotos = { ...order.checklist.anglePhotosBefore };
        INSPECTION_ANGLES.forEach(a => {
          if (cleanedAngles[a.key] === removedUrl) {
            delete cleanedAngles[a.key];
          }
        });
        nextChecklist = { ...order.checklist, anglePhotosBefore: cleanedAngles };
      }
      updateOrder({ ...order, photosBefore: nextBefore, checklist: nextChecklist });
    } else {
      updateOrder({ ...order, photosAfter: order.photosAfter.filter((_, i) => i !== index) });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const moneyBR = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const buildWhatsAppReceiptUrl = () => {
    const msg =
      `*PK DETAIL — COMPROVANTE DA ORDEM DE SERVIÇO ${order.id}*\n\n` +
      `Olá ${order.clientName}!\n` +
      `Moto: ${order.motorcycleBrand} ${order.motorcycleModel} (Placa: ${order.motorcyclePlate})\n` +
      `Status do Serviço: ${getStatusLabel(order.status).toUpperCase()}\n\n` +
      `*Serviços:* \n` +
      order.services.map(s => `• ${s.serviceName}: ${moneyBR(s.price)}`).join('\n') +
      `\n\n*Total:* ${moneyBR(order.total)}\n` +
      `*Valor Pago:* ${moneyBR(order.amountPaid)}\n` +
      `*Saldo Restante:* ${moneyBR(order.pendingBalance)}\n\n` +
      `Agradecemos a preferência pela PK Detail!`;

    return buildWhatsappLink(order.clientWhatsapp || order.clientPhone, msg);
  };

  const formatDateTimeBR = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${formatDateBR(getLocalDateKey(iso))} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <div
      {...overlayProps}
      className="print-root-reset fixed inset-x-0 top-0 z-50 w-full h-[var(--vvh,100dvh)] bg-[#F1F5F9] flex flex-col overflow-hidden"
    >
      <div
        {...modalProps}
        className="print-root-reset w-full h-full flex flex-col overflow-hidden"
      >
        {/* TOP FULL-SCREEN TOOLBAR (Hidden on Print) */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 shrink-0">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Left: back button + OS identity */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Voltar</span>
                </button>

                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                      Ordem de Serviço
                    </h1>
                    <span className="font-mono text-[10.5px] font-black bg-[#EA580C] text-white px-2.5 py-1 rounded-lg shrink-0 tracking-wide leading-none">
                      {order.id}
                    </span>
                  </div>
                  <p className="text-[11.5px] sm:text-xs text-slate-500 mt-2 truncate">
                    {order.clientName} · {order.motorcycleBrand} {order.motorcycleModel} ·{' '}
                    <span className="font-mono font-semibold text-slate-600">{order.motorcyclePlate}</span>
                  </p>
                </div>
              </div>

              {/* Right: status + WhatsApp + print */}
              <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto">
                {order.status !== 'cancelado' && (
                  <select
                    aria-label="Status da OS"
                    value={order.status}
                    onChange={e => handleRequestStatusChange(e.target.value as OSStatus)}
                    className="min-h-[42px] flex-1 lg:flex-none lg:w-[150px] px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold focus:border-[#EA580C] focus:outline-hidden"
                  >
                    <option value="para_fazer">Aguardando</option>
                    <option value="em_servico">Em Serviço</option>
                    <option value="concluido">Concluído</option>
                    <option value="entregue">Entregue</option>
                  </select>
                )}

                <a
                  href={buildWhatsAppReceiptUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Enviar comprovante no WhatsApp"
                  className="min-w-[42px] min-h-[42px] rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 flex items-center justify-center transition shrink-0"
                  title="Enviar comprovante no WhatsApp"
                >
                  <MessageCircle className="w-[18px] h-[18px] text-[#25D366] shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="min-h-[42px] flex-1 lg:flex-none px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs transition whitespace-nowrap shrink-0"
                  title="Imprimir ou Salvar como PDF"
                >
                  <Printer className="w-[18px] h-[18px] shrink-0" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* View mode tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-auto sm:inline-flex">
              <button
                type="button"
                onClick={() => setViewMode('workspace')}
                className={`min-h-[38px] flex-1 sm:flex-none px-3.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap ${
                  viewMode === 'workspace'
                    ? 'bg-white border border-[#EA580C] text-slate-900 shadow-xs'
                    : 'border border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>Gestão (Tela Inteira)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`min-h-[38px] flex-1 sm:flex-none px-3.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap ${
                  viewMode === 'pdf'
                    ? 'bg-white border border-[#EA580C] text-slate-900 shadow-xs'
                    : 'border border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Visualizar PDF (A4)</span>
              </button>
            </div>
          </div>
        </header>

        {/* FULL-SCREEN INTERACTIVE WORKSPACE MODE (Hidden on Print) */}
        {viewMode === 'workspace' && (
          <div className="no-print flex-1 overflow-y-auto pk-scroll-compact modal-responsive-scroll bg-[#F1F5F9]">
            <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-5 pk-section-stack">
              {/* Workflow Stepper Strip */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Andamento da Ordem de Serviço
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                        Entrada: {formatDateTimeBR(order.entryDateTime)}
                      </span>
                      {order.promisedDateTime && (
                        <span>Previsão: {formatDateTimeBR(order.promisedDateTime)}</span>
                      )}
                    </p>
                  </div>

                  {order.status === 'para_fazer' && (
                    <button
                      type="button"
                      onClick={() => setShowStartInspection(true)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      <span>Iniciar Serviço (Checklist & 4 Fotos)</span>
                    </button>
                  )}
                </div>

                <div className="px-5 py-4">
                  {order.status === 'cancelado' ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Esta Ordem de Serviço foi cancelada</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {OS_STEPS.map((step, idx) => {
                        const isDone = currentStepIndex > idx;
                        const isActive = currentStepIndex === idx;
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => handleRequestStatusChange(step.id)}
                            className={`min-h-[46px] px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                              isActive
                                ? 'bg-[#EA580C] border-[#EA580C] text-white shadow-xs'
                                : isDone
                                  ? 'bg-[#FFEDD5] border-[#F97316]/40 text-[#9A3412]'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                isActive
                                  ? 'bg-white text-[#EA580C]'
                                  : isDone
                                    ? 'bg-[#9A3412] text-white'
                                    : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                            </span>
                            <span className="text-xs font-bold truncate">{step.short}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Main 12-Column Full-Screen Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap items-start">
                {/* LEFT 8 COLUMNS: Client, Moto, Services, Checklist, Photos */}
                <div className="lg:col-span-8 pk-section-stack min-w-0">
                  {/* Client & Motorcycle Specification Panel */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                      {/* Client Info */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          <User className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                          <span>Dados do Cliente</span>
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-slate-900">{order.clientName}</h2>
                          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                            <p className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Telefone: <strong className="text-slate-800">{order.clientPhone}</strong></span>
                            </p>
                            <p className="flex items-center gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                              <span>WhatsApp: <strong className="text-slate-800">{order.clientWhatsapp || order.clientPhone}</strong></span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Detailer Responsável: <strong className="text-slate-800">{order.assignedEmployeeName}</strong></span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Motorcycle Info */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            <Bike className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                            <span>Motocicleta</span>
                          </div>
                          {/* Brazilian Plate Badge */}
                          <div className="inline-flex flex-col border-2 border-slate-900 rounded-md overflow-hidden bg-white shadow-2xs shrink-0">
                            <div className="bg-blue-700 text-white text-[7px] font-black tracking-widest text-center px-2 py-0.5 leading-none">
                              BRASIL
                            </div>
                            <span className="px-2.5 py-0.5 font-mono font-black text-xs text-slate-900 tracking-wider leading-tight">
                              {order.motorcyclePlate}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-lg font-black text-slate-900">
                            {order.motorcycleBrand} {order.motorcycleModel}
                          </h2>
                          {(order.motorcycleVersion || order.motorcycleYear || order.motorcycleCategory) && (
                            <p className="text-xs font-semibold text-slate-600 mt-0.5">
                              {[order.motorcycleVersion, order.motorcycleYear ? `Ano ${order.motorcycleYear}` : null, order.motorcycleCategory]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                            {order.checklist?.fuelLevel && (
                              <span className="inline-flex items-center gap-1.5">
                                <Fuel className="w-3.5 h-3.5 text-slate-400" />
                                Combustível: <strong className="text-slate-800">{order.checklist.fuelLevel}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services Table & Insumos */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#EA580C]" />
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Serviços & Procedimentos ({order.services.length})
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        Tempo total estimado: {totalEstimatedMins} min
                      </span>
                    </div>

                    {/* Mobile view */}
                    <div className="sm:hidden divide-y divide-slate-100">
                      {order.services.map((s, idx) => (
                        <div key={idx} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold text-slate-400 mr-1.5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-slate-900 wrap-anywhere">{s.serviceName}</span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              Duração estimada: {s.estimatedMinutes} min
                            </span>
                          </div>
                          <span className="font-mono font-black text-slate-900 text-sm tabular-nums shrink-0">
                            R$ {s.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto pk-scroll-compact">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-5 w-14">#</th>
                            <th className="py-3 px-5">Serviço / Detalhamento</th>
                            <th className="py-3 px-5 text-center">Tempo Est.</th>
                            <th className="py-3 px-5 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {order.services.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-3.5 px-5 font-mono font-bold text-slate-400">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="py-3.5 px-5 font-bold text-slate-900">{s.serviceName}</td>
                              <td className="py-3.5 px-5 text-center text-slate-600 tabular-nums">
                                {s.estimatedMinutes} min
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-black text-slate-900 tabular-nums">
                                R$ {s.price.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                          <tr>
                            <td colSpan={3} className="py-3.5 px-5 text-right text-slate-600">
                              Subtotal dos Serviços
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono text-sm font-black text-slate-900 tabular-nums">
                              R$ {order.subtotal.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {order.productsConsumed && order.productsConsumed.length > 0 && (
                      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-600 mr-1">
                          <Package className="w-3.5 h-3.5 text-[#EA580C]" />
                          Insumos aplicados:
                        </span>
                        {order.productsConsumed.map((pc, idx) => (
                          <span
                            key={idx}
                            className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-medium"
                          >
                            {pc.productName}: <strong className="font-mono">{pc.quantity} {pc.unit}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checklist Digital & Notes (Always visible & Inline Editable) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-[#EA580C] shrink-0" />
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Inspeção Digital & Observações Técnicas
                        </h3>
                      </div>

                      {!isEditingChecklist ? (
                        <button
                          type="button"
                          onClick={handleOpenChecklistEdit}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                          <span>Editar Checklist</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingChecklist(false)}
                            className="min-h-[34px] px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveChecklistEdit}
                            className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                          >
                            <Save className="w-3.5 h-3.5 shrink-0" />
                            <span>Salvar Checklist</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingChecklist && draftChecklist ? (
                      <EditableChecklistEditor
                        checklist={draftChecklist}
                        onChange={setDraftChecklist}
                      />
                    ) : (
                      <>
                        {order.checklist?.accessoriesLeft && order.checklist.accessoriesLeft.length > 0 && (
                          <div className="text-xs text-slate-700 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
                            <strong>Pertences / Acessórios deixados:</strong>{' '}
                            {order.checklist.accessoriesLeft.join(' · ')}
                          </div>
                        )}

                        {order.checklist?.items && order.checklist.items.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {order.checklist.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                              >
                                <span className="font-semibold text-slate-800 truncate">{it.item}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                    it.entryStatus === 'ok'
                                      ? 'bg-[#FFEDD5] text-[#9A3412]'
                                      : it.entryStatus === 'avaria'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {it.entryStatus.toUpperCase()}
                                  {it.notes ? ` · ${it.notes}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">
                            Nenhum item de checklist registrado ainda. Clique em "Editar Checklist" para preencher.
                          </p>
                        )}

                        {(order.checklist?.entryNotes || order.notes) && (
                          <div className="space-y-1 pt-2 border-t border-slate-100 text-xs text-slate-600">
                            {order.checklist?.entryNotes && (
                              <p>
                                <strong>Observações de Entrada:</strong> {order.checklist.entryNotes}
                              </p>
                            )}
                            {order.notes && (
                              <p>
                                <strong>Notas da OS:</strong> {order.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Photographic Record */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Registro Fotográfico (Antes & Depois)
                        </h3>
                        <span className="text-xs font-semibold text-[#EA580C]">
                          Vistoria Antes: {countCapturedAngles(order.checklist?.anglePhotosBefore)}/4 ângulos obrigatórios · Visível no Portal do Cliente
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleFourAngleEditor}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                          showFourAngleEditor
                            ? 'bg-slate-900 text-white'
                            : 'bg-[#FFEDD5] hover:bg-[#FED7AA] text-[#9A3412] border border-[#F97316]/40'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {showFourAngleEditor
                            ? 'Fechar Painel 4 Ângulos'
                            : 'Vistoria 4 Ângulos (Antes)'}
                        </span>
                      </button>
                    </div>

                    {showFourAngleEditor ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <FourAnglePhotoStep
                          anglePhotos={draftAnglePhotos}
                          extraPhotos={draftExtraBeforePhotos}
                          onChangeAnglePhotos={setDraftAnglePhotos}
                          onChangeExtraPhotos={setDraftExtraBeforePhotos}
                        />
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setShowFourAngleEditor(false)}
                            className="min-h-[38px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFourAngles}
                            className="min-h-[38px] px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar Fotos dos 4 Ângulos</span>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {order.photosBefore.length === 0 && order.photosAfter.length === 0 ? (
                      <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                        Nenhuma foto capturada ainda. Use "Vistoria 4 Ângulos (Antes)" ou a câmera abaixo.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {order.photosBefore.map((url, i) => {
                          const label = getBeforePhotoLabel(url, i);
                          return (
                            <div
                              key={`bf_${i}`}
                              className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video group bg-slate-100"
                            >
                              <img
                                src={url}
                                alt={label}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onClick={() => setZoomedPhoto({ url, label })}
                                className="w-full h-full object-cover cursor-pointer"
                              />
                              <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                                {label}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto('before', i)}
                                aria-label="Remover foto antes"
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                        {order.photosAfter.map((url, i) => (
                          <div
                            key={`af_${i}`}
                            className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video group bg-slate-100"
                          >
                            <img
                              src={url}
                              alt={`Depois ${i + 1}`}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onClick={() => setZoomedPhoto({ url, label: 'Foto Depois do Serviço' })}
                              className="w-full h-full object-cover cursor-pointer"
                            />
                            <span className="absolute bottom-1.5 left-1.5 bg-[#EA580C] text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                              Depois
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto('after', i)}
                              aria-label="Remover foto depois"
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <CameraPhotoCapture onPhotoCaptured={handlePhotoCaptured} />
                  </div>
                </div>

                {/* RIGHT 4 COLUMNS: Financial Panel, Payments & PDF Shortcut */}
                <div className="lg:col-span-4 pk-section-stack lg:sticky lg:top-4 min-w-0">
                  {/* Executive Financial Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Resumo Financeiro
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                          order.pendingBalance === 0
                            ? 'bg-[#FFEDD5] text-[#9A3412] border border-[#F97316]/40'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {getPaymentStatusLabel(order.paymentStatus)}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs tabular-nums">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Subtotal Serviços</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          R$ {order.subtotal.toFixed(2)}
                        </span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex items-center justify-between text-amber-600">
                          <span>Desconto Aplicado</span>
                          <span className="font-mono font-bold tabular-nums">
                            - R$ {order.discount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {order.addition > 0 && (
                        <div className="flex items-center justify-between text-blue-600">
                          <span>Acréscimo</span>
                          <span className="font-mono font-bold tabular-nums">
                            + R$ {order.addition.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3.5 border-t border-slate-200 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        Total da O.S.
                      </span>
                      <span className="text-3xl font-black font-mono text-[#F97316] tabular-nums">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </div>

                    {/* Payment Progress */}
                    <div className="space-y-1.5">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ transform: `scaleX(${Math.max(0, Math.min(1, paidPct / 100))})` }}
                          className="w-full h-full bg-[#EA580C] rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-slate-600">
                          Pago: <strong className="text-slate-900 font-mono">R$ {order.amountPaid.toFixed(2)}</strong> ({paidPct}%)
                        </span>
                        <span className={order.pendingBalance === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          {order.pendingBalance === 0
                            ? 'Quitado'
                            : `Falta: R$ ${order.pendingBalance.toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {order.pendingBalance > 0 && !showPaymentForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(order.pendingBalance);
                          setShowPaymentForm(true);
                        }}
                        className="w-full min-h-[42px] py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Registrar Pagamento</span>
                      </button>
                    )}

                    {showPaymentForm && (
                      <form onSubmit={handleAddPayment} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Novo Recebimento</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(Number((order.pendingBalance / 2).toFixed(2)))}
                              className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(order.pendingBalance)}
                              className="px-2 py-0.5 rounded bg-[#EA580C] text-[10px] font-bold"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={paymentAmount || ''}
                            onChange={e => setPaymentAmount(Number(e.target.value))}
                            placeholder="Valor R$"
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-2 font-mono font-bold"
                          />
                          <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-2 font-bold"
                          >
                            <option value="pix">PIX</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="debito">Débito</option>
                            <option value="credito">Crédito</option>
                            <option value="transferencia">Transferência</option>
                          </select>
                        </div>

                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={e => setPaymentNotes(e.target.value)}
                          placeholder="Observação (ex: Sinal / Retirada)"
                          className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-2.5 py-2"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className="py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold"
                          >
                            Confirmar R$ {paymentAmount.toFixed(2)}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Payment Transactions Timeline */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                        Pagamentos Confirmados ({order.paymentTransactions.length})
                      </h3>
                      <DollarSign className="w-4 h-4 text-[#EA580C]" />
                    </div>

                    {order.paymentTransactions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        Nenhum pagamento registrado até o momento.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {order.paymentTransactions.map(tx => (
                          <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block">
                                {METHOD_LABELS[tx.method]}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {formatDateTimeBR(tx.date)} · {tx.operatorName}
                              </span>
                              {tx.notes && (
                                <span className="text-[11px] text-slate-400 block truncate">{tx.notes}</span>
                              )}
                            </div>
                            <span className="font-mono font-black text-[#EA580C] text-sm tabular-nums shrink-0">
                              + R$ {tx.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PDF Document Quick Actions */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                      Documento Oficial & Impressão (A4)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Visualize a folha oficial em formato A4 antes de imprimir ou gerar o PDF para entrega ao cliente.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('pdf')}
                        className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Prévia A4</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Gerar PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OFFICIAL A4 PDF DOCUMENT (Visible on screen when viewMode === 'pdf', ALWAYS printed cleanly!) */}
        <div
          className={
            viewMode === 'pdf'
              ? 'print-root-reset flex-1 overflow-y-auto pk-scroll-compact bg-slate-200/80 py-4 sm:py-6 px-2.5 sm:px-6 print:p-0 print:bg-white'
              : 'hidden print:block print-root-reset'
          }
        >
          {viewMode === 'pdf' && (
            <div className="no-print max-w-[210mm] mx-auto mb-3 bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-500 mr-1">Modelo de Documento:</span>
                {(['Ordem de Serviço', 'Orçamento', 'Recibo / Comprovante', 'Documento de Atendimento'] as const).map(docOpt => (
                  <button
                    key={docOpt}
                    type="button"
                    onClick={() => setPdfDocType(docOpt)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      pdfDocType === docOpt
                        ? 'bg-[#EA580C] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {docOpt}
                  </button>
                ))}
              </div>

            </div>
          )}

          <div className="print-container print-root-reset w-full max-w-[210mm] mx-auto bg-white text-slate-900 rounded-xl shadow-xl border border-slate-300/80 print:shadow-none print:border-none print:rounded-none print:max-w-none overflow-hidden">
            <div className="p-5 sm:p-7 print:p-0 print:pt-2.5 space-y-3.5 print:space-y-3 text-left">
              {/* Cabeçalho oficial: sempre com a identidade atual da empresa (Minha Empresa) */}
              <PrintableDocumentHeader
                documentTypeLabel={pdfDocType}
                documentCode={order.id}
                issuedAt={order.entryDateTime}
                badges={[
                  { label: getStatusLabel(order.status), dark: true },
                  { label: getPaymentStatusLabel(order.paymentStatus), dark: false },
                ]}
              />

              {/* Bloco 1: Cliente e Motocicleta */}
              <div className="border border-slate-300 rounded-xl overflow-hidden print-avoid-break">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-xs">
                  <div className="p-3.5 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      01. Identificação do Cliente
                    </span>
                    <p className="text-sm font-black text-slate-900">{order.clientName}</p>
                    <p className="text-slate-700">
                      <strong>Telefone:</strong> {order.clientPhone}
                    </p>
                    <p className="text-slate-700">
                      <strong>WhatsApp:</strong> {order.clientWhatsapp || order.clientPhone}
                    </p>
                    <p className="text-slate-700">
                      <strong>Consultor / Detailer:</strong> {order.assignedEmployeeName}
                    </p>
                  </div>

                  <div className="p-3.5 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      02. Identificação da Motocicleta
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {order.motorcycleBrand} {order.motorcycleModel}
                    </p>
                    {(order.motorcycleVersion || order.motorcycleYear || order.motorcycleCategory) && (
                      <p className="text-[11px] font-semibold text-slate-600">
                        {[order.motorcycleVersion, order.motorcycleYear ? `Ano ${order.motorcycleYear}` : null, order.motorcycleCategory]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p className="text-slate-700">
                      <strong>Placa:</strong>{' '}
                      <span className="font-mono font-black text-slate-900 border border-slate-400 px-1.5 py-0.5 rounded bg-slate-50">
                        {order.motorcyclePlate}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-700">
                      {order.checklist?.fuelLevel && (
                        <span>
                          <strong>Combustível:</strong> {order.checklist.fuelLevel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Tabela Oficial de Serviços */}
              <div className="space-y-1.5 print-avoid-break">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600 block">
                  03. Serviços Executados & Especificação
                </span>
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead
                      className="font-bold uppercase text-[10px] tracking-wider"
                      style={{ backgroundColor: documentColor, color: documentTextOnAccent }}
                    >
                      <tr>
                        <th className="py-2 px-3 w-10">#</th>
                        <th className="py-2 px-3">Descrição do Serviço</th>
                        <th className="py-2 px-3 text-center">Tempo Est.</th>
                        <th className="py-2 px-3 text-right">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {order.services.map((s, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-500">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            <span className="block">{s.serviceName}</span>
                            {showServiceDescriptions && serviceDescriptionById.get(s.serviceId) && (
                              <span className="block text-[10px] font-medium text-slate-500 leading-snug mt-0.5">
                                {serviceDescriptionById.get(s.serviceId)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 tabular-nums">
                            {s.estimatedMinutes} min
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            R$ {s.price.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.productsConsumed && order.productsConsumed.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-300 text-[11px] text-slate-700">
                    <strong className="uppercase text-[10px] text-slate-500 mr-2">Insumos Utilizados:</strong>
                    {order.productsConsumed.map((pc, idx) => (
                      <span key={idx}>
                        {idx > 0 ? ' · ' : ''}
                        {pc.productName} ({pc.quantity} {pc.unit})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloco 3: Inspeção Digital & Avarias Preexistentes */}
              {order.checklist && (
                <div className="space-y-1.5 print-avoid-break">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600 block">
                    04. Inspeção Técnica & Checklist de Entrada
                  </span>
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 text-xs space-y-2">
                    {order.checklist.accessoriesLeft && order.checklist.accessoriesLeft.length > 0 && (
                      <p className="text-slate-700">
                        <strong>Acessórios / Pertences Deixados:</strong>{' '}
                        {order.checklist.accessoriesLeft.join(', ')}
                      </p>
                    )}

                    {order.checklist.items && order.checklist.items.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {order.checklist.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-1 bg-white px-2.5 py-1 rounded border border-slate-200 text-[11px]"
                          >
                            <span className="font-medium text-slate-800 truncate">{it.item}</span>
                            <span className="font-bold uppercase text-[10px] text-slate-700 shrink-0">
                              {it.entryStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(order.checklist.entryNotes || order.notes) && (
                      <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                        <strong>Observações:</strong>{' '}
                        {[order.checklist.entryNotes, order.notes].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Bloco 4: Pagamentos & Totais */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch print-avoid-break">
                {/* Payment History */}
                <div className="sm:col-span-7 border border-slate-300 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    05. Histórico de Pagamentos
                  </span>
                  {order.paymentTransactions.length === 0 ? (
                    <p className="text-xs text-slate-500 py-1.5">
                      Nenhum pagamento registrado até a emissão deste documento.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 text-xs">
                      {order.paymentTransactions.map(tx => (
                        <div key={tx.id} className="py-1 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900">
                              {METHOD_LABELS[tx.method]}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {formatDateTimeBR(tx.date)} · {tx.operatorName}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            R$ {tx.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Official Totals Box */}
                <div className="sm:col-span-5 border-2 border-slate-900 rounded-xl p-3.5 bg-slate-50 flex flex-col justify-between space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        R$ {order.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span>Desconto</span>
                        <span className="font-mono font-bold tabular-nums">
                          - R$ {order.discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {order.addition > 0 && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span>Acréscimo</span>
                        <span className="font-mono font-bold tabular-nums">
                          + R$ {order.addition.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t-2 border-slate-900 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="font-black uppercase text-slate-900">Total Geral</span>
                      <span
                        className="text-lg font-black font-mono tabular-nums"
                        style={{ color: documentAccentText }}
                      >
                        R$ {order.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-700 tabular-nums">
                      <span>Total Pago: <strong>R$ {order.amountPaid.toFixed(2)}</strong></span>
                      <span className="font-bold">
                        {order.pendingBalance === 0
                          ? 'QUITADO'
                          : `Pendente: R$ ${order.pendingBalance.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloco 5: Fotos (se houver) */}
              {(order.photosBefore.length > 0 || order.photosAfter.length > 0) && (
                <div className="space-y-1.5 print-avoid-break">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600 block">
                    06. Registro Fotográfico
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {order.photosBefore.slice(0, 6).map((url, i) => {
                      const label = getBeforePhotoLabel(url, i);
                      return (
                        <div key={`pbf_${i}`} className="border border-slate-300 rounded-lg overflow-hidden">
                          <img
                            src={url}
                            alt={label}
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-20 print:h-16 object-cover"
                          />
                          <span className="block text-[9px] font-bold uppercase text-center py-0.5 bg-slate-100 text-slate-700">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                    {order.photosAfter.slice(0, 4).map((url, i) => (
                      <div key={`paf_${i}`} className="border border-slate-300 rounded-lg overflow-hidden">
                        <img
                          src={url}
                          alt={`Depois ${i + 1}`}
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-20 print:h-16 object-cover"
                        />
                        <span className="block text-[9px] font-bold uppercase text-center py-0.5 bg-[#FFEDD5] text-[#9A3412]">
                          Depois #{i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rodapé Compacto: Informações de Contato da Empresa & Data de Emissão */}
              <footer className="pt-2.5 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[9.5px] leading-snug text-slate-600 print-avoid-break">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-bold text-slate-800">
                    {companyDisplayName(settings)}
                    {settings.phone ? ` · Tel: ${settings.phone}` : ''}
                    {settings.whatsapp && settings.whatsapp !== settings.phone
                      ? ` · WhatsApp: ${settings.whatsapp}`
                      : ''}
                    {settings.email ? ` · ${settings.email}` : ''}
                  </p>
                  {(settings.address || settings.city) && (
                    <p className="text-slate-500">
                      {[settings.address, settings.city].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </div>

                <div className="sm:text-right shrink-0 tabular-nums">
                  <span className="block font-bold text-slate-700">
                    Data de emissão: {formatDateTimeBR(new Date().toISOString())}
                  </span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Preview */}
      <ResponsiveModal
        isOpen={Boolean(zoomedPhoto)}
        onClose={() => setZoomedPhoto(null)}
        title={zoomedPhoto?.label || 'Foto da OS'}
        maxWidth="2xl"
      >
        {zoomedPhoto && (
          <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
            <img
              src={zoomedPhoto.url}
              alt={zoomedPhoto.label}
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full max-h-[65vh] object-contain"
            />
          </div>
        )}
      </ResponsiveModal>

      {/* Pre-Service Checklist & 4-Angle Inspection Modal */}
      <StartServiceInspectionModal
        order={showStartInspection ? order : null}
        onClose={() => setShowStartInspection(false)}
      />
    </div>
  );
};
