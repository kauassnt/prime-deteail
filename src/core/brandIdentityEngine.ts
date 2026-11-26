import { useSyncExternalStore } from 'react';
import type { BrandIdentityState, BrandLogoRecord, User } from '../types';
import {
  AppError,
  ErrorReporter,
  NetworkError,
  SecurityError,
  ValidationError,
  err,
  ok,
  Result,
  safeJsonParse,
} from './errorHandler';
import { validateAndPrepareBrandLogoFile } from './brandIdentityValidation';

const BRAND_IDENTITY_CACHE_KEY = 'pk_detail_brand_identity_meta_v1';
const BRAND_SYNC_PING_KEY = 'pk_detail_brand_sync_ping_v1';
const BRAND_BROADCAST_CHANNEL = 'pk_detail_brand_identity_channel_v1';

const DEFAULT_STATE: BrandIdentityState = {
  activeLogo: null,
  version: 1,
  isDefault: true,
  updatedAt: '',
  audit: [],
};

const BRAND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readInitialHint(): BrandIdentityState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  const raw = localStorage.getItem(BRAND_IDENTITY_CACHE_KEY);
  if (!raw) return DEFAULT_STATE;
  const parsed = safeJsonParse<(Partial<BrandIdentityState> & { expiresAt?: number }) | null>(raw, null);
  if (!parsed || typeof parsed.version !== 'number') return DEFAULT_STATE;
  // Controle de expiração: metadados antigos são descartados e resincronizados.
  if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now()) {
    try {
      localStorage.removeItem(BRAND_IDENTITY_CACHE_KEY);
    } catch {}
    return DEFAULT_STATE;
  }
  return {
    activeLogo: parsed.activeLogo ?? null,
    version: parsed.version,
    isDefault: !parsed.activeLogo,
    updatedAt: parsed.updatedAt || '',
    audit: Array.isArray(parsed.audit) ? parsed.audit : [],
  };
}

function writeCacheHint(state: BrandIdentityState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = localStorage.getItem(BRAND_IDENTITY_CACHE_KEY);
    if (existing) {
      const parsed = safeJsonParse<(Partial<BrandIdentityState> & { expiresAt?: number }) | null>(existing, null);
      if (
        parsed &&
        parsed.version === state.version &&
        (parsed.activeLogo?.assetUrl ?? null) === (state.activeLogo?.assetUrl ?? null)
      ) {
        return;
      }
    }
    localStorage.setItem(
      BRAND_IDENTITY_CACHE_KEY,
      JSON.stringify({ ...state, expiresAt: Date.now() + BRAND_CACHE_TTL_MS })
    );
  } catch {}
}

function syncFavicon(activeLogo: BrandLogoRecord | null): void {
  if (typeof document === 'undefined') return;
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) return;
  if (activeLogo?.assetUrl) {
    link.href = activeLogo.assetUrl;
    if (activeLogo.mimeType) {
      link.type = activeLogo.mimeType;
    }
  } else {
    link.href = '/icon.svg';
    link.type = 'image/svg+xml';
  }
}

class BrandIdentityStore {
  private state: BrandIdentityState = readInitialHint();
  private loading = false;
  private initialized = false;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private inFlightRefresh: Promise<BrandIdentityState> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(BRAND_BROADCAST_CHANNEL);
          this.channel.onmessage = evt => {
            const incoming = evt.data as BrandIdentityState | undefined;
            if (incoming && typeof incoming.version === 'number') {
              this.applyState(incoming, false);
            }
          };
        } catch {}
      }

      window.addEventListener('storage', e => {
        // Apenas o ping explícito dispara ressincronização. Escutar o cache hint
        // criava um laço entre abas (cache -> refresh -> cache).
        if (e.key === BRAND_SYNC_PING_KEY) {
          void this.refresh();
        }
      });

      window.addEventListener('focus', () => {
        void this.refresh();
      });
    }
  }

  private emit(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch {}
    });
  }

  private applyState(next: BrandIdentityState, broadcast = true): void {
    const normalized: BrandIdentityState = {
      activeLogo: next.activeLogo ?? null,
      version: typeof next.version === 'number' ? next.version : 1,
      isDefault: !next.activeLogo,
      updatedAt: next.updatedAt || '',
      audit: Array.isArray(next.audit) ? next.audit : [],
    };
    this.state = normalized;
    writeCacheHint(normalized);
    syncFavicon(normalized.activeLogo);

    if (broadcast) {
      try {
        this.channel?.postMessage(normalized);
      } catch {}
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(BRAND_SYNC_PING_KEY, `${normalized.version}_${Date.now()}`);
        } catch {}
      }
    }
    this.emit();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.initialized) {
      this.initialized = true;
      void this.refresh();
    }
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): BrandIdentityState => {
    return this.state;
  };

  isSyncing = (): boolean => {
    return this.loading;
  };

  async refresh(): Promise<BrandIdentityState> {
    if (typeof fetch === 'undefined') return this.state;
    if (this.inFlightRefresh) return this.inFlightRefresh;

    this.loading = true;
    this.emit();

    const promise = (async () => {
      try {
        const res = await fetch(`/api/brand-identity?_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          return this.state;
        }
        const payload = (await res.json()) as BrandIdentityState;
        this.applyState(payload, false);
        return this.state;
      } catch {
        return this.state;
      } finally {
        this.loading = false;
        this.inFlightRefresh = null;
        this.emit();
      }
    })();

    this.inFlightRefresh = promise;
    return promise;
  }

  async uploadLogo(file: File, actor: User): Promise<Result<BrandIdentityState, AppError>> {
    if (actor.role !== 'admin') {
      const secErr = new SecurityError(
        'Tentativa de alteração de logo sem permissão de administrador',
        'Apenas administradores autorizados podem anexar ou alterar a logomarca.'
      );
      ErrorReporter.report(secErr);
      return err(secErr);
    }

    const prepared = await validateAndPrepareBrandLogoFile(file);
    if (!prepared.ok) {
      const valErr = new ValidationError(prepared.error, prepared.error);
      ErrorReporter.report(valErr);
      return err(valErr);
    }

    this.loading = true;
    this.emit();

    try {
      const res = await fetch('/api/brand-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-user-role': actor.role,
          'x-pk-user-id': actor.id,
          'x-pk-user-name': encodeURIComponent(actor.name),
        },
        body: JSON.stringify({
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          dataBase64: prepared.dataBase64,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as Partial<BrandIdentityState> & {
        error?: string;
      };

      if (!res.ok) {
        const msg =
          body.error ||
          'Falha ao salvar a logomarca no servidor. A logo anterior foi preservada.';
        const netErr = new NetworkError(`HTTP ${res.status}: ${msg}`, msg, res.status);
        ErrorReporter.report(netErr);
        return err(netErr);
      }

      const nextState: BrandIdentityState = {
        activeLogo: body.activeLogo ?? null,
        version: typeof body.version === 'number' ? body.version : this.state.version + 1,
        isDefault: !body.activeLogo,
        updatedAt: body.updatedAt || new Date().toISOString(),
        audit: Array.isArray(body.audit) ? body.audit : this.state.audit,
      };
      this.applyState(nextState, true);
      return ok(nextState);
    } catch (error) {
      const netErr = new NetworkError(
        error instanceof Error ? error.message : 'Erro de conexão',
        'Falha de conexão ao enviar logomarca. A identidade visual anterior foi mantida.',
        undefined,
        error
      );
      ErrorReporter.report(netErr);
      return err(netErr);
    } finally {
      this.loading = false;
      this.emit();
    }
  }

  async removeLogo(actor: User): Promise<Result<BrandIdentityState, AppError>> {
    if (actor.role !== 'admin') {
      const secErr = new SecurityError(
        'Tentativa de remoção de logo sem permissão de administrador',
        'Apenas administradores autorizados podem remover a logomarca.'
      );
      ErrorReporter.report(secErr);
      return err(secErr);
    }

    this.loading = true;
    this.emit();

    try {
      const res = await fetch('/api/brand-identity', {
        method: 'DELETE',
        headers: {
          'x-pk-user-role': actor.role,
          'x-pk-user-id': actor.id,
          'x-pk-user-name': encodeURIComponent(actor.name),
        },
      });

      const body = (await res.json().catch(() => ({}))) as Partial<BrandIdentityState> & {
        error?: string;
      };

      if (!res.ok) {
        const msg = body.error || 'Falha ao remover logomarca no servidor.';
        const netErr = new NetworkError(`HTTP ${res.status}: ${msg}`, msg, res.status);
        ErrorReporter.report(netErr);
        return err(netErr);
      }

      const nextState: BrandIdentityState = {
        activeLogo: null,
        version: typeof body.version === 'number' ? body.version : this.state.version + 1,
        isDefault: true,
        updatedAt: body.updatedAt || new Date().toISOString(),
        audit: Array.isArray(body.audit) ? body.audit : this.state.audit,
      };
      this.applyState(nextState, true);
      return ok(nextState);
    } catch (error) {
      const netErr = new NetworkError(
        error instanceof Error ? error.message : 'Erro de conexão',
        'Não foi possível conectar ao servidor para remover a logomarca.',
        undefined,
        error
      );
      ErrorReporter.report(netErr);
      return err(netErr);
    } finally {
      this.loading = false;
      this.emit();
    }
  }
}

export const brandIdentityEngine = new BrandIdentityStore();

export function useBrandIdentity(): BrandIdentityState {
  return useSyncExternalStore(
    brandIdentityEngine.subscribe,
    brandIdentityEngine.getSnapshot,
    brandIdentityEngine.getSnapshot
  );
}
