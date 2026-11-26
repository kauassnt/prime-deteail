/**
 * Sincronização em tempo real do PK Detail.
 *
 * - Dentro do mesmo navegador: o evento `storage` já sincroniza as abas.
 * - Entre dispositivos: as alterações são publicadas no servidor (`/api/state`)
 *   e distribuídas por SSE (`/api/events`). O portal público apenas lê o
 *   catálogo/configuração pública e envia solicitações de agendamento.
 */

const SYNCABLE_PREFIX = 'pk_detail_';
const LOCAL_ONLY_KEYS = new Set([
  'pk_detail_current_user_id_v1',
  'pk_detail_client_only_lock_v1',
]);
const FLUSH_DELAY_MS = 250;
const RETRY_DELAY_MS = 4000;

const CLIENT_ID = `pk_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

let mode: 'internal' | 'public' | 'off' = 'off';
let ready = false;
let started = false;
let suppressDepth = 0;
let eventSource: EventSource | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const pending = new Map<string, string>();
const lastSynced = new Map<string, string>();

export const getRealtimeClientId = (): string => CLIENT_ID;

function isSyncableKey(key: string): boolean {
  return key.startsWith(SYNCABLE_PREFIX) && !LOCAL_ONLY_KEYS.has(key);
}

/**
 * Chamado por StorageService (e por módulos que gravam direto no localStorage)
 * sempre que um dado local muda. Publica no servidor com debounce.
 */
export function notifyRealtimeKey(key: string, valueJson: string): void {
  if (mode !== 'internal' || !ready || suppressDepth > 0) return;
  if (!isSyncableKey(key)) return;
  if (lastSynced.get(key) === valueJson) return;

  pending.set(key, valueJson);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushPending();
  }, FLUSH_DELAY_MS);
}

async function flushPending(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (pending.size === 0) return;

  const changes = Object.fromEntries(pending);
  pending.clear();
  for (const [key, value] of Object.entries(changes)) {
    lastSynced.set(key, value);
  }

  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, changes }),
    });
    if (!response.ok) throw new Error(`sync_http_${response.status}`);
  } catch {
    // Falha de rede: devolve os valores para a fila e tenta novamente.
    for (const [key, value] of Object.entries(changes)) {
      lastSynced.delete(key);
      if (!pending.has(key)) pending.set(key, value);
    }
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flushPending();
    }, RETRY_DELAY_MS);
  }
}

function applyRemoteChanges(changes: Record<string, string>): void {
  const applied: string[] = [];
  suppressDepth += 1;
  try {
    for (const [key, value] of Object.entries(changes)) {
      if (!isSyncableKey(key) || typeof value !== 'string') continue;
      try {
        if (localStorage.getItem(key) === value) {
          lastSynced.set(key, value);
          continue;
        }
        localStorage.setItem(key, value);
        lastSynced.set(key, value);
        applied.push(key);
      } catch {
        // armazenamento cheio: ignora este item
      }
    }
  } finally {
    suppressDepth -= 1;
  }

  if (applied.length > 0) {
    window.dispatchEvent(
      new CustomEvent('pk:realtime-state', { detail: { keys: applied } })
    );
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushPending();
  }, FLUSH_DELAY_MS);
}

/**
 * Envia chaves que existem apenas neste dispositivo (metas, orçamentos, etc.).
 * Usado na primeira sincronização para o servidor não começar incompleto.
 */
function publishMissingLocalKeys(knownKeys: Set<string>): void {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !isSyncableKey(key) || knownKeys.has(key)) continue;
      const value = localStorage.getItem(key);
      if (value && lastSynced.get(key) !== value) pending.set(key, value);
    }
  } catch {
    return;
  }
  if (pending.size > 0) scheduleFlush();
}

function connectEvents(): void {
  if (mode !== 'internal' || typeof EventSource === 'undefined') return;
  if (eventSource) eventSource.close();

  eventSource = new EventSource(`/api/events?clientId=${encodeURIComponent(CLIENT_ID)}`);
  eventSource.onmessage = event => {
    try {
      const message = JSON.parse(event.data) as {
        type?: string;
        clientId?: string;
        changes?: Record<string, string>;
      };
      if (message.type === 'hello') return;
      if (!message.changes || message.clientId === CLIENT_ID) return;
      applyRemoteChanges(message.changes);
    } catch {
      // mensagem inválida: ignora
    }
  };
}

export function resetRealtime(): void {
  disconnectRealtime();
  ready = false;
  started = false;
  mode = 'off';
  pending.clear();
  lastSynced.clear();
}

export function disconnectRealtime(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (flushTimer) clearTimeout(flushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  flushTimer = null;
  retryTimer = null;
}

/**
 * App interno (admin/equipe): hidrata do servidor e passa a publicar/ouvir.
 * `seed` grava o estado local completo no armazenamento e publica no servidor,
 * usado apenas quando o servidor ainda não tem dados.
 */
export async function initInternalRealtime(seed: () => void): Promise<void> {
  if (typeof window === 'undefined' || started) return;
  started = true;
  mode = 'internal';

  try {
    const response = await fetch('/api/state', { headers: { Accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) {
      // Sessão inválida: não publica nada e não insiste em laço de retry.
      mode = 'off';
      ready = false;
      started = false;
      return;
    }
    if (response.ok) {
      const snapshot = (await response.json()) as { keys?: Record<string, string> };
      const keys = snapshot.keys || {};
      if (Object.keys(keys).length > 0) {
        applyRemoteChanges(keys);
        ready = true;
        // Chaves locais que o servidor ainda não conhece (ex.: metas e orçamentos
        // salvos antes da sincronização) são enviadas uma vez.
        publishMissingLocalKeys(new Set(Object.keys(keys)));
        connectEvents();
        return;
      }
    }
  } catch {
    // servidor indisponível: segue com o cache local
  }

  ready = true;
  try {
    seed();
  } catch {
    // sem seed: o app continua funcionando localmente
  }
  publishMissingLocalKeys(new Set());
  connectEvents();
}

/**
 * Portal público (cliente): lê apenas o catálogo/configuração pública.
 * Não recebe nem publica os dados internos (clientes, financeiro, OS).
 */
export async function initPublicRealtime(): Promise<void> {
  if (typeof window === 'undefined' || started) return;
  started = true;
  mode = 'public';
  ready = true;

  try {
    const response = await fetch('/api/public/snapshot', {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const snapshot = (await response.json()) as { keys?: Record<string, string> };
      applyRemoteChanges(snapshot.keys || {});
    }
  } catch {
    // portal segue com o conteúdo local
  }
}

export type BookingSubmitResult = 'ok' | 'conflict' | 'error';

/** Envia a solicitação de agendamento do cliente para o servidor compartilhado. */
export async function submitOnlineBooking(payload: {
  appointment: unknown;
  client: unknown;
  motorcycle: unknown;
}): Promise<BookingSubmitResult> {
  try {
    const response = await fetch('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 409) return 'conflict';
    return response.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
