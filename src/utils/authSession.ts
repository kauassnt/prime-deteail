const AUTH_SESSION_KEY = 'pk_detail_auth_session_v1';
const LOGGED_OUT_KEY = 'pk_detail_session_logged_out_v1';

export interface ServerAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ServerSessionResult {
  authenticated: boolean;
  user?: ServerAuthUser;
}

export interface ServerLoginResult {
  ok: boolean;
  user?: ServerAuthUser;
  error?: string;
}

/** Cache local (não autoritativo) para evitar piscar a tela de login. */
export function hasAuthSession(): boolean {
  try {
    if (sessionStorage.getItem(LOGGED_OUT_KEY) === '1') return false;
    return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function startAuthSession(): void {
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, '1');
    sessionStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    /* armazenamento restrito */
  }
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.setItem(LOGGED_OUT_KEY, '1');
  } catch {
    /* armazenamento restrito */
  }
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Autentica no servidor; a senha nunca é validada no navegador. */
export async function loginWithServer(
  email: string,
  password: string
): Promise<ServerLoginResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Não foi possível autenticar.',
      };
    }
    const user = data.user as ServerAuthUser | undefined;
    if (!user || typeof user.id !== 'string') {
      return { ok: false, error: 'Resposta de autenticação inválida.' };
    }
    return { ok: true, user };
  } catch {
    return { ok: false, error: 'Servidor indisponível. Tente novamente em instantes.' };
  }
}

/** Confirma no servidor se a sessão (cookie HttpOnly) ainda é válida. */
export async function fetchServerSession(): Promise<ServerSessionResult> {
  try {
    const response = await fetch('/api/auth/session', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { authenticated: false };
    const data = await readJsonSafe(response);
    if (data.authenticated === true && data.user) {
      return { authenticated: true, user: data.user as ServerAuthUser };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

export async function logoutOnServer(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    /* sessão local já será limpa */
  }
}

/** Reautenticação server-side para operações críticas (PIN do modo quiosque). */
export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
