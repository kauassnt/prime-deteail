import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  InspectionAnglePhotos,
  InspectionChecklist,
  ServiceOrder
} from '../../types';
import {
  DEFAULT_CHECKLIST_ITEMS,
  EditableChecklistEditor,
  FourAnglePhotoStep,
  countCapturedAngles,
  getMissingAngles,
  mergeInspectionPhotosIntoBefore,
  splitOrderBeforePhotos
} from './InspectionWorkflowSteps';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import {
  X,
  ClipboardCheck,
  Camera,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Bike
} from 'lucide-react';

interface StartServiceInspectionModalProps {
  order: ServiceOrder | null;
  onClose: () => void;
  onStarted?: () => void;
}

export const StartServiceInspectionModal: React.FC<StartServiceInspectionModalProps> = ({
  order,
  onClose,
  onStarted,
}) => {
  const { updateOrder, updateOrderStatus, currentUser } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [checklist, setChecklist] = useState<InspectionChecklist>({
    entryDate: new Date().toISOString(),
    fuelLevel: '1/2',
    items: DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i })),
    accessoriesLeft: [],
  });
  const [anglePhotos, setAnglePhotos] = useState<InspectionAnglePhotos>({});
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [showMissingPhotosPrompt, setShowMissingPhotosPrompt] = useState(false);

  useEffect(() => {
    if (!order) return;
    const baseChecklist = order.checklist || {
      entryDate: order.entryDateTime || new Date().toISOString(),
      fuelLevel: '1/2' as const,
      items: [],
      accessoriesLeft: [],
    };
    const items =
      baseChecklist.items && baseChecklist.items.length > 0
        ? baseChecklist.items.map(it => ({ ...it }))
        : DEFAULT_CHECKLIST_ITEMS.map(it => ({ ...it }));

    const { anglePhotos: parsedAngles, extraPhotos: parsedExtras } = splitOrderBeforePhotos(
      order.photosBefore || [],
      baseChecklist.anglePhotosBefore
    );

    setChecklist({
      ...baseChecklist,
      items,
      accessoriesLeft: [...(baseChecklist.accessoriesLeft || [])],
      inspectorName: baseChecklist.inspectorName || currentUser.name,
    });
    setAnglePhotos(parsedAngles);
    setExtraPhotos(parsedExtras);
    setStep(1);
    setShowMissingPhotosPrompt(false);
  }, [order, currentUser.name]);

  const { overlayProps, modalProps } = useModalResponsive({
    isOpen: Boolean(order),
    onClose,
    closeOnOverlayClick: false,
    maxHeight: '100dvh',
    ariaLabel: order ? `Vistoria de Início da ${order.id}` : 'Vistoria de Início',
  });

  if (!order) return null;

  const capturedAngles = countCapturedAngles(anglePhotos);
  const missingAngles = getMissingAngles(anglePhotos);

  const commitStartService = () => {
    const mergedBefore = mergeInspectionPhotosIntoBefore(anglePhotos, extraPhotos);
    updateOrder({
      ...order,
      photosBefore: mergedBefore,
      checklist: {
        ...checklist,
        anglePhotosBefore: anglePhotos,
        inspectorName: checklist.inspectorName || currentUser.name,
      },
    });
    updateOrderStatus(order.id, 'em_servico');
    onClose();
    if (onStarted) onStarted();
  };

  const handleAttemptFinish = () => {
    if (capturedAngles < 4) {
      setShowMissingPhotosPrompt(true);
      return;
    }
    commitStartService();
  };

  return (
    <div
      {...overlayProps}
      className="fixed inset-x-0 top-0 z-50 h-[var(--vvh,100dvh)] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden pk-fade-enter"
    >
      <div
        {...modalProps}
        className="w-full h-full sm:h-auto sm:max-h-[min(92dvh,calc(var(--vvh,100dvh)-24px))] sm:max-w-5xl bg-white sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pk-modal-enter"
      >
        {/* Top Header */}
        <header className="pk-modal-header bg-[#171717] text-white flex items-center justify-between gap-2.5 shrink-0 safe-area-top">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300 font-mono">
                <span className="font-bold text-[#F97316]">{order.id}</span>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-white">{order.motorcyclePlate}</span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                Vistoria Obrigatória Antes de Iniciar Serviço — {order.clientName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar vistoria"
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2-Step Stepper Bar */}
        <div className="px-3 sm:px-5 py-2 bg-slate-100 border-b border-slate-200 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowMissingPhotosPrompt(false);
              setStep(1);
            }}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
              step === 1
                ? 'bg-white border-[#EA580C] text-[#9A3412] shadow-2xs'
                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span className="truncate">Etapa 1: Editar Checklist ({checklist.items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
              step === 2
                ? 'bg-white border-[#EA580C] text-[#9A3412] shadow-2xs'
                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span className="truncate tabular-nums">
              Etapa 2: Fotos Antes ({capturedAngles}/4)
            </span>
          </button>
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto pk-scroll-compact pk-modal-body modal-responsive-scroll">
          {step === 1 && (
            <EditableChecklistEditor checklist={checklist} onChange={setChecklist} />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <FourAnglePhotoStep
                anglePhotos={anglePhotos}
                extraPhotos={extraPhotos}
                onChangeAnglePhotos={next => {
                  setAnglePhotos(next);
                  setShowMissingPhotosPrompt(false);
                }}
                onChangeExtraPhotos={setExtraPhotos}
              />

              {showMissingPhotosPrompt && missingAngles.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold">
                        Faltam {missingAngles.length} foto(s) dos 4 ângulos recomendados antes do serviço:
                      </p>
                      <p className="text-amber-900 font-semibold">
                        {missingAngles.map(a => a.label).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMissingPhotosPrompt(false)}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold hover:bg-amber-100 transition"
                    >
                      Completar Fotos Agora
                    </button>
                    <button
                      type="button"
                      onClick={commitStartService}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-[#9A3412] hover:bg-[#EA580C] text-white font-bold transition"
                    >
                      Iniciar Serviço Mesmo Assim
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <footer className="px-3.5 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 safe-area-bottom">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition"
              >
                <span>Avançar para 4 Fotos de Vistoria</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowMissingPhotosPrompt(false);
                  setStep(1);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Voltar para Checklist</span>
              </button>

              <button
                type="button"
                onClick={handleAttemptFinish}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Confirmar Vistoria e Iniciar Serviço</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};
