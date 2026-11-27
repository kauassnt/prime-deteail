/**
 * Copia os dados locais (storage/) para o Supabase do Vercel.
 *
 * Uso local, uma única vez, com as variáveis do Supabase no ambiente:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run seed:supabase
 *
 * Envia: estado compartilhado, credenciais, inscrições/chaves push,
 * identidade visual (registro + arquivos de logo em base64).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const root = process.cwd();
const TABLE = 'pk_kv';

function readJson<T>(relative: string): T | null {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function put(namespace: string, key: string, value: unknown): Promise<void> {
  await supabase.from(TABLE).upsert(
    { namespace, key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
    { onConflict: 'namespace,key' }
  );
}

async function main(): Promise<void> {
  let total = 0;

  const state = readJson<{ revision?: number; updatedAt?: string; keys?: Record<string, string> }>(
    'storage/realtime/state.json'
  );
  if (state?.keys) {
    const names = Object.keys(state.keys);
    for (const [key, value] of Object.entries(state.keys)) {
      await put('state', `key:${key}`, value);
      total += 1;
    }
    await put('state', '__keys', names);
    await put('state', '__revision', Number(state.revision) || 0);
    await put('state', '__updatedAt', state.updatedAt || new Date().toISOString());
    console.log(`estado: ${names.length} chave(s)`);
  } else {
    console.log('estado: storage/realtime/state.json não encontrado');
  }

  const admin = readJson<unknown>('storage/security/admin-credential.json');
  if (admin) {
    await put('auth', 'admin', admin);
    console.log('credencial administrativa: ok');
  }

  const users = readJson<unknown>('storage/security/user-credentials.json');
  if (users) {
    await put('auth', 'users', users);
    console.log('senhas da equipe: ok');
  }

  const vapid = readJson<{ publicKey?: string; privateKey?: string }>('storage/push/vapid.json');
  if (vapid?.publicKey && vapid?.privateKey) {
    await put('push', 'vapid', vapid);
    console.log('chaves VAPID: ok');
  }

  const subs = readJson<unknown>('storage/push/subscriptions.json');
  if (subs) await put('push', 'subs', subs);

  const sent = readJson<unknown>('storage/push/sent.json');
  if (sent) await put('push', 'sent', sent);

  const registry = readJson<{ history?: Array<{ filePath?: string }>; activeLogo?: { filePath?: string } }>(
    'storage/brand-identity/registry.json'
  );
  if (registry) {
    await put('brand', 'registry', registry);
    const assetsDir = path.join(root, 'storage/brand-identity/assets');
    const names = new Set<string>();
    for (const record of [...(registry.history || []), ...(registry.activeLogo ? [registry.activeLogo] : [])]) {
      const name = record?.filePath ? path.basename(record.filePath) : '';
      if (name) names.add(name);
    }
    if (fs.existsSync(assetsDir)) {
      for (const name of fs.readdirSync(assetsDir)) names.add(name);
    }
    for (const name of names) {
      const full = path.join(assetsDir, name);
      if (!fs.existsSync(full)) continue;
      const ext = path.extname(name).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.webp' ? 'image/webp'
              : ext === '.svg' ? 'image/svg+xml'
                : 'application/octet-stream';
      const base64 = fs.readFileSync(full).toString('base64');
      await put('brand', `asset:${name}`, { mimeType: mime, base64 });
      total += 1;
    }
    console.log(`identidade visual: ${names.size} arquivo(s)`);
  }

  console.log(`\nConcluído. ${total} item(ns) enviados para o Supabase.`);
}

void main().catch(error => {
  console.error('Falha ao migrar dados:', (error as Error)?.message || error);
  process.exit(1);
});
