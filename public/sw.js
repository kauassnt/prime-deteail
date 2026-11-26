/*
 * PK Detail — Service Worker
 * ---------------------------------------------------------------------------
 * Regras de segurança / privacidade:
 *  - Requisições para /api/** nunca são cacheadas (dados privados do cliente).
 *  - Respostas com Cache-Control: no-store, com Authorization ou Set-Cookie
 *    são ignoradas pelo cache.
 *  - Apenas recursos públicos (shell, assets com hash, ícones e fontes) entram
 *    no cache. Nenhuma resposta de dados do usuário é persistida aqui.
 *  - Atualização é controlada pelo usuário: o novo SW fica em waiting até a
 *    página enviar SKIP_WAITING.
 */

const RELEASE = '2026-11-26.1';
const IS_DEV = new URL(self.location.href).searchParams.get('env') === 'dev';

const SHELL_CACHE = `pk-shell-${RELEASE}`;
const ASSET_CACHE = `pk-assets-${RELEASE}`;
const FONT_CACHE = `pk-fonts-${RELEASE}`;
const ALL_CACHES = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

const OFFLINE_URL = '/offline.html';
// O áudio de alerta não entra no precache: 162 KB baixados sem uso em toda visita.
// Ele é carregado sob demanda na primeira interação do app autenticado.
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.json', '/icon.svg'];

const DEV_ONLY_PREFIXES = ['/src/', '/@vite', '/@fs/', '/@id/', '/node_modules/', '/.vite/'];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      );
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith('pk-') && !ALL_CACHES.includes(key))
          .map(key => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* ignore */
        }
      }
      await self.clients.claim();
    })()
  );
});

// Notificações push de agendamento (enviadas pelo servidor com Web Push).
self.addEventListener('push', event => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  const data = payload && typeof payload === 'object' ? payload : {};
  const title = typeof data.title === 'string' && data.title ? data.title : 'PK Detail';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof data.tag === 'string' && data.tag ? data.tag : 'pk-agendamento',
    renotify: true,
    data: {
      url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/agenda',
    },
    vibrate: [120, 60, 120],
    timestamp: Date.now(),
  };
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => {
      // Se o sistema recusar a exibição, tenta ao menos o título.
      return self.registration.showNotification('PK Detail', { body: options.body });
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/agenda';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        try {
          if (new URL(client.url).origin !== self.location.origin) continue;
          await client.focus();
          if (typeof client.navigate === 'function') {
            await client.navigate(targetUrl).catch(() => undefined);
          }
          return;
        } catch {
          // janela inacessível: tenta a próxima
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

self.addEventListener('message', event => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
    return;
  }
  if (data && data.type === 'CLEAR_RUNTIME_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(key => key.startsWith('pk-') && key !== SHELL_CACHE && key !== ASSET_CACHE && key !== FONT_CACHE)
            .map(key => caches.delete(key))
        );
      })()
    );
  }
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isDevModuleRequest(url) {
  return DEV_ONLY_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
}

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.json'
  );
}

function isFontRequest(url) {
  return url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
}

function isStorable(response) {
  if (!response || !response.ok) return false;
  if (response.status !== 200) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) return false;
  if (response.headers.has('set-cookie')) return false;
  return true;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (isStorable(fresh)) {
      cache.put('/', fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch {
    const cachedShell = await cache.match('/');
    if (cachedShell) return cachedShell;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Você está offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (isStorable(fresh)) {
    cache.put(request, fresh.clone()).catch(() => undefined);
  }
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (isStorable(response)) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (request.headers.has('authorization')) return;
  if (request.headers.has('range')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin === self.location.origin && isApiRequest(url)) return;
  if (url.origin === self.location.origin && isDevModuleRequest(url)) return;

  if (request.mode === 'navigate') {
    if (IS_DEV) return;
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && isCacheableAsset(url)) {
    // Assets com hash do build são imutáveis; ícones/manifest usam SWR.
    const strategy = url.pathname.startsWith('/assets/') ? cacheFirst : staleWhileRevalidate;
    event.respondWith(strategy(request, ASSET_CACHE));
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
});
