/**
 * Gestão de credenciais individuais da equipe.
 * As senhas nunca trafegam de volta: o servidor informa apenas se existe senha própria.
 */

export interface EmployeeCredentialStatus {
  userId: string;
  passwordSet: boolean;
  updatedAt: string | null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchEmployeeCredentials(): Promise<Record<string, EmployeeCredentialStatus>> {
  try {
    const response = await fetch('/api/admin/users/credentials', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return {};
    const data = await readJson(response);
    const list = Array.isArray(data.credentials) ? (data.credentials as EmployeeCredentialStatus[]) : [];
    return Object.fromEntries(list.map(item => [item.userId, item]));
  } catch {
    return {};
  }
}

export async function setEmployeePassword(
  userId: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Não foi possível salvar a senha.',
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Servidor indisponível. Tente novamente em instantes.' };
  }
}

export async function clearEmployeePassword(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const data = await readJson(response);
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Não foi possível remover a senha.',
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Servidor indisponível. Tente novamente em instantes.' };
  }
}
