/**
 * Recuperação operacional de senha (executar no servidor, com acesso ao filesystem).
 *
 *   bun run reset-password -- funcionario@empresa.com "NovaSenhaForte"
 *
 * Grava o hash scrypt em storage/security/user-credentials.json.
 * Não imprime a senha e não a envia para lugar nenhum.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface UserLike {
  id?: string;
  email?: string;
  active?: boolean;
}

interface UserCredentialsDisk {
  version: 1;
  users: Record<string, { algorithm: 'scrypt'; salt: string; hash: string; updatedAt: string }>;
}

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, 'storage', 'realtime', 'state.json');
const CREDENTIALS_PATH = path.join(ROOT, 'storage', 'security', 'user-credentials.json');

function fail(message: string): never {
  console.error(`[reset-password] ${message}`);
  process.exit(1);
}

const [emailArg, passwordArg] = process.argv.slice(2);
const email = String(emailArg || '').trim().toLowerCase();
const password = String(passwordArg || '');

if (!email || !password) {
  fail('Uso: bun run reset-password -- email@empresa.com "NovaSenhaForte"');
}
if (password.length < 8) {
  fail('A senha deve ter pelo menos 8 caracteres.');
}
if (!fs.existsSync(STATE_PATH)) {
  fail('storage/realtime/state.json não encontrado.');
}

const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as {
  keys?: Record<string, string>;
};
const usersRaw = state.keys?.['pk_detail_users_v1'];
if (!usersRaw) fail('Lista de funcionários não encontrada no estado.');

let users: UserLike[] = [];
try {
  users = JSON.parse(usersRaw) as UserLike[];
} catch {
  fail('Lista de funcionários inválida.');
}

const user = users.find(candidate => String(candidate.email || '').trim().toLowerCase() === email);
if (!user || !user.id) fail(`Nenhum funcionário encontrado com o e-mail ${email}.`);

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

let disk: UserCredentialsDisk = { version: 1, users: {} };
if (fs.existsSync(CREDENTIALS_PATH)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as Partial<UserCredentialsDisk>;
    disk = { version: 1, users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {} };
  } catch {
    disk = { version: 1, users: {} };
  }
}

disk.users[user.id] = {
  algorithm: 'scrypt',
  salt,
  hash,
  updatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
const tmp = `${CREDENTIALS_PATH}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(disk, null, 2), { encoding: 'utf8', mode: 0o600 });
fs.renameSync(tmp, CREDENTIALS_PATH);

console.log(`[reset-password] senha atualizada para ${email} (${user.id}).`);
