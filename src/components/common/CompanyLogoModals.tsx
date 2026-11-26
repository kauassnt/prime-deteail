import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';

interface LogoSourceSheetProps {
  isOpen: boolean;
  canRemoveLogo: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onPickGallery: () => void;
  onRemove: () => void;
}

/** Folha de opções da logo: tirar foto, escolher da galeria ou remover. */
export const LogoSourceSheet: React.FC<LogoSourceSheetProps> = ({
  isOpen,
  canRemoveLogo,
  onClose,
  onTakePhoto,
  onPickGallery,
  onRemove,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const optionClass =
    'w-full min-h-[46px] px-4 flex items-center gap-3 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-50 transition';

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[var(--vvh,100dvh)] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Logo da empresa"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-slate-200" aria-hidden="true" />
        </div>
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-center text-sm font-bold text-slate-900">Logo da empresa</p>
        </div>
        <div className="py-1">
          <button type="button" onClick={onTakePhoto} className={optionClass}>
            <Camera className="w-4 h-4 text-slate-500" />
            <span>Tirar foto</span>
          </button>
          <button type="button" onClick={onPickGallery} className={optionClass}>
            <ImageIcon className="w-4 h-4 text-slate-500" />
            <span>Escolher da galeria</span>
          </button>
          {canRemoveLogo && (
            <button
              type="button"
              onClick={onRemove}
              className={`${optionClass} text-rose-600`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover foto</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface LogoCropModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  fileName?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const FRAME = 260;
const CIRCLE_INSET = 12;
const OUTPUT = 512;

/** Ajuste da logo: arraste para enquadrar, use o zoom e confirme (recorte quadrado). */
export const LogoCropModal: React.FC<LogoCropModalProps> = ({
  isOpen,
  imageUrl,
  fileName = 'logo.png',
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;
    setNatural({ w: 0, h: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [isOpen, imageUrl]);

  const baseCover = Math.max(FRAME / Math.max(natural.w, 1), FRAME / Math.max(natural.h, 1));
  const displayW = natural.w * baseCover * zoom;
  const displayH = natural.h * baseCover * zoom;
  const maxX = Math.max((displayW - FRAME) / 2, 0);
  const maxY = Math.max((displayH - FRAME) / 2, 0);
  const clampedX = Math.min(Math.max(offset.x, -maxX), maxX);
  const clampedY = Math.min(Math.max(offset.y, -maxY), maxY);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ponteiros sintéticos/antigos podem não suportar captura
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: clampedX, offsetY: clampedY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextX = drag.offsetX + (e.clientX - drag.startX);
    const nextY = drag.offsetY + (e.clientY - drag.startY);
    setOffset({
      x: Math.min(Math.max(nextX, -maxX), maxX),
      y: Math.min(Math.max(nextY, -maxY), maxY),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // O recorte acompanha a guia redonda: só o círculo é exportado (cantos transparentes).
    const ratio = OUTPUT / (FRAME - CIRCLE_INSET * 2);
    const drawW = displayW * ratio;
    const drawH = displayH * ratio;
    const drawX = (OUTPUT - drawW) / 2 + clampedX * ratio;
    const drawY = (OUTPUT - drawH) / 2 + clampedY * ratio;
    ctx.clearRect(0, 0, OUTPUT, OUTPUT);
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2 - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
    canvas.toBlob(blob => {
      if (!blob) return;
      const baseName = fileName.replace(/\.[^.]+$/, '') || 'logo';
      onConfirm(new File([blob], `${baseName}.png`, { type: 'image/png' }));
    }, 'image/png');
  }, [clampedX, clampedY, displayH, displayW, fileName, onConfirm]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[var(--vvh,100dvh)] bg-black/60 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-label="Ajustar logo"
        aria-modal="true"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="relative px-4 py-3 border-b border-slate-100">
          <p className="text-center text-sm font-bold text-slate-900">Ajustar logo</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar ajuste da logo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex justify-center">
            <div
              className="relative bg-slate-900 overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Prévia da logo"
                draggable={false}
                onLoad={e =>
                  setNatural({
                    w: e.currentTarget.naturalWidth || OUTPUT,
                    h: e.currentTarget.naturalHeight || OUTPUT,
                  })
                }
                className="absolute max-w-none"
                style={{
                  width: displayW || FRAME,
                  height: displayH || FRAME,
                  left: (FRAME - displayW) / 2 + clampedX,
                  top: (FRAME - displayH) / 2 + clampedY,
                }}
              />
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute rounded-full border-2 border-dashed border-white/80"
                  style={{ inset: CIRCLE_INSET }}
                />
                {[
                  'top-1 left-1',
                  'top-1 right-1',
                  'bottom-1 left-1',
                  'bottom-1 right-1',
                ].map(position => (
                  <span
                    key={position}
                    className={`absolute ${position} w-3 h-3 border-2 border-white rounded-[2px]`}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => {
                const nextZoom = Number(e.target.value);
                setZoom(nextZoom);
                setOffset(prev => ({ x: prev.x, y: prev.y }));
              }}
              className="w-full accent-[#EA580C]"
              aria-label="Zoom da logo"
            />
          </label>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !natural.w}
              className="w-full min-h-[42px] rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition disabled:opacity-60"
            >
              {busy ? 'Salvando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
