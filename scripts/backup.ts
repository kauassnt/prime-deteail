/**
 * Backup criptografado do estado do PK Detail.
 *
 * Uso:
 *   PK_BACKUP_KEY="uma-chave-longa-e-secreta" bun run backup
 *   PK_BACKUP_KEY="..." bun run backup -- restore backups/pk-backup-....enc --verify
 *
 * - AES-256-GCM com chave derivada por scrypt (salt aleatório por backup).
 * - O arquivo de saída contém somente dados cifrados + parâmetros não secretos.
 * - `restore --verify` decifra e valida a integridade sem escrever nada.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface BackupEnvelope {
  version: 1;
  createdAt: string;
  scrypt: { salt: string; N: number; r: number; p: number };
  iv: string;
  tag: string;
  data: string;
}

const ROOT = process.cwd();
const STORAGE_DIR = path.join(ROOT, 'storage');
const BACKUP_DIR = path.join(ROOT, 'backups');
const INCLUDED_PATHS = [
  path.join('storage', 'realtime', 'state.json'),
  path.join('storage', 'brand-identity', 'registry.json'),
];
const INCLUDED_DIRS = [path.join('storage', 'brand-identity', 'assets')];

function fail(message: string): never {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

function backupKey(): Buffer {
  const secret = process.env.PK_BACKUP_KEY || '';
  if (secret.length < 24) {
    fail('Defina PK_BACKUP_KEY com pelo menos 24 caracteres (fora do código/repositório).');
  }
  return Buffer.from(secret, 'utf8');
}

function collectFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const relative of INCLUDED_PATHS) {
    const abs = path.join(ROOT, relative);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      files[relative] = fs.readFileSync(abs).toString('base64');
    }
  }
  for (const dirRelative of INCLUDED_DIRS) {
    const absDir = path.join(ROOT, dirRelative);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir)) {
      const abs = path.join(absDir, entry);
      if (!fs.statSync(abs).isFile()) continue;
      const relative = path.join(dirRelative, entry);
      files[relative] = fs.readFileSync(abs).toString('base64');
    }
  }
  if (Object.keys(files).length === 0) {
    fail('Nenhum arquivo de dados encontrado para backup.');
  }
  return files;
}

function createBackup(): void {
  const key = backupKey();
  const salt = crypto.randomBytes(16);
  const scryptParams = { N: 16384, r: 8, p: 1 };
  const derived = crypto.scryptSync(key, salt, 32, scryptParams);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);

  const payload = Buffer.from(
    JSON.stringify({ createdAt: new Date().toISOString(), files: collectFiles() }),
    'utf8'
  );
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope: BackupEnvelope = {
    version: 1,
    createdAt: new Date().toISOString(),
    scrypt: { salt: salt.toString('base64'), ...scryptParams },
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const target = path.join(BACKUP_DIR, `pk-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.enc`);
  fs.writeFileSync(target, JSON.stringify(envelope), { encoding: 'utf8', mode: 0o600 });
  console.log(`[backup] criado: ${target} (${Object.keys(collectFiles()).length} arquivos cifrados)`);
}

function openBackup(file: string): { files: Record<string, string>; createdAt: string } {
  const key = backupKey();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BackupEnvelope;
  if (raw.version !== 1 || !raw.scrypt || !raw.iv || !raw.tag || !raw.data) {
    fail('Formato de backup não reconhecido.');
  }
  const salt = Buffer.from(raw.scrypt.salt, 'base64');
  const derived = crypto.scryptSync(key, salt, 32, {
    N: raw.scrypt.N,
    r: raw.scrypt.r,
    p: raw.scrypt.p,
  });
  const decipher = crypto.createDecipheriv('aes-256-gcm', derived, Buffer.from(raw.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(raw.tag, 'base64'));
  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(Buffer.from(raw.data, 'base64')), decipher.final()]);
  } catch {
    fail('Falha na verificação de integridade. Chave incorreta ou backup corrompido.');
  }
  const parsed = JSON.parse(decrypted.toString('utf8')) as {
    createdAt: string;
    files: Record<string, string>;
  };
  return { files: parsed.files, createdAt: parsed.createdAt };
}

function restoreBackup(file: string, write: boolean): void {
  const backup = openBackup(file);
  const names = Object.keys(backup.files);
  console.log(`[backup] integridade OK (${names.length} arquivos, criado em ${backup.createdAt})`);
  if (!write) {
    console.log('[backup] modo verificação: nada foi gravado. Use --write para restaurar.');
    return;
  }
  for (const relative of names) {
    if (!relative.startsWith(`storage${path.sep}`) && !relative.startsWith('storage/')) {
      fail(`Caminho inválido no backup: ${relative}`);
    }
    const abs = path.resolve(ROOT, relative);
    if (!abs.startsWith(path.resolve(STORAGE_DIR) + path.sep)) {
      fail(`Tentativa de escrita fora de storage/: ${relative}`);
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(backup.files[relative], 'base64'));
  }
  console.log(`[backup] restauração concluída em ${STORAGE_DIR}`);
}

const args = process.argv.slice(2);
const isRestore = args[0] === 'restore';
if (!isRestore) {
  createBackup();
} else {
  const file = args[1];
  if (!file) fail('Informe o arquivo de backup para restaurar.');
  restoreBackup(file, args.includes('--write'));
}
