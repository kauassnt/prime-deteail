export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AppErrorOptions {
  code: string;
  userMessage: string;
  severity?: ErrorSeverity;
  recoverable?: boolean;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly context?: Record<string, unknown>;
  readonly timestamp: string;
  readonly originalCause?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.severity = options.severity ?? 'error';
    this.recoverable = options.recoverable ?? true;
    this.context = options.context;
    this.timestamp = new Date().toISOString();
    this.originalCause = options.cause;
  }
}

export class NetworkError extends AppError {
  readonly status?: number;

  constructor(message: string, userMessage: string, status?: number, cause?: unknown) {
    super(message, {
      code: status ? `HTTP_${status}` : 'NETWORK_ERROR',
      userMessage,
      severity: 'warning',
      recoverable: true,
      context: status ? { status } : undefined,
      cause,
    });
    this.name = 'NetworkError';
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'VALIDATION_ERROR',
      userMessage: userMessage || message,
      severity: 'warning',
      recoverable: true,
      context,
    });
    this.name = 'ValidationError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, userMessage: string, cause?: unknown) {
    super(message, {
      code: 'STORAGE_ERROR',
      userMessage,
      severity: 'error',
      recoverable: true,
      cause,
    });
    this.name = 'StorageError';
  }
}

export class SecurityError extends AppError {
  constructor(message: string, userMessage: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'SECURITY_POLICY_VIOLATION',
      userMessage,
      severity: 'critical',
      recoverable: false,
      context,
    });
    this.name = 'SecurityError';
  }
}

export type Result<T, E extends AppError = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function normalizeUnknownError(
  error: unknown,
  fallbackUserMessage = 'Ocorreu uma falha inesperada. Tente novamente.'
): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new NetworkError(
        error.message || 'Requisição cancelada ou expirada',
        'A operação demorou mais que o esperado e foi cancelada.',
        undefined,
        error
      );
    }
    return new AppError(error.message, {
      code: 'UNEXPECTED_ERROR',
      userMessage: fallbackUserMessage,
      severity: 'error',
      recoverable: true,
      cause: error,
    });
  }
  return new AppError(String(error), {
    code: 'UNEXPECTED_ERROR',
    userMessage: fallbackUserMessage,
    severity: 'error',
    recoverable: true,
    cause: error,
  });
}

export function trySafe<T>(
  fn: () => T,
  fallbackUserMessage = 'Falha ao processar operação.'
): Result<T, AppError> {
  try {
    return ok(fn());
  } catch (error) {
    const appErr = normalizeUnknownError(error, fallbackUserMessage);
    ErrorReporter.report(appErr);
    return err(appErr);
  }
}

export async function trySafeAsync<T>(
  fn: () => Promise<T>,
  fallbackUserMessage = 'Falha na comunicação assíncrona.'
): Promise<Result<T, AppError>> {
  try {
    return ok(await fn());
  } catch (error) {
    const appErr = normalizeUnknownError(error, fallbackUserMessage);
    ErrorReporter.report(appErr);
    return err(appErr);
  }
}

export type ErrorListener = (error: AppError) => void;

const MAX_ERROR_BUFFER = 40;

class ErrorReporterSingleton {
  private listeners = new Set<ErrorListener>();
  private recentErrors: AppError[] = [];

  subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  report(rawError: unknown, context?: Record<string, unknown>): AppError {
    const appErr =
      rawError instanceof AppError
        ? rawError
        : new AppError(
            rawError instanceof Error ? rawError.message : String(rawError),
            {
              code: 'CAPTURED_ERROR',
              userMessage: 'Não foi possível concluir a ação solicitada.',
              severity: 'error',
              recoverable: true,
              context,
              cause: rawError,
            }
          );

    // Ignore intentional request aborts triggered during rapid navigation/typing
    if (
      rawError instanceof Error &&
      rawError.name === 'AbortError' &&
      context?.silentOnAbort !== false
    ) {
      return appErr;
    }

    this.recentErrors.unshift(appErr);
    if (this.recentErrors.length > MAX_ERROR_BUFFER) {
      this.recentErrors.length = MAX_ERROR_BUFFER;
    }

    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'test') {
      console.warn(`[PK Detail · ${appErr.code}]`, appErr.message, appErr.context || '');
    }

    this.listeners.forEach(listener => {
      try {
        listener(appErr);
      } catch {
        // Never allow telemetry/notification observer to throw into caller
      }
    });

    return appErr;
  }

  getHistory(): readonly AppError[] {
    return this.recentErrors;
  }
}

export const ErrorReporter = new ErrorReporterSingleton();

// --- SECURITY SANITIZERS (XSS & Prototype Pollution Defense) ---
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripDangerousKeys<T>(input: T): T {
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => stripDangerousKeys(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) continue;
    clean[key] = stripDangerousKeys(value);
  }
  return clean as T;
}

export function safeJsonParse<T>(
  raw: string | null | undefined,
  fallback: T,
  maxBytes = 8 * 1024 * 1024
): T {
  if (!raw || typeof raw !== 'string') return fallback;
  if (raw.length > maxBytes) {
    ErrorReporter.report(
      new SecurityError(
        `Payload JSON excede limite seguro (${raw.length} bytes)`,
        'Arquivo ou registro local excede o tamanho permitido.'
      )
    );
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return stripDangerousKeys(parsed);
  } catch (parseErr) {
    ErrorReporter.report(
      new StorageError('Falha ao interpretar JSON', 'Dados salvos inválidos ou corrompidos.', parseErr)
    );
    return fallback;
  }
}

export function sanitizeHttpUrl(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

const SAFE_DATA_IMAGE_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function sanitizeImageUrl(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  if (SAFE_DATA_IMAGE_REGEX.test(trimmed)) {
    return trimmed;
  }
  return sanitizeHttpUrl(trimmed);
}
