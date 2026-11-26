import React, { useState, useCallback } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useModalResponsive } from '../../hooks/useModalResponsive';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const closeGuide = useCallback(() => setShowIOSGuide(false), []);
  const { overlayProps, modalProps, modalClasses } = useModalResponsive({
    isOpen: showIOSGuide,
    onClose: closeGuide,
    ariaLabel: 'Instalar no iPhone / iPad',
  });

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable && (
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[38px] text-xs font-semibold rounded-xl bg-[#EA580C] text-white hover:bg-[#9A3412] shadow-sm transition-[transform,background-color] duration-150 active:scale-95 whitespace-nowrap shrink-0"
          title="Instalar PK Detail como aplicativo"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {isIOS && (
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[38px] text-xs font-semibold rounded-xl border border-[#EA580C]/30 text-[#9A3412] bg-[#FFEDD5] hover:bg-[#FED7AA] transition-[transform,background-color,border-color] duration-150 active:scale-95 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Instalar iOS</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          {...overlayProps}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 pk-fade-enter"
        >
          <div
            {...modalProps}
            className={`w-full max-w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-4 sm:p-5 shadow-2xl text-left border border-slate-100 pk-modal-enter ${modalClasses}`}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 gap-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-md bg-[#EA580C] text-white flex items-center justify-center text-[10px] font-black shrink-0">PK</span>
                <span className="truncate">Instalar no iPhone / iPad</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fechar"
                className="text-slate-400 hover:text-slate-600 p-1.5 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p className="wrap-anywhere">No navegador Safari, toque no botão <strong>Compartilhar</strong> <Share className="w-4 h-4 inline text-blue-600" /> na barra inferior.</p>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p className="wrap-anywhere">Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare className="w-4 h-4 inline text-slate-800" />.</p>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p className="wrap-anywhere">Pronto! O PK Detail funcionará como um aplicativo nativo em tela cheia.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-[#9A3412] py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
