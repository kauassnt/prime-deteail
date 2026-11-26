import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, RotateCcw, Check, X, SwitchCamera, AlertCircle } from 'lucide-react';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';

interface CameraPhotoCaptureProps {
  /** Called with compressed JPEG data URL and target photo category */
  onPhotoCaptured: (dataUrl: string, type: 'before' | 'after') => void;
  /** Default photo category */
  defaultType?: 'before' | 'after';
  /** Compact layout option */
  compact?: boolean;
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

export const CameraPhotoCapture: React.FC<CameraPhotoCaptureProps> = ({
  onPhotoCaptured,
  defaultType = 'before',
  compact = false,
}) => {
  const [photoType, setPhotoType] = useState<'before' | 'after'>(defaultType);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
        setStreamError('Câmera ao vivo indisponível neste navegador. Use o botão "Câmera do Celular / Enviar Foto".');
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
          'Não foi possível acessar a câmera ao vivo (verifique as permissões). Você pode usar "Câmera do Celular / Galeria" abaixo.'
        );
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    if (cameraOpen && !capturedPreview) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [cameraOpen, facingMode, capturedPreview, startCameraStream, stopCameraStream]);

  const handleCloseModal = useCallback(() => {
    stopCameraStream();
    setCapturedPreview(null);
    setStreamError(null);
    setCameraOpen(false);
  }, [stopCameraStream]);

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
    if (!capturedPreview) return;
    onPhotoCaptured(capturedPreview, photoType);
    setUploadNotice(`Foto (${photoType === 'before' ? 'Antes' : 'Depois'}) enviada para a OS e visível ao cliente!`);
    setTimeout(() => setUploadNotice(null), 3500);
    handleCloseModal();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const compressed = compressImageElement(img, img.naturalWidth, img.naturalHeight);
          if (compressed) {
            onPhotoCaptured(compressed, photoType);
            setUploadNotice(`Foto (${photoType === 'before' ? 'Antes' : 'Depois'}) enviada com sucesso!`);
            setTimeout(() => setUploadNotice(null), 3500);
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

  return (
    <div className="space-y-2.5 min-w-0">
      {/* Category Toggle: Antes / Depois + Capture Actions */}
      <div className={`flex flex-col ${compact ? '' : 'sm:flex-row sm:items-center'} gap-2 min-w-0`}>
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setPhotoType('before')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              photoType === 'before'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Foto Antes
          </button>
          <button
            type="button"
            onClick={() => setPhotoType('after')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              photoType === 'after'
                ? 'bg-[#EA580C] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Foto Depois
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              setCapturedPreview(null);
              setCameraOpen(true);
            }}
            className="flex-1 min-w-[140px] min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Abrir Câmera</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-w-[140px] min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Tirar / Enviar Foto</span>
          </button>

          {/* Native camera capture / file selector (hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Selecionar ou capturar foto pela câmera"
          />
        </div>
      </div>

      {uploadNotice && (
        <div className="p-2.5 rounded-xl bg-[#FFEDD5] border border-[#F97316]/40 text-[#9A3412] text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span className="wrap-anywhere">{uploadNotice}</span>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      <ResponsiveModal
        isOpen={cameraOpen}
        onClose={handleCloseModal}
        title={`Capturar Foto — ${photoType === 'before' ? 'Antes do Serviço' : 'Depois do Serviço'}`}
        subtitle="A foto será enviada diretamente para o cliente acompanhar no portal"
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
                  handleCloseModal();
                  fileInputRef.current?.click();
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
                  alt="Pré-visualização da foto capturada"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
                <span
                  className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-black text-white shadow ${
                    photoType === 'before' ? 'bg-slate-900/90' : 'bg-[#EA580C]'
                  }`}
                >
                  {photoType === 'before' ? 'ANTES' : 'DEPOIS'}
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
                  <span>Enviar Foto ({photoType === 'before' ? 'Antes' : 'Depois'})</span>
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
                <span
                  className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-black text-white shadow ${
                    photoType === 'before' ? 'bg-slate-900/80' : 'bg-[#EA580C]/90'
                  }`}
                >
                  Modo: {photoType === 'before' ? 'ANTES' : 'DEPOIS'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
                  title="Alternar câmera frontal/traseira"
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
                  onClick={handleCloseModal}
                  aria-label="Cancelar"
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1 transition shrink-0"
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
