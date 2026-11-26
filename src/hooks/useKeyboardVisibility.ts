import { useEffect } from 'react';
import {
  computeVisualViewportMetrics,
  ensureElementVisibleAboveKeyboard,
  isEditableElement,
  isMobileOrCoarseViewport,
} from '../utils/keyboardVisibility';

/**
 * Synchronizes CSS variables (`--vvh`, `--keyboard-inset`) and `data-keyboard-open`
 * with `window.visualViewport` + editable element focus, and automatically keeps the
 * active input visible above the soft keyboard on mobile/touch devices.
 */
export function useKeyboardVisibility(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    let activeEditableEl: HTMLElement | null = null;
    let timers: number[] = [];
    let blurTimer: number | null = null;

    const clearScheduledPasses = () => {
      for (const id of timers) {
        window.clearTimeout(id);
      }
      timers = [];
    };

    const syncViewportMetrics = () => {
      const vv = window.visualViewport;
      const isCoarseOrMobile = isMobileOrCoarseViewport();
      const activeEditable = isEditableElement(document.activeElement);

      const metrics = computeVisualViewportMetrics({
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        vvHeight: vv?.height,
        vvOffsetTop: vv?.offsetTop,
        activeEditable,
        isCoarseOrMobile,
      });

      root.style.setProperty('--vvh', `${metrics.visibleHeight}px`);
      root.style.setProperty('--keyboard-inset', `${metrics.keyboardInset}px`);

      if (metrics.isKeyboardOpen) {
        root.setAttribute('data-keyboard-open', 'true');
      } else {
        root.removeAttribute('data-keyboard-open');
      }

      return metrics;
    };

    const scheduleKeepVisible = (target: HTMLElement) => {
      clearScheduledPasses();
      // Pass 1: immediate / post-layout tick
      // Pass 2 & 3: after Android/iOS soft-keyboard slide animation settles
      const delays = [60, 220, 420];
      for (const delay of delays) {
        const id = window.setTimeout(() => {
          if (!target.isConnected || document.activeElement !== target) return;
          const metrics = syncViewportMetrics();
          if (metrics.isKeyboardOpen || metrics.keyboardInset > 40 || isMobileOrCoarseViewport()) {
            ensureElementVisibleAboveKeyboard(target);
          }
        }, delay);
        timers.push(id);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!isEditableElement(target)) {
        activeEditableEl = null;
        syncViewportMetrics();
        return;
      }

      activeEditableEl = target;
      syncViewportMetrics();
      scheduleKeepVisible(target);
    };

    const handleFocusOut = () => {
      clearScheduledPasses();
      blurTimer = window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          activeEditableEl = null;
        }
        syncViewportMetrics();
      }, 120);
    };

    const handleViewportChange = () => {
      const metrics = syncViewportMetrics();
      const target =
        activeEditableEl && activeEditableEl.isConnected
          ? activeEditableEl
          : isEditableElement(document.activeElement)
          ? document.activeElement
          : null;

      if (target && (metrics.isKeyboardOpen || metrics.keyboardInset > 40)) {
        ensureElementVisibleAboveKeyboard(target);
      }
    };

    syncViewportMetrics();

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('resize', handleViewportChange);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      clearScheduledPasses();
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('resize', handleViewportChange);
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      root.removeAttribute('data-keyboard-open');
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
