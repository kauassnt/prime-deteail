import { useEffect } from 'react';

/**
 * Trava a rolagem da página sempre que existir um modal aberto
 * (`[aria-modal="true"]`), inclusive modais aninhados e overlays de módulos
 * que não usam `useModalResponsive`.
 *
 * Usa contagem por estado do DOM (MutationObserver), então funciona também
 * para modais montados/desmontados por chunks lazy, sem precisar registrar
 * cada componente individualmente.
 */

let lockCount = 0;
let previousPaddingRight = '';

function acquireScrollLock(): void {
  lockCount += 1;
  if (lockCount > 1) return;

  previousPaddingRight = document.body.style.paddingRight;
  const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarGap > 0) {
    // Evita o "pulo" horizontal quando a barra de rolagem some.
    document.body.style.paddingRight = `${scrollbarGap}px`;
  }
  document.documentElement.setAttribute('data-scroll-locked', 'true');
}

function releaseScrollLock(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  document.documentElement.removeAttribute('data-scroll-locked');
  document.body.style.paddingRight = previousPaddingRight;
  previousPaddingRight = '';
}

export function useGlobalScrollLock(): void {
  useEffect(() => {
    let locked = false;

    const sync = () => {
      const hasOpenModal = document.querySelector('[aria-modal="true"]') !== null;
      if (hasOpenModal && !locked) {
        locked = true;
        acquireScrollLock();
      } else if (!hasOpenModal && locked) {
        locked = false;
        releaseScrollLock();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'role'],
    });

    sync();

    return () => {
      observer.disconnect();
      if (locked) {
        locked = false;
        releaseScrollLock();
      }
    };
  }, []);
}
