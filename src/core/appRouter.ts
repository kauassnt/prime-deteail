import type { AppModule } from '../context/AppContext';

/**
 * Rotas internas do sistema (History API, sem biblioteca de rotas).
 * Cada módulo tem um caminho próprio para permitir links diretos, recarregar
 * a página no módulo atual e navegação com voltar/avançar do navegador.
 */
export const LOGIN_PATH = '/login';
export const ERROR_PATH = '/erro';

export const MODULE_PATHS: Record<AppModule, string> = {
  dashboard: '/dashboard',
  patio: '/patio',
  ordens: '/ordens',
  orcamentos: '/orcamentos',
  vitrine: '/vitrine',
  posvenda: '/pos-venda',
  metas: '/metas',
  agenda: '/agenda',
  clientes: '/clientes',
  servicos: '/servicos',
  financeiro: '/financeiro',
  funcionarios: '/funcionarios',
  whatsapp: '/whatsapp',
  relatorios: '/relatorios',
  instalar: '/instalar',
  mensagens: '/mensagens',
  suporte: '/suporte',
  empresa: '/minha-empresa',
  permissions: '/permissoes',
};

const PATH_TO_MODULE = new Map<string, AppModule>(
  (Object.entries(MODULE_PATHS) as [AppModule, string][]).map(([module, path]) => [path, module])
);

/** Slugs internos — nunca devem ser confundidos com o link público da Vitrine. */
export const INTERNAL_ROUTE_SLUGS = new Set<string>([
  ...Object.values(MODULE_PATHS).map(path => path.slice(1)),
  LOGIN_PATH.slice(1),
  ERROR_PATH.slice(1),
  'index.html',
]);

const normalizePath = (pathname: string) => {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
  return clean || '/';
};

export function pathForModule(module: AppModule): string {
  return MODULE_PATHS[module] || MODULE_PATHS.dashboard;
}

export function moduleFromPathname(pathname: string): AppModule | null {
  return PATH_TO_MODULE.get(normalizePath(pathname)) ?? null;
}

export function isInternalPath(pathname: string): boolean {
  const clean = normalizePath(pathname);
  return clean === '/' || clean === LOGIN_PATH || clean === ERROR_PATH || PATH_TO_MODULE.has(clean);
}

export function isErrorPath(pathname: string): boolean {
  return normalizePath(pathname) === ERROR_PATH;
}

export function isLoginPath(pathname: string): boolean {
  return normalizePath(pathname) === LOGIN_PATH;
}

/** Normaliza texto para slug (mesma regra usada nos links da Vitrine). */
export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Caminho interno que não corresponde a nenhuma rota conhecida
 * (ex.: /relatorios/xyz). Deve voltar para o módulo atual.
 */
export function isUnknownInternalPath(pathname: string): boolean {
  return !isInternalPath(pathname);
}
