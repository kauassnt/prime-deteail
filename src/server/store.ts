/**
 * Persistência do PK Detail.
 *
 * Quando UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN existem, todo o
 * estado vai para o Redis (necessário no Vercel: sem disco e sem processo
 * contínuo). Sem essas variáveis o servidor continua usando arquivos em
 * `storage/` exatamente como antes — o modo local não muda.
 */

import { Redis } from '@upstash/redis';

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

const PREFIX = 'pk:';

let client: Redis | null = null;
let clientResolved = false;

export function getRedis(): Redis | null {
  if (clientResolved) return client;
  clientResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    client = new Redis({ url, token, automaticDeserialization: false });
  } catch {
    client = null;
  }
  return client;
}

export function isRedisEnabled(): boolean {
  return getRedis() !== null;
}

function redis(): Redis | null {
  return getRedis();
}

async function readJson<T>(key: string): Promise<T | null> {
  const r = redis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(`${PREFIX}${key}`);
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.set(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // leitura/escrita em Redis não deve derrubar a requisição
  }
}

/* ------------------------------ Estado compartilhado ------------------------------ */

/** Lê o snapshot completo do Redis (null quando não há Redis configurado). */
export async function hydrateState(): Promise<RealtimeDisk | null> {
  const r = redis();
  if (!r) return null;
  try {
    const [revisionRaw, updatedAtRaw, names] = await Promise.all([
      r.get<string>(`${PREFIX}state:revision`),
      r.get<string>(`${PREFIX}state:updatedAt`),
      r.smembers(`${PREFIX}state:keys`),
    ]);
    const keys: Record<string, string> = {};
    const list = Array.isArray(names) ? names : [];
    if (list.length > 0) {
      const values = await Promise.all(
        list.map(name => r.get<string>(`${PREFIX}state:key:${name}`))
      );
      list.forEach((name, index) => {
        const value = values[index];
        if (typeof value === 'string') keys[name] = value;
      });
    }
    return {
      revision: Number(revisionRaw) || 0,
      updatedAt: typeof updatedAtRaw === 'string' ? updatedAtRaw : new Date().toISOString(),
      keys,
    };
  } catch {
    return null;
  }
}

/** Grava apenas as chaves alteradas e devolve a nova revisão (ou null). */
export async function persistStateChanges(
  changes: Record<string, string>
): Promise<number | null> {
  const r = redis();
  if (!r) return null;
  try {
    const entries = Object.entries(changes);
    await Promise.all(
      entries.map(([key, value]) => r.set(`${PREFIX}state:key:${key}`, value))
    );
    for (const [key] of entries) {
      await r.sadd(`${PREFIX}state:keys`, key);
    }
    const revision = await r.incr(`${PREFIX}state:revision`);
    await r.set(`${PREFIX}state:updatedAt`, new Date().toISOString());
    return Number(revision) || 0;
  } catch {
    return null;
  }
}

/* ------------------------------ Sessões ------------------------------ */

export async function getSessionRemote(sid: string): Promise<AuthSessionLike | null> {
  return readJson<AuthSessionLike>(`session:${sid}`);
}

export async function putSessionRemote(
  sid: string,
  session: AuthSessionLike,
  ttlMs: number
): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.set(`${PREFIX}session:${sid}`, JSON.stringify(session), { px: ttlMs });
  } catch {
    // ignora
  }
}

export async function delSessionRemote(sid: string): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.del(`${PREFIX}session:${sid}`);
  } catch {
    // ignora
  }
}

/* ------------------------------ Credenciais ------------------------------ */

export async function readAdminCredentialRemote(): Promise<unknown | null> {
  return readJson<unknown>('auth:admin');
}

export async function writeAdminCredentialRemote(record: unknown): Promise<void> {
  await writeJson('auth:admin', record);
}

export async function readUserCredentialsRemote(): Promise<{ version: 1; users: Record<string, unknown> } | null> {
  return readJson<{ version: 1; users: Record<string, unknown> }>('auth:users');
}

export async function writeUserCredentialsRemote(disk: unknown): Promise<void> {
  await writeJson('auth:users', disk);
}

/* ------------------------------ Push ------------------------------ */

export async function readPushSubsRemote<T>(): Promise<T | null> {
  return readJson<T>('push:subs');
}

export async function writePushSubsRemote(disk: unknown): Promise<void> {
  await writeJson('push:subs', disk);
}

export async function readPushSentRemote<T>(): Promise<T | null> {
  return readJson<T>('push:sent');
}

export async function writePushSentRemote(disk: unknown): Promise<void> {
  await writeJson('push:sent', disk);
}

export async function readVapidRemote(): Promise<{ publicKey: string; privateKey: string } | null> {
  const parsed = await readJson<{ publicKey?: string; privateKey?: string }>('push:vapid');
  if (parsed && typeof parsed.publicKey === 'string' && typeof parsed.privateKey === 'string') {
    return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
  }
  return null;
}

export async function writeVapidRemote(keys: { publicKey: string; privateKey: string }): Promise<void> {
  await writeJson('push:vapid', keys);
}

/* ------------------------------ Brand identity ------------------------------ */

export async function readBrandRegistryRemote<T>(): Promise<T | null> {
  return readJson<T>('brand:registry');
}

export async function writeBrandRegistryRemote(registry: unknown): Promise<void> {
  await writeJson('brand:registry', registry);
}

export async function putBrandAssetRemote(fileName: string, base64: string, mimeType: string): Promise<void> {
  await writeJson(`brand:asset:${fileName}`, { mimeType, base64 });
}

export async function getBrandAssetRemote(
  fileName: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const parsed = await readJson<{ mimeType?: string; base64?: string }>(`brand:asset:${fileName}`);
  if (!parsed || typeof parsed.base64 !== 'string') return null;
  return {
    buffer: Buffer.from(parsed.base64, 'base64'),
    mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : 'application/octet-stream',
  };
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}
