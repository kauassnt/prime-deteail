/**
 * Persistência do PK Detail.
 *
 * Quando SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY existem, todo o estado vai
 * para o Postgres do Supabase (necessário no Vercel: sem disco e sem processo
 * contínuo). Sem essas variáveis o servidor continua usando arquivos em
 * `storage/` exatamente como antes — o modo local não muda.
 *
 * Esquema (rode uma vez no SQL Editor do Supabase):
 *
 *   create table if not exists pk_kv (
 *     namespace text not null,
 *     key       text not null,
 *     value     text not null,
 *     expires_at timestamptz,
 *     updated_at timestamptz not null default now(),
 *     primary key (namespace, key)
 *   );
 *   create index if not exists pk_kv_expires_idx on pk_kv (expires_at);
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RealtimeDisk {
  revision: number;
  updatedAt: string;
  keys: Record<string, string>;
}

export interface AuthSessionLike {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userEmail: string;
  createdAt: number;
  lastSeenAt: number;
  ip: string;
  userAgent: string;
}

const TABLE = 'pk_kv';

let client: SupabaseClient | null = null;
let clientResolved = false;

export function getSupabase(): SupabaseClient | null {
  if (clientResolved) return client;
  clientResolved = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    client = null;
  }
  return client;
}

export function isSupabaseEnabled(): boolean {
  return getSupabase() !== null;
}

// Compatibilidade com código existente que checava Redis.
export function isRedisEnabled(): boolean {
  return isSupabaseEnabled();
}

function sb(): SupabaseClient | null {
  return getSupabase();
}

async function kvGet<T>(namespace: string, key: string): Promise<T | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from(TABLE)
      .select('value, expires_at')
      .eq('namespace', namespace)
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      // expirado: remove preguiçosamente
      await c.from(TABLE).delete().eq('namespace', namespace).eq('key', key);
      return null;
    }
    try {
      return JSON.parse(data.value) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function kvSet(namespace: string, key: string, value: unknown, ttlMs?: number): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    const expires_at = ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null;
    await c.from(TABLE).upsert(
      {
        namespace,
        key,
        value: JSON.stringify(value),
        expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'namespace,key' }
    );
  } catch {
    // leitura/escrita remota não deve derrubar a requisição
  }
}

async function kvDel(namespace: string, key: string): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    await c.from(TABLE).delete().eq('namespace', namespace).eq('key', key);
  } catch {
    // ignora
  }
}

/* ------------------------------ Estado compartilhado ------------------------------ */

const STATE_NS = 'state';
const STATE_KEYS_KEY = '__keys';
const STATE_REV_KEY = '__revision';
const STATE_UPDATED_KEY = '__updatedAt';

export async function hydrateState(): Promise<RealtimeDisk | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from(TABLE)
      .select('key, value, expires_at')
      .eq('namespace', STATE_NS);
    if (error || !data) return null;
    const map: Record<string, string> = {};
    for (const row of data) {
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) continue;
      map[row.key] = row.value;
    }
    const revision = map[STATE_REV_KEY] ? Number(JSON.parse(map[STATE_REV_KEY])) || 0 : 0;
    const updatedAt =
      map[STATE_UPDATED_KEY] && typeof JSON.parse(map[STATE_UPDATED_KEY]) === 'string'
        ? (JSON.parse(map[STATE_UPDATED_KEY]) as string)
        : new Date().toISOString();
    const keysList: string[] = map[STATE_KEYS_KEY]
      ? (JSON.parse(map[STATE_KEYS_KEY]) as string[]) || []
      : [];
    const keys: Record<string, string> = {};
    for (const name of keysList) {
      const v = map[`key:${name}`];
      if (typeof v === 'string') {
        try {
          keys[name] = JSON.parse(v) as string; // values stored as JSON strings already
        } catch {
          keys[name] = v;
        }
      }
    }
    // Normaliza: o Redis guardava o valor bruto (string JSON do estado). Aqui guardamos
    // o valor como JSON string, então desfazemos a dupla codificação.
    for (const name of Object.keys(keys)) {
      const raw = keys[name];
      if (typeof raw === 'string') {
        // mantém como está (já é string do estado)
      }
    }
    return { revision, updatedAt, keys };
  } catch {
    return null;
  }
}

export async function persistStateChanges(changes: Record<string, string>): Promise<number | null> {
  const c = sb();
  if (!c) return null;
  try {
    const entries = Object.entries(changes);
    // lê lista atual de chaves
    const currentKeysRaw = await kvGet<string[]>(STATE_NS, STATE_KEYS_KEY);
    const currentKeys = Array.isArray(currentKeysRaw) ? currentKeysRaw : [];
    const keySet = new Set(currentKeys);
    for (const [key] of entries) keySet.add(key);

    await Promise.all([
      ...entries.map(([key, value]) => kvSet(STATE_NS, `key:${key}`, value)),
      kvSet(STATE_NS, STATE_KEYS_KEY, [...keySet]),
    ]);

    // incrementa revisão
    const revRaw = await kvGet<number>(STATE_NS, STATE_REV_KEY);
    const nextRev = (Number(revRaw) || 0) + 1;
    await kvSet(STATE_NS, STATE_REV_KEY, nextRev);
    await kvSet(STATE_NS, STATE_UPDATED_KEY, new Date().toISOString());
    return nextRev;
  } catch {
    return null;
  }
}

/* ------------------------------ Sessões ------------------------------ */

export async function getSessionRemote(sid: string): Promise<AuthSessionLike | null> {
  return kvGet<AuthSessionLike>('session', sid);
}

export async function putSessionRemote(sid: string, session: AuthSessionLike, ttlMs: number): Promise<void> {
  await kvSet('session', sid, session, ttlMs);
}

export async function delSessionRemote(sid: string): Promise<void> {
  await kvDel('session', sid);
}

/* ------------------------------ Credenciais ------------------------------ */

export async function readAdminCredentialRemote(): Promise<unknown | null> {
  return kvGet<unknown>('auth', 'admin');
}

export async function writeAdminCredentialRemote(record: unknown): Promise<void> {
  await kvSet('auth', 'admin', record);
}

export async function readUserCredentialsRemote(): Promise<{ version: 1; users: Record<string, unknown> } | null> {
  return kvGet<{ version: 1; users: Record<string, unknown> }>('auth', 'users');
}

export async function writeUserCredentialsRemote(disk: unknown): Promise<void> {
  await kvSet('auth', 'users', disk);
}

/* ------------------------------ Push ------------------------------ */

export async function readPushSubsRemote<T>(): Promise<T | null> {
  return kvGet<T>('push', 'subs');
}

export async function writePushSubsRemote(disk: unknown): Promise<void> {
  await kvSet('push', 'subs', disk);
}

export async function readPushSentRemote<T>(): Promise<T | null> {
  return kvGet<T>('push', 'sent');
}

export async function writePushSentRemote(disk: unknown): Promise<void> {
  await kvSet('push', 'sent', disk);
}

export async function readVapidRemote(): Promise<{ publicKey: string; privateKey: string } | null> {
  const parsed = await kvGet<{ publicKey?: string; privateKey?: string }>('push', 'vapid');
  if (parsed && typeof parsed.publicKey === 'string' && typeof parsed.privateKey === 'string') {
    return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
  }
  return null;
}

export async function writeVapidRemote(keys: { publicKey: string; privateKey: string }): Promise<void> {
  await kvSet('push', 'vapid', keys);
}

/* ------------------------------ Brand identity ------------------------------ */

export async function readBrandRegistryRemote<T>(): Promise<T | null> {
  return kvGet<T>('brand', 'registry');
}

export async function writeBrandRegistryRemote(registry: unknown): Promise<void> {
  await kvSet('brand', 'registry', registry);
}

export async function putBrandAssetRemote(fileName: string, base64: string, mimeType: string): Promise<void> {
  await kvSet('brand', `asset:${fileName}`, { mimeType, base64 });
}

export async function getBrandAssetRemote(
  fileName: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const parsed = await kvGet<{ mimeType?: string; base64?: string }>('brand', `asset:${fileName}`);
  if (!parsed || typeof parsed.base64 !== 'string') return null;
  return {
    buffer: Buffer.from(parsed.base64, 'base64'),
    mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : 'application/octet-stream',
  };
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}
