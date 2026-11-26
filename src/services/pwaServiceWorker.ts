/**
 * Registro e ciclo de vida do Service Worker do PK Detail.
 *
 * - O SW só é registrado em contexto seguro (HTTPS ou localhost).
 * - A atualização nunca é aplicada sozinha: o novo SW fica em `waiting` e a
 *   interface oferece ao usuário o momento de recarregar.
 * - Nada de dados da aplicação é enviado ao SW; ele só controla cache público.
 */

type Listener = () => void;

export interface PwaState {
  supported: boolean;
  offline: boolean;
  updateReady: boolean;
  registered: boolean;
}

const listeners = new Set<Listener>();

let state: PwaState = {
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  updateReady: false,
  registered: false,
};

let registration: ServiceWorkerRegistration | null = null;
let reloading = false;
let initialized = false;

function emit(): void {
  state = { ...state };
  listeners.forEach(listener => listener());
}

function setState(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  emit();
}

function promoteWaitingWorker(reg: ServiceWorkerRegistration | null): void {
  if (!reg || !reg.waiting) return;
  setState({ updateReady: true });
}

function watchInstallingWorker(reg: ServiceWorkerRegistration): void {
  const installing = reg.installing;
  if (!installing) return;
  installing.addEventListener('statechange', () => {
    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
      promoteWaitingWorker(reg);
    }
  });
}

export function subscribePwaState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaState(): PwaState {
  return state;
}

export async function initPwa(): Promise<void> {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => setState({ offline: false }));
  window.addEventListener('offline', () => setState({ offline: true }));

  if (!('serviceWorker' in navigator)) return;
  const isSecure =
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (!isSecure) return;

  const env = import.meta.env.DEV ? 'dev' : 'prod';

  try {
    const reg = await navigator.serviceWorker.register(`/sw.js?env=${env}`, { scope: '/' });
    registration = reg;
    setState({ registered: true });
    // Verifica atualização já no carregamento, sem aplicar automaticamente.
    void reg.update().catch(() => undefined);

    promoteWaitingWorker(reg);
    watchInstallingWorker(reg);

    reg.addEventListener('updatefound', () => watchInstallingWorker(reg));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) return;
      reloading = false;
      window.location.reload();
    });

    // Procura atualizações ao voltar para o app e a cada 30 minutos.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
    window.setInterval(() => {
      void reg.update().catch(() => undefined);
    }, 30 * 60 * 1000);
  } catch {
    setState({ registered: false });
  }
}

export function applyPwaUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  reloading = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function dismissPwaUpdate(): void {
  setState({ updateReady: false });
}
