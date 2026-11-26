import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChecklistItemStatus,
  InspectionAnglePhotos,
  InspectionChecklist,
  InspectionPhotoAngle
} from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import {
  Camera,
  Upload,
  RotateCcw,
  Check,
  X,
  SwitchCamera,
  AlertCircle,
  Trash2,
  Plus,
  Fuel,
  ClipboardCheck,
  Bike,
  CheckCircle2
} from 'lucide-react';

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItemStatus[] = [
  { item: 'Tanque de combustível', entryStatus: 'ok', exitStatus: 'limpo' },
  { item: 'Carenagens laterais & Bico', entryStatus: 'ok', exitStatus: 'limpo' },
  { item: 'Balança traseira & Chassi', entryStatus: 'sujo', exitStatus: 'limpo' },
  { item: 'Rodas dianteira e traseira', entryStatus: 'sujo', exitStatus: 'limpo' },
  { item: 'Escapamento & Ponteira', entryStatus: 'ok', exitStatus: 'limpo' },
  { item: 'Banco e Costuras', entryStatus: 'ok', exitStatus: 'limpo' },
  { item: 'Painel e Retrovisores', entryStatus: 'ok', exitStatus: 'limpo' },
  { item: 'Corrente & Coroa', entryStatus: 'sujo', exitStatus: 'limpo' },
];

export const DEFAULT_ACCESSORIES = [
  'Capacete',
  'Chave reserva',
  'Chaveiro Original',
  'Suporte Celular',
  'Baú Traseiro',
  'Antena Corta-Pipa',
];

export const INSPECTION_ANGLES: {
  key: InspectionPhotoAngle;
  order: string;
  label: string;
  hint: string;
}[] = [
  {
    key: 'dianteira',
    order: '01',
    label: 'Dianteira',
    hint: 'Farol, para-lama, suspensão dianteira, retrovisores e painel',
  },
  {
    key: 'traseira',
    order: '02',
    label: 'Traseira',
    hint: 'Lanterna, rabeta, placa, pneu traseiro e suporte de baú',
  },
  {
    key: 'lado_esquerdo',
    order: '03',
    label: 'Lado Esquerdo',
    hint: 'Carenagem esquerda, motor, corrente, coroa e pedaleiras',
  },
  {
    key: 'lado_direito',
    order: '04',
    label: 'Lado Direito',
    hint: 'Carenagem direita, escapamento, tampas do motor e freio',
  },
];

export function countCapturedAngles(anglePhotos?: InspectionAnglePhotos): number {
  if (!anglePhotos) return 0;
  return INSPECTION_ANGLES.filter(a => Boolean(anglePhotos[a.key])).length;
}

export function getMissingAngles(anglePhotos?: InspectionAnglePhotos) {
  return INSPECTION_ANGLES.filter(a => !anglePhotos?.[a.key]);
}

export function mergeInspectionPhotosIntoBefore(
  anglePhotos?: InspectionAnglePhotos,
  extraPhotos: string[] = []
): string[] {
  const orderedAngles = INSPECTION_ANGLES.map(a => anglePhotos?.[a.key]).filter(
    (v): v is string => Boolean(v)
  );
  const result: string[] = [];
  const seen = new Set<string>();
  for (const url of [...orderedAngles, ...extraPhotos]) {
    if (url && !seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }
  return result;
}

export function splitOrderBeforePhotos(
  photosBefore: string[] = [],
  anglePhotos?: InspectionAnglePhotos
): { anglePhotos: InspectionAnglePhotos; extraPhotos: string[] } {
  const safeAngles: InspectionAnglePhotos = { ...(anglePhotos || {}) };
  const angleSet = new Set(
    INSPECTION_ANGLES.map(a => safeAngles[a.key]).filter((v): v is string => Boolean(v))
  );
  const extraPhotos = photosBefore.filter(url => !angleSet.has(url));
  return { anglePhotos: safeAngles, extraPhotos };
}

const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.78;

function compressImageElement(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number
): string {
  let targetW = srcWidth || 1080;
  let targetH = srcHeight || 720;

  if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
    if (targetW >= targetH) {
      targetH = Math.round((targetH * MAX_DIMENSION) / targetW);
      targetW = MAX_DIMENSION;
    } else {
      targetW = Math.round((targetW * MAX_DIMENSION) / targetH);
      targetH = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

interface EditableChecklistEditorProps {
  checklist: InspectionChecklist;
  onChange: (updated: InspectionChecklist) => void;
}

export const EditableChecklistEditor: React.FC<EditableChecklistEditorProps> = ({
  checklist,
  onChange,
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemStatus, setNewItemStatus] = useState<ChecklistItemStatus['entryStatus']>('ok');
  const [customAccessory, setCustomAccessory] = useState('');

  const items = checklist.items || [];
  const accessoriesLeft = checklist.accessoriesLeft || [];

  const handleUpdateItem = (index: number, patch: Partial<ChecklistItemStatus>) => {
    const next = items.map((it, idx) => (idx === index ? { ...it, ...patch } : it));
    onChange({ ...checklist, items: next });
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    onChange({ ...checklist, items: next });
  };

  const handleAddItem = () => {
    const clean = newItemName.trim();
    if (!clean) return;
    const next: ChecklistItemStatus[] = [
      ...items,
      { item: clean, entryStatus: newItemStatus, exitStatus: 'limpo', notes: '' },
    ];
    onChange({ ...checklist, items: next });
    setNewItemName('');
    setNewItemStatus('ok');
  };

  const handleLoadDefaults = () => {
    const existingNames = new Set(items.map(i => i.item.toLowerCase()));
    const toAdd = DEFAULT_CHECKLIST_ITEMS.filter(d => !existingNames.has(d.item.toLowerCase()));
    onChange({
      ...checklist,
      items: [...items, ...toAdd.map(d => ({ ...d }))],
    });
  };

  const handleToggleAccessory = (acc: string) => {
    const exists = accessoriesLeft.includes(acc);
    const next = exists
      ? accessoriesLeft.filter(a => a !== acc)
      : [...accessoriesLeft, acc];
    onChange({ ...checklist, accessoriesLeft: next });
  };

  const handleAddCustomAccessory = () => {
    const clean = customAccessory.trim();
    if (!clean) return;
    if (!accessoriesLeft.includes(clean)) {
      onChange({ ...checklist, accessoriesLeft: [...accessoriesLeft, clean] });
    }
    setCustomAccessory('');
  };

  const allAccessoryOptions = Array.from(new Set([...DEFAULT_ACCESSORIES, ...accessoriesLeft]));

  return (
    <div className="pk-section-stack text-xs min-w-0 text-left">
      {/* Fuel Level Row */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-800 flex items-center gap-1.5">
          <Fuel className="w-4 h-4 text-[#EA580C] shrink-0" />
          Nível de Combustível na Entrada
        </span>
        <div className="grid grid-cols-3 min-[420px]:grid-cols-5 gap-1.5">
          {(['reserva', '1/4', '1/2', '3/4', 'cheio'] as const).map(lvl => (
            <button
              key={lvl}
              type="button"
              onClick={() => onChange({ ...checklist, fuelLevel: lvl })}
              className={`min-h-[36px] py-1.5 px-2 rounded-xl font-bold text-[11px] uppercase border transition ${
                checklist.fuelLevel === lvl
                  ? 'bg-[#9A3412] text-white border-[#9A3412]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Accessories Left */}
      <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-2.5">
        <span className="font-bold text-slate-800 block">Pertences e Acessórios Deixados</span>
        <div className="flex flex-wrap gap-1.5">
          {allAccessoryOptions.map(acc => {
            const active = accessoriesLeft.includes(acc);
            return (
              <button
                key={acc}
                type="button"
                onClick={() => handleToggleAccessory(acc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? 'bg-[#FFEDD5] border-[#EA580C] text-[#9A3412] font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {acc}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={customAccessory}
            onChange={e => setCustomAccessory(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomAccessory();
              }
            }}
            placeholder="Outro pertence (Ex: Jaqueta, Luva, Trava de disco)..."
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#EA580C] focus:outline-hidden"
          />
          <button
            type="button"
            onClick={handleAddCustomAccessory}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Editable Checklist Items */}
      <div className="bg-white rounded-2xl border border-slate-200 pk-card-pad space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#EA580C] shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Itens da Checklist de Vistoria ({items.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Edite os nomes, marque o estado de entrada, registre avarias ou adicione novas peças.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLoadDefaults}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition whitespace-nowrap"
          >
            + Inserir Itens Padrão
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500 space-y-2">
            <p className="font-semibold">Nenhum item adicionado na checklist ainda.</p>
            <button
              type="button"
              onClick={handleLoadDefaults}
              className="px-3.5 py-2 rounded-xl bg-[#EA580C] text-white font-bold text-xs hover:bg-[#9A3412] transition"
            >
              Carregar Lista Padrão da Moto
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
              >
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={it.item}
                    onChange={e => handleUpdateItem(idx, { item: e.target.value })}
                    placeholder="Nome da peça ou item..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-900 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div className="md:col-span-3">
                  <select
                    value={it.entryStatus}
                    onChange={e =>
                      handleUpdateItem(idx, {
                        entryStatus: e.target.value as ChecklistItemStatus['entryStatus'],
                      })
                    }
                    className={`w-full font-bold px-2.5 py-2 rounded-lg border focus:outline-hidden ${
                      it.entryStatus === 'ok'
                        ? 'bg-[#FFEDD5] text-[#9A3412] border-[#F97316]/40'
                        : it.entryStatus === 'avaria'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : it.entryStatus === 'sujo'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    <option value="ok">OK (Íntegro)</option>
                    <option value="sujo">Sujo / Graxa</option>
                    <option value="avaria">Avaria / Risco</option>
                    <option value="ausente">Ausente</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={it.notes || ''}
                    onChange={e => handleUpdateItem(idx, { notes: e.target.value })}
                    placeholder="Obs. (ex: risco lado dir.)"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>

                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    title="Remover item"
                    aria-label="Remover item da checklist"
                    className="min-w-[34px] min-h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Custom Item */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
              }
            }}
            placeholder="Novo item para vistoriar (Ex: Bolha / Para-brisa, Slider, Baú)..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
          />
          <select
            value={newItemStatus}
            onChange={e => setNewItemStatus(e.target.value as ChecklistItemStatus['entryStatus'])}
            className="sm:w-40 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
          >
            <option value="ok">OK (Íntegro)</option>
            <option value="sujo">Sujo / Graxa</option>
            <option value="avaria">Avaria / Risco</option>
            <option value="ausente">Ausente</option>
          </select>
          <button
            type="button"
            onClick={handleAddItem}
            className="min-h-[38px] px-4 py-2 rounded-xl bg-[#171717] hover:bg-black text-white font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Adicionar Item</span>
          </button>
        </div>
      </div>

      {/* General Inspection Notes */}
      <div className="space-y-1.5">
        <label className="font-bold text-slate-800 block">Observações Gerais da Vistoria de Entrada</label>
        <textarea
          rows={2}
          value={checklist.entryNotes || ''}
          onChange={e => onChange({ ...checklist, entryNotes: e.target.value })}
          placeholder="Descreva riscos preexistentes, peças sensíveis ou pedidos especiais do cliente..."
          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
        />
      </div>
    </div>
  );
};

interface FourAnglePhotoStepProps {
  anglePhotos: InspectionAnglePhotos;
  extraPhotos: string[];
  onChangeAnglePhotos: (next: InspectionAnglePhotos) => void;
  onChangeExtraPhotos: (next: string[]) => void;
}

export const FourAnglePhotoStep: React.FC<FourAnglePhotoStepProps> = ({
  anglePhotos,
  extraPhotos,
  onChangeAnglePhotos,
  onChangeExtraPhotos,
}) => {
  const [cameraTarget, setCameraTarget] = useState<InspectionPhotoAngle | 'extra' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const angleFileInputRefs = useRef<Partial<Record<InspectionPhotoAngle | 'extra', HTMLInputElement | null>>>({});

  const capturedCount = countCapturedAngles(anglePhotos);
  const progressPct = Math.round((capturedCount / 4) * 100);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCameraStream();
      setStreamError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStreamError('Câmera ao vivo indisponível neste navegador. Utilize "Câmera do Celular / Galeria".');
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setStreamError(
          'Não foi possível acessar a câmera ao vivo (verifique permissões). Utilize "Câmera do Celular / Galeria".'
        );
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    if (cameraTarget && !capturedPreview) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [cameraTarget, facingMode, capturedPreview, startCameraStream, stopCameraStream]);

  const handleCloseCamera = useCallback(() => {
    stopCameraStream();
    setCapturedPreview(null);
    setStreamError(null);
    setCameraTarget(null);
  }, [stopCameraStream]);

  const applyPhotoForTarget = (target: InspectionPhotoAngle | 'extra', dataUrl: string) => {
    if (target === 'extra') {
      onChangeExtraPhotos([...extraPhotos, dataUrl]);
    } else {
      onChangeAnglePhotos({ ...anglePhotos, [target]: dataUrl });
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const dataUrl = compressImageElement(video, video.videoWidth, video.videoHeight);
    if (dataUrl) {
      setCapturedPreview(dataUrl);
      stopCameraStream();
    }
  };

  const handleConfirmCaptured = () => {
    if (!capturedPreview || !cameraTarget) return;
    applyPhotoForTarget(cameraTarget, capturedPreview);
    handleCloseCamera();
  };

  const handleFileChange = (target: InspectionPhotoAngle | 'extra', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const compressed = compressImageElement(img, img.naturalWidth, img.naturalHeight);
          if (compressed) {
            applyPhotoForTarget(target, compressed);
          }
        };
        if (typeof reader.result === 'string') {
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const currentAngleMeta =
    cameraTarget && cameraTarget !== 'extra'
      ? INSPECTION_ANGLES.find(a => a.key === cameraTarget)
      : null;

  return (
    <div className="pk-section-stack text-xs min-w-0 text-left">
      {/* Progress Banner */}
      <div className="bg-[#171717] text-white rounded-2xl pk-card-pad space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F97316] block">
              Vistoria Fotográfica de Entrada (Antes do Serviço)
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
              Registre os 4 ângulos da motocicleta antes de iniciar o serviço
            </h3>
          </div>

          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tabular-nums shrink-0 self-start sm:self-auto ${
              capturedCount === 4
                ? 'bg-[#EA580C] text-white'
                : 'bg-white/10 text-neutral-200 border border-white/15'
            }`}
          >
            {capturedCount} de 4 fotos registradas
          </span>
        </div>

        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, progressPct / 100))})` }}
            className="w-full h-full bg-[#EA580C] rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          />
        </div>
      </div>

      {/* 4 Mandatory Angle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 pk-grid-gap">
        {INSPECTION_ANGLES.map(angle => {
          const photoUrl = anglePhotos[angle.key];
          return (
            <div
              key={angle.key}
              className={`rounded-2xl border pk-card-pad space-y-2.5 transition ${
                photoUrl
                  ? 'bg-[#FFFBF7] border-[#EA580C]/50'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-[#9A3412] tabular-nums">
                      {angle.order}.
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">{angle.label}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{angle.hint}</p>
                </div>

                {photoUrl ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFEDD5] text-[#9A3412] text-[10px] font-extrabold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Capturada
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                    Pendente
                  </span>
                )}
              </div>

              {photoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-950">
                  <img
                    src={photoUrl}
                    alt={`Vistoria Antes — ${angle.label}`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Antes · {angle.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...anglePhotos };
                      delete next[angle.key];
                      onChangeAnglePhotos(next);
                    }}
                    aria-label={`Remover foto ${angle.label}`}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="aspect-video rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <Bike className="w-7 h-7 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500">
                    Aguardando foto da {angle.label.toLowerCase()}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPreview(null);
                    setCameraTarget(angle.key);
                  }}
                  className="min-h-[38px] px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span>{photoUrl ? 'Refazer Câmera' : 'Abrir Câmera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => angleFileInputRefs.current[angle.key]?.click()}
                  className="min-h-[38px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>{photoUrl ? 'Trocar Arquivo' : 'Enviar Foto'}</span>
                </button>

                <input
                  ref={el => {
                    angleFileInputRefs.current[angle.key] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => handleFileChange(angle.key, e)}
                  className="hidden"
                  aria-label={`Selecionar foto ${angle.label}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Extra Damage / Detail Photos */}
      <div className="bg-white rounded-2xl border border-slate-200 pk-card-pad space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">
              Fotos Extras de Detalhes ou Avarias (Opcional)
            </h4>
            <p className="text-[11px] text-slate-500">
              Registre riscos próximos, marcas pré-existentes ou detalhes específicos além das 4 fotos principais.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCapturedPreview(null);
                setCameraTarget('extra');
              }}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>Câmera Extra</span>
            </button>

            <button
              type="button"
              onClick={() => angleFileInputRefs.current.extra?.click()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Enviar Extra</span>
            </button>

            <input
              ref={el => {
                angleFileInputRefs.current.extra = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={e => handleFileChange('extra', e)}
              className="hidden"
              aria-label="Selecionar fotos extras de vistoria"
            />
          </div>
        </div>

        {extraPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {extraPhotos.map((url, idx) => (
              <div
                key={`ext_${idx}`}
                className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
              >
                <img
                  src={url}
                  alt={`Detalhe extra ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  Detalhe #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeExtraPhotos(extraPhotos.filter((_, i) => i !== idx))}
                  aria-label="Remover foto extra"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Camera Capture Modal */}
      <ResponsiveModal
        isOpen={Boolean(cameraTarget)}
        onClose={handleCloseCamera}
        title={
          currentAngleMeta
            ? `Foto de Vistoria (Antes) — ${currentAngleMeta.label}`
            : 'Capturar Foto Extra de Vistoria'
        }
        subtitle={currentAngleMeta?.hint || 'Foto adicional anexada ao registro Antes do Serviço'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {streamError ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="wrap-anywhere leading-relaxed">{streamError}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = cameraTarget;
                  handleCloseCamera();
                  if (target) {
                    angleFileInputRefs.current[target]?.click();
                  }
                }}
                className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Usar Câmera Nativa / Galeria do Aparelho</span>
              </button>
            </div>
          ) : capturedPreview ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video flex items-center justify-center">
                <img
                  src={capturedPreview}
                  alt="Pré-visualização da foto de vistoria"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 text-[11px] font-black text-white">
                  {currentAngleMeta ? `ANTES · ${currentAngleMeta.label.toUpperCase()}` : 'ANTES · EXTRA'}
                </span>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCapturedPreview(null)}
                  className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Tirar Outra</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCaptured}
                  className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Confirmar Foto</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/85 text-[11px] font-black text-white">
                  {currentAngleMeta ? `Enquadre: ${currentAngleMeta.label}` : 'Foto Extra'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  <SwitchCamera className="w-4 h-4 shrink-0" />
                  <span>Alternar Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={handleCaptureFrame}
                  className="flex-1 min-w-[160px] min-h-[44px] py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Tirar Foto Agora</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1 transition shrink-0"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveModal>
    </div>
  );
};
