/**
 * Notificações push de agendamento (Web Push / VAPID).
 *
 * - A inscrição é feita no Service Worker já existente (`/sw.js`).
 * - O servidor guarda as inscrições e envia os avisos nos horários da agenda.
 * - No iPhone (iOS 16.4+) só funciona com o app adicionado à Tela de Início;
 *   no Android funciona no navegador ou instalado.
 */

import { initPwa } from './pwaServiceWorker';

export type PushUnsupportedReason = 'ios-needs-install' | 'insecure' | 'no-support';

export interface PushState {
  supported: boolean;
  reason?: PushUnsupportedReason;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  leadMinutes: number;
  myDevices: number;
}

export interface PushActionResult {
  ok: boolean;
  error?: string;
  leadMinutes?: number;
}

interface PushStatusResponse {
  enabled?: boolean;
  publicKey?: string;
  leadMinutes?: number;
  mySubscriptions?: number;
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ se identifica como Mac; o toque é o que diferencia.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

export function getPushSupport(): { supported: boolean; reason?: PushUnsupportedReason } {
  if (typeof window === 'undefined') return { supported: false, reason: 'no-support' };
  if (isIOSDevice() && !isStandaloneMode()) return { supported: false, reason: 'ios-needs-install' };
  if (!isSecureContext()) return { supported: false, reason: 'insecure' };
  const hasApis =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return hasApis ? { supported: true } : { supported: false, reason: 'no-support' };
}

export function pushUnsupportedMessage(reason?: PushUnsupportedReason): string {
  if (reason === 'ios-needs-install') {
    return 'No iPhone, adicione o PK Detail à Tela de Início para ativar as notificações (iOS 16.4 ou superior).';
  }
  if (reason === 'insecure') {
    return 'As notificações exigem conexão segura (HTTPS).';
  }
  return 'Este navegador não suporta notificações push.';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) out[index] = raw.charCodeAt(index);
  return out;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await initPwa();
  } catch {
    return null;
  }
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<null>(resolve => {
    window.setTimeout(() => resolve(null), 10_000);
  });
  return Promise.race<ServiceWorkerRegistration | null>([ready, timeout]);
}

async function fetchPushStatus(): Promise<(PushStatusResponse & { ok: boolean }) | null> {
  try {
    const response = await fetch('/api/push/status', { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as PushStatusResponse;
    return { ...data, ok: true };
  } catch {
    return null;
  }
}

export async function loadPushState(): Promise<PushState> {
  const support = getPushSupport();
  const state: PushState = {
    supported: support.supported,
    reason: support.reason,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    subscribed: false,
    leadMinutes: 60,
    myDevices: 0,
  };
  if (!support.supported) return state;

  const server = await fetchPushStatus();
  if (server) {
    state.leadMinutes = Number(server.leadMinutes) || 60;
    state.myDevices = Number(server.mySubscriptions) || 0;
  }

  const registration = await getServiceWorkerRegistration();
  if (registration) {
    const existing = await registration.pushManager.getSubscription().catch(() => null);
    state.subscribed = Boolean(existing) && state.permission === 'granted';
  }
  return state;
}

export async function enablePushNotifications(): Promise<PushActionResult> {
  const support = getPushSupport();
  if (!support.supported) return { ok: false, error: pushUnsupportedMessage(support.reason) };

  // Precisa ser chamado diretamente do toque do usuário (exigência do iOS).
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      error: 'Permissão não concedida. Libere as notificações nas configurações do site.',
    };
  }

  const server = await fetchPushStatus();
  if (!server?.publicKey) {
    return { ok: false, error: 'Não foi possível obter a chave do servidor. Tente novamente.' };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { ok: false, error: 'O serviço do app ainda não está pronto. Tente novamente em instantes.' };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(server.publicKey) as unknown as BufferSource,
      });
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
      return { ok: false, error: 'O servidor recusou a inscrição. Tente novamente.' };
    }
    return { ok: true, leadMinutes: Number(server.leadMinutes) || 60 };
  } catch (error) {
    const message = (error as Error | null)?.message || '';
    if (/permission/i.test(message)) {
      return { ok: false, error: 'Permissão de notificações bloqueada neste dispositivo.' };
    }
    return { ok: false, error: 'Não foi possível ativar as notificações neste dispositivo.' };
  }
}

export async function disablePushNotifications(): Promise<PushActionResult> {
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  if (!subscription) return { ok: true };
  const endpoint = subscription.endpoint;
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // mesmo sem rede, remove a inscrição local abaixo
  }
  await subscription.unsubscribe().catch(() => false);
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  try {
    const response = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = (await response.json().catch(() => ({}))) as { sent?: number; error?: string };
    if (!response.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : 'Falha ao enviar o teste.' };
    }
    return { ok: true, sent: Number(data.sent) || 0 };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor.' };
  }
}
