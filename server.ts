import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  isRedisEnabled,
  hydrateState,
  persistStateChanges,
  getSessionRemote,
  putSessionRemote,
  delSessionRemote,
  readAdminCredentialRemote,
  writeAdminCredentialRemote,
  readUserCredentialsRemote,
  writeUserCredentialsRemote,
  readPushSubsRemote,
  writePushSubsRemote,
  readPushSentRemote,
  writePushSentRemote,
  readVapidRemote,
  writeVapidRemote,
  readBrandRegistryRemote,
  writeBrandRegistryRemote,
  putBrandAssetRemote,
  getBrandAssetRemote,
} from './src/server/store';

// `web-push` é CommonJS: carregado via require para funcionar no Bun e no Node.
const nodeRequire = createRequire(import.meta.url);
type WebPushClient = {
  generateVAPIDKeys: () => { publicKey: string; privateKey: string };
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: Record<string, unknown>
  ) => Promise<unknown>;
};
const webpush = nodeRequire('web-push') as WebPushClient;

type BrandFormat = 'PNG' | 'JPG' | 'JPEG' | 'WEBP' | 'SVG';

interface BrandLogoRecord {
  id: string;
  filePath: string;
  assetUrl: string;
  fileName: string;
  format: BrandFormat;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  updatedBy: string;
  updatedById: string;
  updatedByRole: string;
  version: number;
}

interface BrandAuditEvent {
  id: string;
  action: 'ANEXAR_LOGO' | 'ALTERAR_LOGO' | 'REMOVER_LOGO';
  logoId?: string;
  fileName?: string;
  format?: BrandFormat;
  version: number;
  timestamp: string;
  userName: string;
  userRole: string;
  details: string;
}

interface BrandRegistryDisk {
  activeLogo: BrandLogoRecord | null;
  version: number;
  updatedAt: string;
  history: BrandLogoRecord[];
  audit: BrandAuditEvent[];
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOW_HTTP = process.env.PK_ALLOW_HTTP === 'true';
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'brand-identity');
const ASSETS_DIR = path.join(STORAGE_DIR, 'assets');
const REGISTRY_PATH = path.join(STORAGE_DIR, 'registry.json');

// --- Sincronização em tempo real (SSE) ---
const REALTIME_DIR = path.resolve(process.cwd(), 'storage', 'realtime');
const REALTIME_STATE_PATH = path.join(REALTIME_DIR, 'state.json');
const REALTIME_MAX_KEYS_PER_REQUEST = 40;
const PUBLIC_SNAPSHOT_KEYS = [
  'pk_detail_settings_v1',
  'pk_detail_services_v1',
  'pk_detail_service_categories_v1',
  'pk_detail_portal_config_v1',
];

// --- Autenticação e sessão ---
const SECURITY_DIR = path.resolve(process.cwd(), 'storage', 'security');
const AUTH_CREDENTIAL_PATH = path.join(SECURITY_DIR, 'admin-credential.json');
const USER_CREDENTIALS_PATH = path.join(SECURITY_DIR, 'user-credentials.json');
const SECURITY_LOG_PATH = path.join(SECURITY_DIR, 'security.log');
const SESSION_COOKIE = 'pk_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_TOUCH_MS = 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_AUTH_BODY_BYTES = 4 * 1024;

interface AuthSession {
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

interface CredentialRecord {
  algorithm: 'scrypt';
  salt: string;
  hash: string;
  pinFingerprint: string;
  updatedAt: string;
}

interface UserCredentialRecord {
  algorithm: 'scrypt';
  salt: string;
  hash: string;
  updatedAt: string;
}

interface UserCredentialsDisk {
  version: 1;
  users: Record<string, UserCredentialRecord>;
}

const authSessions = new Map<string, AuthSession>();
const loginAttempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

// Caches usados quando o estado vem do Redis (Vercel), primados a cada requisição.
let credentialCache: CredentialRecord | null | undefined;
let userCredentialsCache: UserCredentialsDisk | null = null;

function ensureSecurityDir(): void {
  fs.mkdirSync(SECURITY_DIR, { recursive: true });
}

function secureLog(event: string, details: Record<string, unknown>): void {
  try {
    ensureSecurityDir();
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...details,
    };
    fs.appendFileSync(SECURITY_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // falha de log nunca deve interromper a requisição
  }
}

function maskEmail(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  return `sha256:${hash.slice(0, 16)}`;
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** Cria/atualiza a sessão no armazenamento ativo (memória e/ou Redis). */
async function persistSession(session: AuthSession): Promise<void> {
  authSessions.set(session.id, session);
  if (isRedisEnabled()) await putSessionRemote(session.id, session, SESSION_TTL_MS);
}

async function destroySession(sid: string): Promise<void> {
  authSessions.delete(sid);
  if (isRedisEnabled()) await delSessionRemote(sid);
}

async function getSession(req: Request): Promise<AuthSession | null> {
  const cookies = parseCookieHeader(req.header('cookie'));
  const sid = cookies[SESSION_COOKIE];
  if (!sid || !/^[A-Za-z0-9_-]{32,128}$/.test(sid)) return null;
  const now = Date.now();
  let session: AuthSession | null = authSessions.get(sid) || null;
  if (!session && isRedisEnabled()) {
    session = (await getSessionRemote(sid)) as AuthSession | null;
  }
  if (!session) return null;
  if (session.lastSeenAt + SESSION_TTL_MS <= now) {
    await destroySession(sid);
    return null;
  }
  if (now - session.lastSeenAt > SESSION_TOUCH_MS) {
    session.lastSeenAt = now;
    await persistSession(session);
  } else if (!authSessions.has(sid)) {
    authSessions.set(sid, session);
  }
  return session;
}

function sessionCookie(sid: string, req: Request): string {
  const secure = requestIsSecure(req) || IS_PRODUCTION;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie(req: Request): string {
  const secure = requestIsSecure(req) || IS_PRODUCTION;
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

async function pruneSessions(): Promise<void> {
  const now = Date.now();
  for (const [sid, session] of authSessions) {
    if (session.lastSeenAt + SESSION_TTL_MS <= now) await destroySession(sid);
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await getSession(req);
  if (!session) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }
  (req as Request & { pkSession?: AuthSession }).pkSession = session;
  next();
}

function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session =
      (req as Request & { pkSession?: AuthSession }).pkSession || (await getSession(req));
    if (!session) {
      res.status(401).json({ error: 'Autenticação necessária.' });
      return;
    }
    if (!roles.includes(session.userRole)) {
      secureLog('auth.forbidden_role', {
        userId: session.userId,
        role: session.userRole,
        path: req.path,
        ip: req.ip,
      });
      res.status(403).json({ error: 'Permissão insuficiente para esta operação.' });
      return;
    }
    (req as Request & { pkSession?: AuthSession }).pkSession = session;
    next();
  };
}

function fingerprintPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function readCredential(): CredentialRecord | null {
  if (isRedisEnabled()) return credentialCache ?? null;
  try {
    if (!fs.existsSync(AUTH_CREDENTIAL_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(AUTH_CREDENTIAL_PATH, 'utf8')) as Partial<CredentialRecord>;
    if (
      parsed.algorithm !== 'scrypt' ||
      typeof parsed.salt !== 'string' ||
      typeof parsed.hash !== 'string' ||
      typeof parsed.pinFingerprint !== 'string'
    ) {
      return null;
    }
    return parsed as CredentialRecord;
  } catch {
    return null;
  }
}

async function writeCredential(pin: string): Promise<CredentialRecord> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
  const record: CredentialRecord = {
    algorithm: 'scrypt',
    salt,
    hash,
    pinFingerprint: fingerprintPin(pin),
    updatedAt: new Date().toISOString(),
  };
  credentialCache = record;
  if (isRedisEnabled()) {
    await writeAdminCredentialRemote(record);
    return record;
  }
  ensureSecurityDir();
  const tmp = `${AUTH_CREDENTIAL_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, AUTH_CREDENTIAL_PATH);
  return record;
}

/** Lê o PIN atual do estado compartilhado (nunca do cliente). */
function currentAdminPin(): string {
  const disk = readRealtimeDisk();
  const portal = parseRealtimeJson<Record<string, unknown>>(
    disk.keys['pk_detail_portal_config_v1'],
    {}
  );
  const pin = typeof portal.kioskPin === 'string' ? portal.kioskPin.trim() : '';
  return pin || '1234';
}

/** Mantém o hash sincronizado quando o PIN é alterado no painel. */
async function ensureCredentialSynced(): Promise<CredentialRecord> {
  const pin = currentAdminPin();
  const existing = readCredential();
  if (existing && existing.pinFingerprint === fingerprintPin(pin)) return existing;
  return writeCredential(pin);
}

function verifyPin(candidate: string, record: CredentialRecord): boolean {
  try {
    const expected = Buffer.from(record.hash, 'hex');
    const actual = crypto.scryptSync(candidate, record.salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* --------------------- Credenciais individuais da equipe --------------------- */

function readUserCredentials(): UserCredentialsDisk {
  if (isRedisEnabled()) return userCredentialsCache ?? { version: 1, users: {} };
  try {
    if (!fs.existsSync(USER_CREDENTIALS_PATH)) return { version: 1, users: {} };
    const parsed = JSON.parse(fs.readFileSync(USER_CREDENTIALS_PATH, 'utf8')) as Partial<UserCredentialsDisk>;
    return {
      version: 1,
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
    };
  } catch {
    return { version: 1, users: {} };
  }
}

async function writeUserCredentials(disk: UserCredentialsDisk): Promise<void> {
  userCredentialsCache = disk;
  if (isRedisEnabled()) {
    await writeUserCredentialsRemote(disk);
    return;
  }
  ensureSecurityDir();
  const tmp = `${USER_CREDENTIALS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(disk, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, USER_CREDENTIALS_PATH);
}

async function setUserCredential(userId: string, password: string): Promise<void> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const disk = readUserCredentials();
  disk.users[userId] = {
    algorithm: 'scrypt',
    salt,
    hash,
    updatedAt: new Date().toISOString(),
  };
  await writeUserCredentials(disk);
}

async function removeUserCredential(userId: string): Promise<boolean> {
  const disk = readUserCredentials();
  if (!disk.users[userId]) return false;
  delete disk.users[userId];
  await writeUserCredentials(disk);
  return true;
}

function verifyUserCredential(userId: string, candidate: string): boolean {
  const record = readUserCredentials().users[userId];
  if (!record) return false;
  try {
    const expected = Buffer.from(record.hash, 'hex');
    const actual = crypto.scryptSync(candidate, record.salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function passwordPolicyError(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (password.length > 128) return 'A senha é muito longa (máximo 128 caracteres).';
  if (/^(.)\1+$/.test(password)) return 'A senha não pode ser um caractere repetido.';
  if (['12345678', 'senha123', 'password', 'admin123', 'pkdetail'].includes(password.toLowerCase())) {
    return 'Escolha uma senha menos previsível.';
  }
  return null;
}

function allUsersFromState(): Array<Record<string, unknown>> {
  const disk = readRealtimeDisk();
  const users = parseRealtimeJson<Array<Record<string, unknown>>>(
    disk.keys['pk_detail_users_v1'],
    []
  );
  return users.filter(user => Boolean(user) && typeof user === 'object');
}

function loginRateKey(req: Request, email: string): string {
  return `${req.ip || 'unknown'}|${email.toLowerCase().trim()}`;
}

function loginIsLocked(key: string): number {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return 0;
  if (entry.lockedUntil > now) return entry.lockedUntil;
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return 0;
  }
  return 0;
}

function registerLoginFailure(key: string): number {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return 0;
  }
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
    entry.count = 0;
    entry.firstAt = now;
    return entry.lockedUntil;
  }
  return 0;
}

function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

function activeUsersFromState(): Array<Record<string, unknown>> {
  const disk = readRealtimeDisk();
  const users = parseRealtimeJson<Array<Record<string, unknown>>>(
    disk.keys['pk_detail_users_v1'],
    []
  );
  return users.filter(user => Boolean(user) && typeof user === 'object' && user.active !== false);
}

function publicUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function stripPublicSecrets(portalConfigJson: string | undefined): string | undefined {
  if (typeof portalConfigJson !== 'string') return portalConfigJson;
  try {
    const parsed = JSON.parse(portalConfigJson) as Record<string, unknown>;
    delete parsed.kioskPin;
    return JSON.stringify(parsed);
  } catch {
    return undefined;
  }
}

/** Whitelist rígida para o payload público de agendamento (anti mass assignment). */
function sanitizeBookingText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, maxLength);
}


interface RealtimeDisk {
  revision: number;
  updatedAt: string;
  keys: Record<string, string>;
}

interface SseConnection {
  res: Response;
  clientId: string;
}

const sseConnections = new Set<SseConnection>();
let realtimeCache: RealtimeDisk | null = null;
let brandRegistryCache: BrandRegistryDisk | null = null;

function ensureStorageDirs(): void {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function readRegistry(): Promise<BrandRegistryDisk> {
  if (isRedisEnabled()) {
    if (brandRegistryCache) return brandRegistryCache;
    const remote = await readBrandRegistryRemote<BrandRegistryDisk>();
    if (remote && typeof remote === 'object') {
      brandRegistryCache = remote;
      return remote;
    }
    const empty: BrandRegistryDisk = {
      activeLogo: null,
      version: 1,
      updatedAt: new Date().toISOString(),
      history: [],
      audit: [],
    };
    await writeRegistryAtomic(empty);
    return empty;
  }
  ensureStorageDirs();
  if (!fs.existsSync(REGISTRY_PATH)) {
    const initial: BrandRegistryDisk = {
      activeLogo: null,
      version: 1,
      updatedAt: new Date().toISOString(),
      history: [],
      audit: [],
    };
    await writeRegistryAtomic(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BrandRegistryDisk>;
    return {
      activeLogo: parsed.activeLogo ?? null,
      version: typeof parsed.version === 'number' && parsed.version >= 1 ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      history: Array.isArray(parsed.history) ? parsed.history : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return {
      activeLogo: null,
      version: 1,
      updatedAt: new Date().toISOString(),
      history: [],
      audit: [],
    };
  }
}

async function writeRegistryAtomic(next: BrandRegistryDisk): Promise<void> {
  brandRegistryCache = next;
  if (isRedisEnabled()) {
    await writeBrandRegistryRemote(next);
    return;
  }
  ensureStorageDirs();
  const tmpPath = `${REGISTRY_PATH}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmpPath, REGISTRY_PATH);
}

function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || 'logo';
  return (
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 80) || 'logo'
  );
}

function resolveFormatAndExt(
  fileName: string,
  mimeType: string
): { format: BrandFormat; mimeType: string; ext: string } | null {
  const lowerMime = (mimeType || '').toLowerCase().trim();
  const ext = (fileName.split('.').pop() || '').toLowerCase().trim();

  if (lowerMime === 'image/png' || (!lowerMime && ext === 'png')) {
    return { format: 'PNG', mimeType: 'image/png', ext: 'png' };
  }
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
    return {
      format: ext === 'jpg' ? 'JPG' : 'JPEG',
      mimeType: 'image/jpeg',
      ext: 'jpg',
    };
  }
  if (lowerMime === 'image/webp' || (!lowerMime && ext === 'webp')) {
    return { format: 'WEBP', mimeType: 'image/webp', ext: 'webp' };
  }
  if (lowerMime === 'image/svg+xml' || (!lowerMime && ext === 'svg')) {
    return { format: 'SVG', mimeType: 'image/svg+xml', ext: 'svg' };
  }
  return null;
}

function hasValidMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 12) return false;
  if (mimeType === 'image/png') {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    );
  }
  return false;
}

const FORBIDDEN_SVG_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'meta',
  'link',
  'base',
  'audio',
  'video',
  'portal',
];

function sanitizeSvgBuffer(buf: Buffer): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  const raw = buf.toString('utf8');
  if (!raw || raw.includes('\u0000')) {
    return { ok: false, error: 'Arquivo SVG inválido ou corrompido.' };
  }

  let cleaned = raw
    .replace(/^\uFEFF/, '')
    .replace(/<\?[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const svgStart = cleaned.search(/<svg[\s>]/i);
  const svgEnd = cleaned.toLowerCase().lastIndexOf('</svg>');
  if (svgStart === -1 || svgEnd === -1 || svgEnd <= svgStart) {
    return { ok: false, error: 'Estrutura SVG inválida.' };
  }
  cleaned = cleaned.slice(svgStart, svgEnd + 6);

  for (const tag of FORBIDDEN_SVG_TAGS) {
    const pairedRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(pairedRe, '').replace(selfRe, '');
  }

  cleaned = cleaned
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*[^\s>]+/gi, '');

  cleaned = cleaned.replace(
    /\s+((?:xlink:)?href|src|action|formaction)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_full, attr: string, _q: string, dq?: string, sq?: string) => {
      const val = (dq ?? sq ?? '').trim();
      if (!val || val.startsWith('#')) {
        return ` ${attr}="${val}"`;
      }
      if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(val)) {
        return ` ${attr}="${val}"`;
      }
      return '';
    }
  );

  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, cssBody: string) => {
    const safeCss = cssBody
      .replace(/@import[^;]*;?/gi, '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
    return `<style>${safeCss}</style>`;
  });

  cleaned = cleaned.replace(/\s+style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, dq?: string, sq?: string) => {
    const styleVal = (dq ?? sq ?? '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
    return ` style="${styleVal}"`;
  });

  const inner = cleaned.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>$/i, '').trim();
  if (!inner) {
    return { ok: false, error: 'SVG rejeitado pela política de segurança.' };
  }

  return { ok: true, buffer: Buffer.from(cleaned, 'utf8') };
}

function mimeFromAssetFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/* ------------------------------- Segurança ------------------------------- */

function parseRealtimeJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readRealtimeDisk(): RealtimeDisk {
  if (realtimeCache) return realtimeCache;
  try {
    if (fs.existsSync(REALTIME_STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(REALTIME_STATE_PATH, 'utf8')) as Partial<RealtimeDisk>;
      realtimeCache = {
        revision: Number(parsed.revision) || 0,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        keys: parsed.keys && typeof parsed.keys === 'object' ? (parsed.keys as Record<string, string>) : {},
      };
      return realtimeCache;
    }
  } catch {
    // arquivo corrompido: recomeça vazio
  }
  realtimeCache = { revision: 0, updatedAt: new Date().toISOString(), keys: {} };
  return realtimeCache;
}

function persistRealtimeDisk(disk: RealtimeDisk): void {
  if (isRedisEnabled()) return; // Redis persiste em applyRealtimeChanges
  fs.mkdirSync(REALTIME_DIR, { recursive: true });
  const tmpPath = `${REALTIME_STATE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(disk), 'utf8');
  fs.renameSync(tmpPath, REALTIME_STATE_PATH);
}

function sanitizeRealtimeChanges(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        key.startsWith('pk_detail_') &&
        typeof value === 'string' &&
        value.length <= 6_000_000
    )
    .slice(0, REALTIME_MAX_KEYS_PER_REQUEST);
  return Object.fromEntries(entries) as Record<string, string>;
}

function broadcastRealtime(changes: Record<string, string>, sourceClientId: string): void {
  if (Object.keys(changes).length === 0) return;
  const payload = `data: ${JSON.stringify({
    type: 'state',
    revision: readRealtimeDisk().revision,
    clientId: sourceClientId,
    changes,
  })}\n\n`;
  for (const connection of sseConnections) {
    try {
      connection.res.write(payload);
    } catch {
      sseConnections.delete(connection);
    }
  }
}

async function applyRealtimeChanges(
  changes: Record<string, string>,
  sourceClientId: string
): Promise<number> {
  const disk = readRealtimeDisk();
  Object.assign(disk.keys, changes);
  disk.revision += 1;
  disk.updatedAt = new Date().toISOString();
  if (isRedisEnabled()) {
    const remoteRevision = await persistStateChanges(changes);
    if (remoteRevision !== null) disk.revision = remoteRevision;
  } else {
    persistRealtimeDisk(disk);
  }
  broadcastRealtime(changes, sourceClientId);
  return disk.revision;
}

/* --------------------- Notificações push de agendamento --------------------- */
/*
 * Web Push (VAPID) para avisar a equipe antes de cada horário da agenda, mesmo
 * com o app fechado. A chave privada fica apenas em storage/push/vapid.json.
 * O servidor envia somente título, corpo curto e a rota /agenda — nenhum dado
 * do cliente sai além do texto da notificação.
 */

const PUSH_DIR = path.resolve(process.cwd(), 'storage', 'push');
const PUSH_VAPID_PATH = path.join(PUSH_DIR, 'vapid.json');
const PUSH_SUBSCRIPTIONS_PATH = path.join(PUSH_DIR, 'subscriptions.json');
const PUSH_SENT_PATH = path.join(PUSH_DIR, 'sent.json');
const PUSH_SUBJECT = process.env.PK_PUSH_SUBJECT || 'mailto:contato@pkdetail.com.br';
const PUSH_LEAD_MINUTES = (() => {
  const raw = Number(process.env.PK_PUSH_LEAD_MINUTES);
  if (!Number.isFinite(raw)) return 60;
  return Math.max(5, Math.min(24 * 60, Math.round(raw)));
})();
const PUSH_MAX_SUBSCRIPTIONS = 200;
const PUSH_TICK_MS = 60_000;
const PUSH_RETRY_MS = 5 * 60_000;
const APPOINTMENTS_STATE_KEY = 'pk_detail_appointments_v1';
// Serviços de push conhecidos: evita que o servidor seja usado para acessar
// endereços arbitrários (SSRF) a partir de uma inscrição forjada.
const PUSH_ENDPOINT_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
  userName: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

interface PushSubscriptionsDisk {
  version: 1;
  subscriptions: PushSubscriptionRecord[];
}

interface PushSentDisk {
  version: 1;
  sent: Record<string, string>;
}

interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  ts: number;
}

let pushSubscriptionsCache: PushSubscriptionsDisk | null = null;
let pushSentCache: PushSentDisk | null = null;
let pushVapidCache: { publicKey: string; privateKey: string } | null = null;
let pushTickRunning = false;
const pushAttempts = new Map<string, number>();

function writePushJson(filePath: string, data: unknown): void {
  fs.mkdirSync(PUSH_DIR, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/** Gera (uma única vez) e mantém o par de chaves VAPID do servidor. */
async function ensurePushVapid(): Promise<{ publicKey: string; privateKey: string }> {
  if (pushVapidCache) return pushVapidCache;
  // Produção (Vercel): chaves em variáveis de ambiente.
  const envPublic = process.env.VAPID_PUBLIC_KEY || process.env.PK_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY || process.env.PK_VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    pushVapidCache = { publicKey: envPublic, privateKey: envPrivate };
    return pushVapidCache;
  }
  if (isRedisEnabled()) {
    const remote = await readVapidRemote();
    if (remote) {
      pushVapidCache = remote;
      return pushVapidCache;
    }
    const keys = webpush.generateVAPIDKeys();
    pushVapidCache = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    await writeVapidRemote(pushVapidCache);
    return pushVapidCache;
  }
  try {
    if (fs.existsSync(PUSH_VAPID_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PUSH_VAPID_PATH, 'utf8')) as Partial<{
        publicKey: string;
        privateKey: string;
      }>;
      if (typeof parsed.publicKey === 'string' && typeof parsed.privateKey === 'string') {
        pushVapidCache = { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      }
    }
  } catch {
    // arquivo corrompido: gera um novo par abaixo
  }
  if (!pushVapidCache) {
    const keys = webpush.generateVAPIDKeys();
    pushVapidCache = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    try {
      writePushJson(PUSH_VAPID_PATH, pushVapidCache);
      fs.chmodSync(PUSH_VAPID_PATH, 0o600);
    } catch {
      // sem permissão de escrita: as chaves seguem válidas enquanto o processo viver
    }
  }
  return pushVapidCache;
}

function readPushSubscriptions(): PushSubscriptionsDisk {
  if (pushSubscriptionsCache) return pushSubscriptionsCache;
  try {
    if (fs.existsSync(PUSH_SUBSCRIPTIONS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PUSH_SUBSCRIPTIONS_PATH, 'utf8')) as Partial<PushSubscriptionsDisk>;
      const list = Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [];
      pushSubscriptionsCache = {
        version: 1,
        subscriptions: list.filter(
          item =>
            item &&
            typeof item.endpoint === 'string' &&
            typeof item.keys?.p256dh === 'string' &&
            typeof item.keys?.auth === 'string'
        ),
      };
      return pushSubscriptionsCache;
    }
  } catch {
    // arquivo corrompido: recomeça vazio
  }
  pushSubscriptionsCache = { version: 1, subscriptions: [] };
  return pushSubscriptionsCache;
}

async function persistPushSubscriptions(disk: PushSubscriptionsDisk): Promise<void> {
  pushSubscriptionsCache = disk;
  if (isRedisEnabled()) {
    await writePushSubsRemote(disk);
    return;
  }
  try {
    writePushJson(PUSH_SUBSCRIPTIONS_PATH, disk);
  } catch {
    // memória continua correta mesmo sem gravar em disco
  }
}

function readPushSent(): PushSentDisk {
  if (pushSentCache) return pushSentCache;
  try {
    if (fs.existsSync(PUSH_SENT_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PUSH_SENT_PATH, 'utf8')) as Partial<PushSentDisk>;
      pushSentCache = {
        version: 1,
        sent: parsed.sent && typeof parsed.sent === 'object' ? (parsed.sent as Record<string, string>) : {},
      };
      return pushSentCache;
    }
  } catch {
    // arquivo corrompido: recomeça vazio
  }
  pushSentCache = { version: 1, sent: {} };
  return pushSentCache;
}

async function persistPushSent(disk: PushSentDisk): Promise<void> {
  // Retém apenas os últimos 30 dias e no máximo 500 chaves.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const entries = Object.entries(disk.sent)
    .filter(([, iso]) => {
      const ms = Date.parse(iso);
      return Number.isFinite(ms) && ms >= cutoff;
    })
    .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
    .slice(0, 500);
  const pruned: PushSentDisk = { version: 1, sent: Object.fromEntries(entries) };
  pushSentCache = pruned;
  if (isRedisEnabled()) {
    await writePushSentRemote(pruned);
    return;
  }
  try {
    writePushJson(PUSH_SENT_PATH, pruned);
  } catch {
    // ignora falha de escrita
  }
}

/**
 * Recarrega do Redis tudo o que as rotas leem de forma síncrona. Sem Redis
 * (desenvolvimento local) os arquivos em `storage/` continuam sendo a fonte.
 */
async function primeRequestCaches(): Promise<void> {
  if (!isRedisEnabled()) return;

  const state = await hydrateState();
  if (state) {
    realtimeCache = state;
    // Primeiro deploy (Redis vazio): cria o admin inicial a partir das env vars
    // PK_BOOTSTRAP_ADMIN_EMAIL / PK_BOOTSTRAP_ADMIN_NAME. A senha inicial é o
    // PIN administrativo (padrão 1234) e deve ser trocada no primeiro acesso.
    const bootstrapEmail = (process.env.PK_BOOTSTRAP_ADMIN_EMAIL || 'kauassnt@gmail.com').trim().toLowerCase();
    if (bootstrapEmail && !state.keys['pk_detail_users_v1']) {
      const admin = {
        id: 'usr_1',
        name: (process.env.PK_BOOTSTRAP_ADMIN_NAME || 'Administrador').slice(0, 80),
        email: bootstrapEmail,
        phone: '',
        role: 'admin',
        active: true,
      };
      const seeded = { 'pk_detail_users_v1': JSON.stringify([admin]) };
      await persistStateChanges(seeded);
      realtimeCache = { ...state, keys: { ...state.keys, ...seeded } };
    }
  }

  const admin = (await readAdminCredentialRemote()) as Partial<CredentialRecord> | null;
  credentialCache =
    admin &&
    admin.algorithm === 'scrypt' &&
    typeof admin.salt === 'string' &&
    typeof admin.hash === 'string' &&
    typeof admin.pinFingerprint === 'string'
      ? (admin as CredentialRecord)
      : null;

  const users = await readUserCredentialsRemote();
  userCredentialsCache = {
    version: 1,
    users: (users && users.users ? users.users : {}) as Record<string, UserCredentialRecord>,
  };

  const subs = await readPushSubsRemote<PushSubscriptionsDisk>();
  if (subs && Array.isArray(subs.subscriptions)) {
    pushSubscriptionsCache = { version: 1, subscriptions: subs.subscriptions };
  }

  const sent = await readPushSentRemote<PushSentDisk>();
  if (sent && sent.sent && typeof sent.sent === 'object') {
    pushSentCache = { version: 1, sent: sent.sent };
  }

  const vapid = await readVapidRemote();
  if (vapid) pushVapidCache = vapid;

  const brand = await readBrandRegistryRemote<BrandRegistryDisk>();
  if (brand && typeof brand === 'object') brandRegistryCache = brand;
}

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (
      PUSH_ENDPOINT_HOSTS.has(host) ||
      host.endsWith('.notify.windows.com') ||
      host.endsWith('.push.apple.com')
    );
  } catch {
    return false;
  }
}

/** Valida o corpo enviado pelo navegador e devolve a inscrição higienizada. */
function sanitizePushSubscription(
  raw: unknown
): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof candidate.endpoint === 'string' ? candidate.endpoint.trim() : '';
  const p256dh = typeof candidate.keys?.p256dh === 'string' ? candidate.keys.p256dh.trim() : '';
  const auth = typeof candidate.keys?.auth === 'string' ? candidate.keys.auth.trim() : '';
  if (!isAllowedPushEndpoint(endpoint)) return null;
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,200}$/.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

async function sendPushPayload(
  record: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<{ ok: boolean; statusCode: number }> {
  const vapid = await ensurePushVapid();
  try {
    await webpush.sendNotification(
      { endpoint: record.endpoint, keys: record.keys },
      JSON.stringify(payload),
      {
        TTL: 3600,
        urgency: 'high',
        vapidDetails: { subject: PUSH_SUBJECT, ...vapid },
      }
    );
    return { ok: true, statusCode: 200 };
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number } | null)?.statusCode) || 0;
    return { ok: false, statusCode };
  }
}

function appointmentStartMs(date: string, startTime: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return null;
  const ms = new Date(`${date}T${startTime}:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildReminderPayload(
  appointment: Record<string, unknown>,
  startTime: string,
  minutes: number
): PushNotificationPayload {
  const clientName = String(appointment.clientName || 'Cliente').slice(0, 80);
  const model = String(appointment.motorcycleModel || '').slice(0, 40);
  const plate = String(appointment.motorcyclePlate || '').slice(0, 12);
  const vehicle = [model, plate].filter(Boolean).join(' · ');
  const lead =
    minutes >= 60 && minutes % 60 === 0
      ? `${minutes / 60} hora${minutes === 60 ? '' : 's'}`
      : `${minutes} minuto${minutes === 1 ? '' : 's'}`;
  return {
    title: `Agendamento em ${lead}`,
    body: [`${startTime} · ${clientName}`, vehicle].filter(Boolean).join(' — '),
    url: '/agenda',
    tag: `pk-agendamento-${String(appointment.id || startTime)}`,
    ts: Date.now(),
  };
}

/** Seleciona os agendamentos dentro da janela de aviso e dispara o push. */
async function runPushReminderTick(): Promise<void> {
  if (pushTickRunning) return;
  pushTickRunning = true;
  try {
    const disk = readPushSubscriptions();
    if (disk.subscriptions.length === 0) return;

    const state = readRealtimeDisk();
    const appointments = parseRealtimeJson<unknown[]>(state.keys[APPOINTMENTS_STATE_KEY], []);
    if (!Array.isArray(appointments) || appointments.length === 0) return;

    const now = Date.now();
    const leadMs = PUSH_LEAD_MINUTES * 60_000;
    const sentDisk = readPushSent();
    const staleEndpoints = new Set<string>();
    let sentChanged = false;

    for (const raw of appointments) {
      if (!raw || typeof raw !== 'object') continue;
      const appointment = raw as Record<string, unknown>;
      const status = String(appointment.status || '');
      if (status === 'cancelado' || status === 'nao_compareceu' || status === 'concluido') continue;

      const date = String(appointment.date || '');
      const startTime = String(appointment.startTime || '');
      const startMs = appointmentStartMs(date, startTime);
      if (startMs === null) continue;
      const diff = startMs - now;
      if (diff < 0 || diff > leadMs) continue;

      const id = String(appointment.id || '') || `${date}T${startTime}`;
      const dedupe = `${id}|${date}T${startTime}|${PUSH_LEAD_MINUTES}`;
      if (sentDisk.sent[dedupe]) continue;
      const lastAttempt = pushAttempts.get(dedupe) || 0;
      if (now - lastAttempt < PUSH_RETRY_MS) continue;

      const minutes = Math.max(1, Math.round(diff / 60_000));
      const payload = buildReminderPayload(appointment, startTime, minutes);
      const targets = disk.subscriptions.filter(item => !staleEndpoints.has(item.endpoint));
      if (targets.length === 0) break;

      let delivered = 0;
      for (const target of targets) {
        const result = await sendPushPayload(target, payload);
        if (result.ok) {
          delivered += 1;
        } else if (result.statusCode === 404 || result.statusCode === 410) {
          staleEndpoints.add(target.endpoint);
        } else {
          console.warn(`[push] falha ao entregar ${dedupe}: status ${result.statusCode || 'desconhecido'}`);
        }
      }
      pushAttempts.set(dedupe, now);

      if (delivered > 0) {
        sentDisk.sent[dedupe] = new Date().toISOString();
        sentChanged = true;
        console.log(`[push] lembrete enviado (${minutes} min): ${payload.body} → ${delivered} dispositivo(s)`);
      }
    }

    if (staleEndpoints.size > 0) {
      await persistPushSubscriptions({
        version: 1,
        subscriptions: disk.subscriptions.filter(item => !staleEndpoints.has(item.endpoint)),
      });
      console.log(`[push] ${staleEndpoints.size} inscrição(ões) expirada(s) removida(s)`);
    }
    if (sentChanged) await persistPushSent(sentDisk);
  } finally {
    pushTickRunning = false;
  }
}

function startPushScheduler(): void {
  const tick = () => {
    void runPushReminderTick().catch(error => {
      console.warn('[push] falha na verificação de agendamentos:', (error as Error)?.message || error);
    });
  };
  const initial = setTimeout(tick, 15_000);
  if (typeof initial.unref === 'function') initial.unref();
  const timer = setInterval(tick, PUSH_TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestIsSecure(req: Request): boolean {
  if (req.secure) return true;
  const forwarded = String(req.header('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  return forwarded === 'https';
}

function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connectSrc = isDev
    ? "'self' ws: wss: https://fonts.googleapis.com https://fonts.gstatic.com"
    : "'self' https://fonts.googleapis.com https://fonts.gstatic.com";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    isDev ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ');
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
}

function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(options.windowMs, 30_000));
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: options.message });
      return;
    }
    next();
  };
}

async function startServer(): Promise<ReturnType<typeof express>> {
  ensureStorageDirs();
  const app = express();
  app.disable('x-powered-by');
  // Compressão HTTP (gzip) para JSON/JS/CSS/HTML. SSE fica de fora por ser stream.
  app.use(
    compression({
      threshold: 1024,
      filter: (req: Request, res: Response) => {
        const type = String(res.getHeader('Content-Type') || '');
        if (type.includes('text/event-stream')) return false;
        return compression.filter(req, res);
      },
    })
  );
  const sessionSweeper = setInterval(() => {
    void pruneSessions();
  }, 10 * 60_000);
  if (typeof sessionSweeper.unref === 'function') sessionSweeper.unref();
  if (IS_PRODUCTION) app.set('trust proxy', 1);

  // Com Redis (Vercel) a instância pode ser nova a cada requisição: recarrega
  // o estado compartilhado antes de atender.
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    primeRequestCaches().then(
      () => next(),
      () => next()
    );
  });

  // HTTPS obrigatório em produção (proxy TLS termina a conexão e envia X-Forwarded-Proto).
  if (IS_PRODUCTION && !ALLOW_HTTP) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (requestIsSecure(req) || req.path === '/api/health') {
        next();
        return;
      }
      res.redirect(308, `https://${req.header('host')}${req.originalUrl}`);
    });
  }

  // Cabeçalhos HTTP de segurança + Content Security Policy.
  const csp = buildContentSecurityPolicy(!IS_PRODUCTION);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );
    if (requestIsSecure(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Proteção CSRF: escritas em /api exigem mesma origem e corpo JSON.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.header('origin');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = '';
      }
      const requestHost = String(req.header('host') || '');
      if (!originHost || originHost !== requestHost) {
        res.status(403).json({ error: 'Origem da requisição não autorizada.' });
        return;
      }
    }
    const hasBody = req.method !== 'DELETE';
    if (hasBody && !req.is('application/json')) {
      res.status(415).json({ error: 'Formato de requisição não suportado. Envie application/json.' });
      return;
    }
    next();
  });

  // Limitação de requisições: geral para /api e mais restrita para escritas.
  const apiLimiter = createRateLimiter({
    windowMs: 60_000,
    // IPs compartilhados (NAT/escritório) podem ter vários operadores atrás do mesmo endereço.
    max: 600,
    message: 'Muitas requisições. Aguarde um instante e tente novamente.',
  });
  const writeLimiter = createRateLimiter({
    windowMs: 60_000,
    // Sincronização em tempo real envia vários lotes por minuto em uso intenso.
    max: 120,
    message: 'Limite de operações de escrita atingido. Aguarde antes de tentar novamente.',
  });
  app.use('/api', apiLimiter);
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    writeLimiter(req, res, next);
  });

  const jsonBodyParser = express.json({ limit: '8mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    // No Vercel o corpo pode chegar já parseado pela plataforma: nesse caso o
    // Express não deve tentar ler o stream novamente.
    if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
      (req as Request & { _body?: boolean })._body = true;
      next();
      return;
    }
    jsonBodyParser(req, res, next);
  });

  // Service Worker, manifest e fallback offline nunca devem ser servidos de cache antigo.
  app.get(['/sw.js', '/manifest.json', '/offline.html'], (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'pk-detail-brand-storage' });
  });

  // ------------------------------- Autenticação -------------------------------
  app.use('/api/auth', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  const authLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 30,
    message: 'Muitas tentativas de autenticação. Aguarde antes de tentar novamente.',
  });

  app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
    const declaredLength = Number(req.header('content-length') || 0);
    if (declaredLength > MAX_AUTH_BODY_BYTES) {
      res.status(413).json({ error: 'Requisição de autenticação muito grande.' });
      return;
    }

    const body = (req.body || {}) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    if (!email || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha.' });
      return;
    }

    const key = loginRateKey(req, email);
    const lockedUntil = loginIsLocked(key);
    if (lockedUntil > Date.now()) {
      const retrySeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retrySeconds));
      secureLog('auth.login_locked', { email: maskEmail(email), ip: req.ip });
      res.status(429).json({
        error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
      });
      return;
    }

    const user = activeUsersFromState().find(
      candidate => String(candidate.email || '').trim().toLowerCase() === email
    );
    const ownCredential = user ? readUserCredentials().users[String(user.id)] : undefined;

    // Senha própria do funcionário; sem senha definida ainda, vale o PIN da empresa.
    // A verificação é sempre executada para não revelar se o e-mail existe.
    const passwordOk = user && ownCredential
      ? verifyUserCredential(String(user.id), password)
      : verifyPin(password, await ensureCredentialSynced());

    if (!user || !passwordOk) {
      const lock = registerLoginFailure(key);
      secureLog('auth.login_failed', {
        email: maskEmail(email),
        userExists: Boolean(user),
        ip: req.ip,
        locked: lock > 0,
      });
      res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      return;
    }

    clearLoginFailures(key);
    void pruneSessions();

    const sid = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    const session: AuthSession = {
      id: sid,
      userId: String(user.id || ''),
      userName: String(user.name || ''),
      userRole: String(user.role || 'operacional'),
      userEmail: email,
      createdAt: now,
      lastSeenAt: now,
      ip: req.ip || '',
      userAgent: String(req.header('user-agent') || '').slice(0, 200),
    };
    await persistSession(session);

    // Rotação de sessão: invalida qualquer sessão anterior deste navegador.
    const previousSid = parseCookieHeader(req.header('cookie'))[SESSION_COOKIE];
    if (previousSid && previousSid !== sid) await destroySession(previousSid);

    res.setHeader('Set-Cookie', sessionCookie(sid, req));
    secureLog('auth.login_success', {
      userId: session.userId,
      role: session.userRole,
      email: maskEmail(email),
      ip: req.ip,
      ownPassword: Boolean(ownCredential),
    });
    res.json({ ok: true, user: publicUser(user), hasOwnPassword: Boolean(ownCredential) });
  });

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    const user = activeUsersFromState().find(candidate => candidate.id === session.userId);
    if (!user || String(user.role || '') !== session.userRole) {
      await destroySession(session.id);
      res.setHeader('Set-Cookie', clearSessionCookie(req));
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const cookies = parseCookieHeader(req.header('cookie'));
    const sid = cookies[SESSION_COOKIE];
    if (sid) {
      await destroySession(sid);
      secureLog('auth.logout', { ip: req.ip });
    }
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  // Reautenticação para operações críticas (ex.: PIN do modo quiosque).
  app.post('/api/auth/verify-pin', authLimiter, requireAuth, async (req: Request, res: Response) => {
    const body = (req.body || {}) as { pin?: unknown };
    const pin = typeof body.pin === 'string' ? body.pin.trim().slice(0, 32) : '';
    if (!pin) {
      res.status(400).json({ error: 'Informe o PIN administrativo.' });
      return;
    }
    const key = loginRateKey(req, `pin:${(req as Request & { pkSession?: AuthSession }).pkSession?.userId || 'anon'}`);
    const lockedUntil = loginIsLocked(key);
    if (lockedUntil > Date.now()) {
      res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
      return;
    }
    const ok = verifyPin(pin, await ensureCredentialSynced());
    if (!ok) {
      registerLoginFailure(key);
      secureLog('auth.pin_failed', { ip: req.ip });
      res.status(401).json({ error: 'PIN incorreto.' });
      return;
    }
    clearLoginFailures(key);
    res.json({ ok: true });
  });

  /* ------------------- Gestão de senhas da equipe (admin) ------------------- */

  app.get('/api/admin/users/credentials', requireAuth, requireRole(['admin']), (_req: Request, res: Response) => {
    const disk = readUserCredentials();
    const users = allUsersFromState().map(user => {
      const record = disk.users[String(user.id)];
      return {
        userId: String(user.id),
        passwordSet: Boolean(record),
        updatedAt: record?.updatedAt || null,
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ credentials: users });
  });

  app.put(
    '/api/admin/users/:userId/password',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const userId = String(req.params.userId || '').slice(0, 64);
      const target = allUsersFromState().find(user => String(user.id) === userId);
      if (!target) {
        res.status(404).json({ error: 'Funcionário não encontrado.' });
        return;
      }
      const body = (req.body || {}) as { password?: unknown };
      const password = typeof body.password === 'string' ? body.password : '';
      const policyError = passwordPolicyError(password);
      if (policyError) {
        res.status(400).json({ error: policyError });
        return;
      }

      await setUserCredential(userId, password);
      const session = (req as Request & { pkSession?: AuthSession }).pkSession!;
      secureLog('auth.employee_password_set', {
        adminId: session.userId,
        targetId: userId,
        ip: req.ip,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, userId, passwordSet: true });
    }
  );

  app.delete(
    '/api/admin/users/:userId/password',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const userId = String(req.params.userId || '').slice(0, 64);
      const removed = await removeUserCredential(userId);
      const session = (req as Request & { pkSession?: AuthSession }).pkSession!;
      secureLog('auth.employee_password_cleared', {
        adminId: session.userId,
        targetId: userId,
        existed: removed,
        ip: req.ip,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, userId, passwordSet: false });
    }
  );

  // Troca de senha pelo próprio funcionário autenticado.
  app.post('/api/auth/change-password', authLimiter, requireAuth, async (req: Request, res: Response) => {
    const session = (req as Request & { pkSession?: AuthSession }).pkSession!;
    const body = (req.body || {}) as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const hasOwn = Boolean(readUserCredentials().users[session.userId]);
    const currentOk = hasOwn
      ? verifyUserCredential(session.userId, currentPassword)
      : verifyPin(currentPassword, await ensureCredentialSynced());
    if (!currentOk) {
      secureLog('auth.password_change_failed', { userId: session.userId, ip: req.ip });
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      res.status(400).json({ error: policyError });
      return;
    }
    await setUserCredential(session.userId, newPassword);
    secureLog('auth.password_changed', { userId: session.userId, ip: req.ip });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  // Estado compartilhado (equipe). O cliente do app interno hidrata daqui.
  app.get('/api/state', requireAuth, (_req: Request, res: Response) => {
    const disk = readRealtimeDisk();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ revision: disk.revision, updatedAt: disk.updatedAt, keys: disk.keys });
  });

  // Recebe lotes de alterações e distribui para as outras sessões conectadas.
  app.post('/api/state', requireAuth, async (req: Request, res: Response) => {
    const body = (req.body || {}) as { clientId?: string; changes?: unknown };
    const changes = sanitizeRealtimeChanges(body.changes);
    if (Object.keys(changes).length === 0) {
      res.status(400).json({ error: 'Nenhuma alteração válida recebida.' });
      return;
    }
    const revision = await applyRealtimeChanges(changes, String(body.clientId || 'unknown'));
    res.json({ ok: true, revision });
  });

  // ---------------------- Notificações push (agendamentos) ----------------------
  const pushLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 30,
    message: 'Muitas atualizações de notificação. Aguarde um instante.',
  });
  const pushTestLimiter = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 5,
    message: 'Limite de notificações de teste atingido. Aguarde alguns minutos.',
  });

  app.get('/api/push/status', requireAuth, async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }
    const vapid = await ensurePushVapid();
    const disk = readPushSubscriptions();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      enabled: true,
      publicKey: vapid.publicKey,
      leadMinutes: PUSH_LEAD_MINUTES,
      subscriptions: disk.subscriptions.length,
      mySubscriptions: disk.subscriptions.filter(item => item.userId === session.userId).length,
    });
  });

  // Registra/atualiza a inscrição push deste navegador para o usuário logado.
  app.post('/api/push/subscribe', requireAuth, pushLimiter, async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }
    const body = (req.body || {}) as { subscription?: unknown };
    const parsed = sanitizePushSubscription(body.subscription);
    if (!parsed) {
      res.status(400).json({ error: 'Inscrição de notificação inválida.' });
      return;
    }

    const disk = readPushSubscriptions();
    const now = new Date().toISOString();
    const existing = disk.subscriptions.find(item => item.endpoint === parsed.endpoint);
    if (existing) {
      existing.keys = parsed.keys;
      existing.userId = session.userId;
      existing.userName = session.userName;
      existing.userAgent = String(req.header('user-agent') || '').slice(0, 200);
      existing.updatedAt = now;
    } else {
      if (disk.subscriptions.length >= PUSH_MAX_SUBSCRIPTIONS) {
        disk.subscriptions.shift();
      }
      disk.subscriptions.unshift({
        endpoint: parsed.endpoint,
        keys: parsed.keys,
        userId: session.userId,
        userName: session.userName,
        userAgent: String(req.header('user-agent') || '').slice(0, 200),
        createdAt: now,
        updatedAt: now,
      });
    }
    await persistPushSubscriptions(disk);
    secureLog('push.subscribed', { userId: session.userId, ip: req.ip, total: disk.subscriptions.length });
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      subscriptions: disk.subscriptions.length,
      mySubscriptions: disk.subscriptions.filter(item => item.userId === session.userId).length,
    });
  });

  app.post('/api/push/unsubscribe', requireAuth, pushLimiter, async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }
    const body = (req.body || {}) as { endpoint?: unknown };
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    if (!endpoint) {
      res.status(400).json({ error: 'Inscrição não informada.' });
      return;
    }
    const disk = readPushSubscriptions();
    const before = disk.subscriptions.length;
    // Só o próprio usuário remove a inscrição do seu dispositivo.
    disk.subscriptions = disk.subscriptions.filter(
      item => !(item.endpoint === endpoint && item.userId === session.userId)
    );
    if (disk.subscriptions.length !== before) await persistPushSubscriptions(disk);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, subscriptions: disk.subscriptions.length });
  });

  // Envia uma notificação imediata para validar a instalação no celular.
  app.post('/api/push/test', requireAuth, pushTestLimiter, async (req: Request, res: Response) => {
    const session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }
    const disk = readPushSubscriptions();
    const mine = disk.subscriptions.filter(item => item.userId === session.userId);
    if (mine.length === 0) {
      res.status(400).json({ error: 'Ative as notificações neste dispositivo primeiro.' });
      return;
    }

    const payload: PushNotificationPayload = {
      title: 'PK Detail — notificações ativas',
      body: `Tudo certo, ${session.userName}. Os lembretes de agendamento vão chegar aqui.`,
      url: '/agenda',
      tag: 'pk-teste',
      ts: Date.now(),
    };

    let sent = 0;
    const stale = new Set<string>();
    for (const target of mine) {
      const result = await sendPushPayload(target, payload);
      if (result.ok) sent += 1;
      else if (result.statusCode === 404 || result.statusCode === 410) stale.add(target.endpoint);
      else console.warn(`[push] teste falhou: status ${result.statusCode || 'desconhecido'}`);
    }
    if (stale.size > 0) {
      await persistPushSubscriptions({
        version: 1,
        subscriptions: disk.subscriptions.filter(item => !stale.has(item.endpoint)),
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: sent > 0, sent, failed: mine.length - sent });
  });

  // No Vercel não existe processo contínuo: o agendador é substituído por
  // um gatilho HTTP (/api/cron/push) chamado por Vercel Cron ou cron externo.
  if (process.env.VERCEL !== '1') startPushScheduler();

  app.get('/api/cron/push', async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET || '';
    const provided =
      String(req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
      String(req.query.key || '');
    if (!secret || provided !== secret) {
      res.status(401).json({ error: 'Não autorizado.' });
      return;
    }
    await primeRequestCaches();
    await runPushReminderTick();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, at: new Date().toISOString() });
  });

  // Snapshot público: somente catálogo, identidade e configuração do portal.
  app.get('/api/public/snapshot', (_req: Request, res: Response) => {
    const disk = readRealtimeDisk();
    const keys: Record<string, string> = {};
    for (const key of PUBLIC_SNAPSHOT_KEYS) {
      if (typeof disk.keys[key] === 'string') keys[key] = disk.keys[key];
    }
    // Nunca expor o PIN administrativo no snapshot público.
    const sanitizedPortal = stripPublicSecrets(keys['pk_detail_portal_config_v1']);
    if (sanitizedPortal) keys['pk_detail_portal_config_v1'] = sanitizedPortal;
    else delete keys['pk_detail_portal_config_v1'];
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ revision: disk.revision, keys });
  });

  // Solicitação de agendamento feita por um cliente no portal público.
  const bookingLimiter = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 15,
    message: 'Muitas solicitações de agendamento. Aguarde alguns minutos.',
  });
  app.post('/api/public/bookings', bookingLimiter, async (req: Request, res: Response) => {
    type JsonRecord = Record<string, unknown>;
    const body = (req.body || {}) as {
      appointment?: JsonRecord;
      client?: JsonRecord;
      motorcycle?: JsonRecord;
    };
    const appointment = body.appointment;
    const date = typeof appointment?.date === 'string' ? appointment.date : '';
    const startTime = typeof appointment?.startTime === 'string' ? appointment.startTime : '';
    const clientName = typeof appointment?.clientName === 'string' ? appointment.clientName.trim() : '';
    if (!appointment || !date || !startTime || !clientName) {
      res.status(400).json({ error: 'Dados do agendamento incompletos.' });
      return;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      clientName.length > 120
    ) {
      res.status(400).json({ error: 'Data, horário ou nome inválidos.' });
      return;
    }

    const disk = readRealtimeDisk();
    const appointments = parseRealtimeJson<JsonRecord[]>(
      disk.keys['pk_detail_appointments_v1'],
      []
    );
    const clients = parseRealtimeJson<JsonRecord[]>(disk.keys['pk_detail_clients_v1'], []);
    const motorcycles = parseRealtimeJson<JsonRecord[]>(disk.keys['pk_detail_motorcycles_v1'], []);

    const blockedStatuses = ['cancelado', 'nao_compareceu'];
    const conflict = appointments.find(existing => {
      if (!existing || typeof existing !== 'object') return false;
      if (existing.id === appointment.id) return false;
      if (existing.date !== date || existing.startTime !== startTime) return false;
      return !blockedStatuses.includes(String(existing.status));
    });
    if (conflict) {
      res.status(409).json({ error: 'Este horário já foi reservado por outro cliente.' });
      return;
    }

    const onlyDigits = (value: unknown) => String(value || '').replace(/\D/g, '');
    const phoneDigits = onlyDigits(body.client?.phone || appointment.clientPhone);
    const plate = String(appointment.motorcyclePlate || body.motorcycle?.plate || '')
      .toUpperCase()
      .trim();

    let storedClient: JsonRecord | null = null;
    let clientId = String(appointment.clientId || body.client?.id || '');
    const knownClient = clients.find(candidate => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (clientId && candidate.id === clientId) return true;
      return phoneDigits.length >= 8 && onlyDigits(candidate.phone) === phoneDigits;
    });
    if (knownClient) {
      storedClient = knownClient;
      clientId = String(knownClient.id || clientId);
    } else if (body.client) {
      const rawClient = body.client;
      storedClient = {
        id: sanitizeBookingText(rawClient.id, 64) || `cli_${Date.now()}`,
        name: sanitizeBookingText(rawClient.name, 120) || clientName,
        phone: sanitizeBookingText(rawClient.phone, 32) || String(appointment.clientPhone || ''),
        whatsapp: sanitizeBookingText(rawClient.whatsapp, 32),
        email: sanitizeBookingText(rawClient.email, 160),
        document: sanitizeBookingText(rawClient.document, 32),
        address: sanitizeBookingText(rawClient.address, 240),
        createdAt: new Date().toISOString(),
        totalSpent: 0,
        visitsCount: 0,
        loyaltyPoints: 0,
        loyaltyTier: 'bronze',
        tags: [],
      };
      clients.unshift(storedClient);
      clientId = String(storedClient.id);
    }

    let storedMotorcycle: JsonRecord | null = null;
    let motorcycleId = String(appointment.motorcycleId || body.motorcycle?.id || '');
    const knownMotorcycle = motorcycles.find(candidate => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (motorcycleId && candidate.id === motorcycleId) return true;
      return plate.length >= 5 && String(candidate.plate || '').toUpperCase().trim() === plate;
    });
    if (knownMotorcycle) {
      storedMotorcycle = knownMotorcycle;
      motorcycleId = String(knownMotorcycle.id || motorcycleId);
    } else if (body.motorcycle) {
      const rawMoto = body.motorcycle;
      const rawYear = Number(rawMoto.year);
      const rawCc = Number(rawMoto.cc);
      storedMotorcycle = {
        id: sanitizeBookingText(rawMoto.id, 64) || `mot_${Date.now()}`,
        brand: sanitizeBookingText(rawMoto.brand, 60),
        model: sanitizeBookingText(rawMoto.model, 80),
        plate: plate.slice(0, 10),
        year: Number.isFinite(rawYear) ? Math.max(1900, Math.min(2100, Math.round(rawYear))) : undefined,
        cc: Number.isFinite(rawCc) ? Math.max(0, Math.min(3000, Math.round(rawCc))) : undefined,
        color: sanitizeBookingText(rawMoto.color, 40),
        category: sanitizeBookingText(rawMoto.category, 40),
      };
      motorcycles.unshift(storedMotorcycle);
      motorcycleId = String(storedMotorcycle.id);
    }

    const rawPrice = Number(appointment.price);
    const rawDuration = Number(appointment.durationMinutes);
    const storedAppointment: JsonRecord = {
      id: sanitizeBookingText(appointment.id, 64) || `apt_${Date.now()}`,
      clientId,
      clientName,
      clientPhone: sanitizeBookingText(appointment.clientPhone, 32),
      motorcycleId: motorcycleId || sanitizeBookingText(appointment.motorcycleId, 64),
      motorcyclePlate: plate.slice(0, 10),
      motorcycleBrand: sanitizeBookingText(appointment.motorcycleBrand, 60),
      motorcycleModel: sanitizeBookingText(appointment.motorcycleModel, 80),
      serviceId: sanitizeBookingText(appointment.serviceId, 64),
      serviceName: sanitizeBookingText(appointment.serviceName, 120),
      price: Number.isFinite(rawPrice) ? Math.max(0, Math.min(100_000, rawPrice)) : 0,
      date,
      startTime,
      endTime: sanitizeBookingText(appointment.endTime, 5),
      durationMinutes: Number.isFinite(rawDuration)
        ? Math.max(5, Math.min(480, Math.round(rawDuration)))
        : 60,
      notes: sanitizeBookingText(appointment.notes, 500),
      createdAt: new Date().toISOString(),
      status: 'agendado',
      isOnlineBooking: true,
    };
    const existingIndex = appointments.findIndex(item => item && item.id === storedAppointment.id);
    if (existingIndex >= 0) appointments[existingIndex] = storedAppointment;
    else appointments.unshift(storedAppointment);

    const changes: Record<string, string> = {
      'pk_detail_appointments_v1': JSON.stringify(appointments),
    };
    if (storedClient) changes['pk_detail_clients_v1'] = JSON.stringify(clients);
    if (storedMotorcycle) changes['pk_detail_motorcycles_v1'] = JSON.stringify(motorcycles);

    const revision = await applyRealtimeChanges(changes, 'public-booking');
    res.json({
      ok: true,
      revision,
      appointmentId: storedAppointment.id,
      clientId,
      motorcycleId,
    });
  });

  // Canal SSE: o app interno escuta alterações de qualquer dispositivo.
  app.get('/api/events', requireAuth, (req: Request, res: Response) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const connection: SseConnection = {
      res,
      clientId: String(req.query.clientId || 'unknown'),
    };
    sseConnections.add(connection);
    res.write(
      `data: ${JSON.stringify({ type: 'hello', revision: readRealtimeDisk().revision })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        // conexão encerrada
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseConnections.delete(connection);
    });
  });

  app.get('/api/brand-identity', async (_req: Request, res: Response) => {
    const registry = await readRegistry();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({
      activeLogo: registry.activeLogo,
      version: registry.version,
      isDefault: !registry.activeLogo,
      updatedAt: registry.updatedAt,
      audit: registry.audit.slice(0, 50),
    });
  });

  app.get('/api/brand-identity/assets/:filename', async (req: Request, res: Response) => {
    const filename = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).json({ error: 'Nome de arquivo inválido.' });
      return;
    }

    const mime = mimeFromAssetFilename(filename);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (mime === 'image/svg+xml') {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"
      );
    }

    if (isRedisEnabled()) {
      const asset = await getBrandAssetRemote(filename);
      if (!asset) {
        res.status(404).json({ error: 'Logotipo não encontrado no armazenamento.' });
        return;
      }
      res.send(asset.buffer);
      return;
    }

    const absPath = path.join(ASSETS_DIR, filename);
    if (!absPath.startsWith(ASSETS_DIR + path.sep) || !fs.existsSync(absPath)) {
      res.status(404).json({ error: 'Logotipo não encontrado no armazenamento.' });
      return;
    }
    res.sendFile(absPath);
  });

  app.post('/api/brand-identity', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const session = (req as Request & { pkSession?: AuthSession }).pkSession!;
    const actor = { userId: session.userId, userName: session.userName, userRole: session.userRole };

    const body = (req.body || {}) as {
      fileName?: string;
      mimeType?: string;
      dataBase64?: string;
    };

    if (!body.dataBase64 || typeof body.dataBase64 !== 'string') {
      res.status(400).json({ error: 'Dados da imagem ausentes.' });
      return;
    }

    const cleanFileName = sanitizeFileName(String(body.fileName || 'logo'));
    const resolved = resolveFormatAndExt(cleanFileName, String(body.mimeType || ''));
    if (!resolved) {
      res.status(400).json({
        error: 'Formato não permitido. Aceitos apenas PNG, JPG/JPEG, WEBP e SVG.',
      });
      return;
    }

    const base64Payload = body.dataBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
      res.status(400).json({ error: 'Codificação de arquivo inválida.' });
      return;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(base64Payload, 'base64');
    } catch {
      res.status(400).json({ error: 'Falha ao decodificar arquivo enviado.' });
      return;
    }

    if (fileBuffer.length === 0 || fileBuffer.length > MAX_LOGO_BYTES) {
      res.status(400).json({
        error: 'Arquivo vazio ou superior ao limite permitido de 5 MB.',
      });
      return;
    }

    if (resolved.format === 'SVG') {
      const svgResult = sanitizeSvgBuffer(fileBuffer);
      if (!svgResult.ok) {
        res.status(400).json({ error: svgResult.error });
        return;
      }
      fileBuffer = svgResult.buffer;
    } else if (!hasValidMagicBytes(fileBuffer, resolved.mimeType)) {
      res.status(400).json({
        error: `O conteúdo do arquivo não corresponde ao formato ${resolved.format} declarado.`,
      });
      return;
    }

    const current = await readRegistry();
    const hadPreviousLogo = Boolean(current.activeLogo);
    const nextVersion = current.version + 1;
    const logoId = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const storedAssetName = `${logoId}_v${nextVersion}.${resolved.ext}`;
    const storedAbsPath = path.join(ASSETS_DIR, storedAssetName);
    const relativePath = `storage/brand-identity/assets/${storedAssetName}`;
    const assetUrl = `/api/brand-identity/assets/${storedAssetName}?v=${nextVersion}`;
    const uploadedAt = new Date().toISOString();

    // Critical safety invariant: persist new file FIRST & verify before updating active config
    try {
      if (isRedisEnabled()) {
        await putBrandAssetRemote(storedAssetName, fileBuffer.toString('base64'), resolved.mimeType);
      } else {
        fs.writeFileSync(storedAbsPath, fileBuffer);
        const stat = fs.statSync(storedAbsPath);
        if (!stat.isFile() || stat.size === 0) {
          throw new Error('Asset verification failed after write');
        }
      }
    } catch {
      if (!isRedisEnabled() && fs.existsSync(storedAbsPath)) {
        try {
          fs.unlinkSync(storedAbsPath);
        } catch {}
      }
      res.status(500).json({
        error: 'Falha ao gravar arquivo no armazenamento permanente. A logo anterior foi preservada.',
      });
      return;
    }

    const newRecord: BrandLogoRecord = {
      id: logoId,
      filePath: relativePath,
      assetUrl,
      fileName: cleanFileName,
      format: resolved.format,
      mimeType: resolved.mimeType,
      sizeBytes: fileBuffer.length,
      uploadedAt,
      updatedBy: actor.userName,
      updatedById: actor.userId,
      updatedByRole: actor.userRole,
      version: nextVersion,
    };

    const actionType: BrandAuditEvent['action'] = hadPreviousLogo ? 'ALTERAR_LOGO' : 'ANEXAR_LOGO';
    const auditEntry: BrandAuditEvent = {
      id: `brand_aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: actionType,
      logoId,
      fileName: cleanFileName,
      format: resolved.format,
      version: nextVersion,
      timestamp: uploadedAt,
      userName: actor.userName,
      userRole: actor.userRole,
      details: `${hadPreviousLogo ? 'Substituiu' : 'Anexou'} logomarca "${cleanFileName}" (${resolved.format}, v${nextVersion})`,
    };

    const nextRegistry: BrandRegistryDisk = {
      activeLogo: newRecord,
      version: nextVersion,
      updatedAt: uploadedAt,
      history: [newRecord, ...current.history].slice(0, 40),
      audit: [auditEntry, ...current.audit].slice(0, 100),
    };

    try {
      await writeRegistryAtomic(nextRegistry);
    } catch {
      res.status(500).json({
        error: 'Falha ao atualizar registro global da identidade visual. A logo anterior foi mantida.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      activeLogo: nextRegistry.activeLogo,
      version: nextRegistry.version,
      isDefault: false,
      updatedAt: nextRegistry.updatedAt,
      audit: nextRegistry.audit.slice(0, 50),
    });
  });

  app.delete('/api/brand-identity', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const session = (req as Request & { pkSession?: AuthSession }).pkSession!;
    const actor = { userId: session.userId, userName: session.userName, userRole: session.userRole };

    const current = await readRegistry();
    const nowIso = new Date().toISOString();
    const nextVersion = current.version + 1;
    const prevLogo = current.activeLogo;

    const auditEntry: BrandAuditEvent = {
      id: `brand_aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: 'REMOVER_LOGO',
      logoId: prevLogo?.id,
      fileName: prevLogo?.fileName,
      format: prevLogo?.format,
      version: nextVersion,
      timestamp: nowIso,
      userName: actor.userName,
      userRole: actor.userRole,
      details: prevLogo
        ? `Removeu logomarca "${prevLogo.fileName}" (v${prevLogo.version}) e restaurou identidade padrão PK Detail (v${nextVersion})`
        : `Restaurou identidade visual padrão PK Detail (v${nextVersion})`,
    };

    const nextRegistry: BrandRegistryDisk = {
      activeLogo: null,
      version: nextVersion,
      updatedAt: nowIso,
      // Keep historical asset files intact on disk so previously emitted documents preserve issuance logo
      history: current.history,
      audit: [auditEntry, ...current.audit].slice(0, 100),
    };

    await writeRegistryAtomic(nextRegistry);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      activeLogo: null,
      version: nextRegistry.version,
      isDefault: true,
      updatedAt: nextRegistry.updatedAt,
      audit: nextRegistry.audit.slice(0, 50),
    });
  });

  // 404 padronizado para APIs inexistentes (sem revelar detalhes internos).
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota API não encontrada.' });
  });

  // Tratamento de erro centralizado: nunca devolver stack trace ao cliente.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown })?.status === 'number'
      ? Number((err as { status: number }).status)
      : 500;
    if (status >= 500) {
      secureLog('server.error', {
        message: err instanceof Error ? err.message.slice(0, 300) : 'unknown',
      });
    }
    if (res.headersSent) return;
    res.status(status === 400 ? 400 : status).json({
      error: status === 400 ? 'Requisição inválida.' : 'Erro interno do servidor.',
    });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';

    if (isHmrDisabled) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.type('application/javascript').send(`
import "/node_modules/vite/dist/client/env.mjs";
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        ws: !isHmrDisabled,
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const NO_CACHE_FILES = new Set(['sw.js', 'manifest.json', 'offline.html']);
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (NO_CACHE_FILES.has(base) || base === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
            return;
          }
          // Assets com hash no nome podem ser cacheados para sempre.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      })
    );
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Rota API não encontrada.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  if (process.env.VERCEL === '1') return app;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[PK Detail Server] running on http://0.0.0.0:${PORT}`);
  });
  return app;
}

const appPromise = startServer().catch(error => {
  console.error('[PK Detail Server] falha ao iniciar:', (error as Error)?.message || error);
  throw error;
});

/** Handler serverless do Vercel (api/index.ts) e também uso local. */
export default async function pkDetailHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const app = await appPromise;
  app(req as unknown as Request, res as unknown as Response);
}
