/**
 * Copia os dados locais (storage/) para o Redis do Vercel.
 *
 * Uso local, uma única vez, com as variáveis do Upstash no ambiente:
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... bun run seed:redis
 *
 * Envia: estado compartilhado, credenciais, inscrições/chaves push,
 * identidade visual (registro + arquivos de logo em base64).
 */

import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error('Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN antes de rodar.');
  process.exit(1);
}

const redis = new Redis({ url, token, automaticDeserialization: false });
const root = process.cwd();
const PREFIX = 'pk:';

function readJson<T>(relative: string): T | null {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  let total = 0;

  const state = readJson<{ revision?: number; updatedAt?: string; keys?: Record<string, string> }>(
    'storage/realtime/state.json'
  );
  if (state?.keys) {
    for (const [key, value] of Object.entries(state.keys)) {
      await redis.set(`${PREFIX}state:key:${key}`, value);
      await redis.sadd(`${PREFIX}state:keys`, key);
      total += 1;
    }
    await redis.set(`${PREFIX}state:revision`, Number(state.revision) || 0);
    await redis.set(`${PREFIX}state:updatedAt`, state.updatedAt || new Date().toISOString());
    console.log(`estado: ${Object.keys(state.keys).length} chave(s)`);
  } else {
    console.log('estado: storage/realtime/state.json não encontrado');
  }

  const admin = readJson<unknown>('storage/security/admin-credential.json');
  if (admin) {
    await redis.set(`${PREFIX}auth:admin`, JSON.stringify(admin));
    console.log('credencial administrativa: ok');
  }

  const users = readJson<unknown>('storage/security/user-credentials.json');
  if (users) {
    await redis.set(`${PREFIX}auth:users`, JSON.stringify(users));
    console.log('senhas da equipe: ok');
  }

  const vapid = readJson<{ publicKey?: string; privateKey?: string }>('storage/push/vapid.json');
  if (vapid?.publicKey && vapid?.privateKey) {
    await redis.set(`${PREFIX}push:vapid`, JSON.stringify(vapid));
    console.log('chaves VAPID: ok');
  }

  const subs = readJson<unknown>('storage/push/subscriptions.json');
  if (subs) await redis.set(`${PREFIX}push:subs`, JSON.stringify(subs));

  const sent = readJson<unknown>('storage/push/sent.json');
  if (sent) await redis.set(`${PREFIX}push:sent`, JSON.stringify(sent));

  const registry = readJson<{ history?: Array<{ filePath?: string }>; activeLogo?: { filePath?: string } }>(
    'storage/brand-identity/registry.json'
  );
  if (registry) {
    await redis.set(`${PREFIX}brand:registry`, JSON.stringify(registry));
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
      await redis.set(`${PREFIX}brand:asset:${name}`, JSON.stringify({ mimeType: mime, base64 }));
      total += 1;
    }
    console.log(`identidade visual: ${names.size} arquivo(s)`);
  }

  console.log(`\nConcluído. ${total} item(ns) enviados para o Redis.`);
}

void main().catch(error => {
  console.error('Falha ao migrar dados:', (error as Error)?.message || error);
  process.exit(1);
});
