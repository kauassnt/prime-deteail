import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  getPwaState,
  initPwa,
  subscribePwaState,
} from '../../services/pwaServiceWorker';

const INSTALL_DISMISS_KEY = 'pk_detail_install_dismissed_until_v1';
const INSTALL_DISMISS_DAYS = 7;

function isInstallPromptDismissed(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function dismissInstallPromptForAWhile(): void {
  try {
    const until = Date.now() + INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(INSTALL_DISMISS_KEY, String(until));
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * Camada discreta de estado do app instalado:
 *  - aviso de conexão perdida;
 *  - convite de instalação personalizado.
 */
export const PwaStatusLayer: React.FC = () => {
  const pwa = useSyncExternalStore(subscribePwaState, getPwaState, getPwaState);
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [installDismissed, setInstallDismissed] = useState<boolean>(() => isInstallPromptDismissed());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    void initPwa();
  }, []);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    try {
      const accepted = await install();
      if (!accepted) dismissInstallPromptForAWhile();
    } finally {
      setInstalling(false);
    }
  }, [install]);

  const handleDismissInstall = useCallback(() => {
    dismissInstallPromptForAWhile();
    setInstallDismissed(true);
  }, []);

  const showInstall = isInstallable && !isInstalled && !installDismissed;

  return (
    <>
      {/* Estado de conexão (só existe no DOM quando realmente offline) */}
      {pwa.offline && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[max(10px,env(safe-area-inset-top))] z-[70] -translate-x-1/2"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-[#FFFBEB] px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow-lg shadow-amber-900/5">
            <WifiOff className="h-3.5 w-3.5" />
            Sem conexão · exibindo o que já foi carregado
          </span>
        </div>
      )}

      {/* Instalação personalizada */}
      {showInstall && (
        <div
          role="dialog"
          aria-label="Instalar o PK Detail"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-[75] mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/10 md:bottom-6 md:inset-x-auto md:right-6 md:mx-0 md:w-[340px] pk-rise-in"
        >
          <div className="flex items-start gap-3">
            <img
              src="/icons/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold leading-tight text-slate-900">Instalar o PK Detail</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Abra em tela cheia, direto da tela inicial, sem depender do navegador.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  disabled={installing}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#EA580C] px-3 text-[11.5px] font-extrabold text-white transition hover:bg-[#9A3412] active:scale-[0.99] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? 'Instalando…' : 'Instalar'}
                </button>
                <button
                  type="button"
                  onClick={handleDismissInstall}
                  className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-3 text-[11.5px] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
