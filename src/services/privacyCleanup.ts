/**
 * Limpeza de artefatos temporários ao encerrar a sessão.
 *
 * O PK Detail não guarda senhas nem tokens no navegador. Ainda assim, ao sair
 * removemos tudo o que é recriável/temporário: caches de runtime, pings de
 * sincronização e chaves de sessão de curta duração. Os dados operacionais
 * persistidos (OS, clientes, financeiro) são mantidos para não haver perda de
 * informação — eles são o banco local do app.
 */

const LOGOUT_FLAG_KEY = 'pk_detail_session_logged_out_v1';

const TRANSIENT_LOCAL_KEYS = [
  'pk_detail_brand_sync_ping_v1',
  'pk_detail_install_dismissed_until_v1',
];

export async function purgeSessionArtifacts(): Promise<void> {
  // sessionStorage: mantém apenas o marcador de logout explícito.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      // Marcador de logout e guardas de tentativas de acesso são mantidos.
      if (key && key !== LOGOUT_FLAG_KEY && !key.startsWith('pk_detail_auth_')) toRemove.push(key);
    }
    toRemove.forEach(key => sessionStorage.removeItem(key));
  } catch {
    /* armazenamento restrito */
  }

  TRANSIENT_LOCAL_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* armazenamento restrito */
    }
  });

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            key =>
              key.startsWith('pk-') &&
              !key.startsWith('pk-shell-') &&
              !key.startsWith('pk-assets-') &&
              !key.startsWith('pk-fonts-')
          )
          .map(key => caches.delete(key))
      );
    }
  } catch {
    /* Cache API indisponível */
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_RUNTIME_CACHES' });
  } catch {
    /* sem service worker ativo */
  }
}
