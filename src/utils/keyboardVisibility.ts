export interface VisualViewportMetricsInput {
  innerHeight: number;
  innerWidth: number;
  vvHeight?: number | null;
  vvOffsetTop?: number | null;
  activeEditable: boolean;
  isCoarseOrMobile: boolean;
}

export interface VisualViewportMetrics {
  visibleHeight: number;
  keyboardInset: number;
  isKeyboardOpen: boolean;
}

export interface ScrollAdjustmentInput {
  elementTop: number;
  elementBottom: number;
  visibleTop: number;
  visibleBottom: number;
  containerTop?: number;
  containerBottom?: number;
  stickyHeaderHeight?: number;
  bottomKeyboardClearance?: number;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
  'hidden',
  'image',
]);

export function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;

  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return !(el as HTMLTextAreaElement | HTMLSelectElement).disabled;
  }

  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.disabled || input.readOnly) return false;
    const type = (input.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }

  return false;
}

export function isMobileOrCoarseViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.innerWidth < 1024;
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return narrow || coarse;
}

export function computeVisualViewportMetrics(
  input: VisualViewportMetricsInput
): VisualViewportMetrics {
  const baseHeight = Math.max(240, Math.round(input.innerHeight || 0));
  const rawVvHeight =
    typeof input.vvHeight === 'number' && input.vvHeight > 0 ? input.vvHeight : baseHeight;
  const visibleHeight = Math.max(200, Math.round(rawVvHeight));
  const offsetTop = typeof input.vvOffsetTop === 'number' ? Math.max(0, input.vvOffsetTop) : 0;

  // On iOS Safari / overlay keyboards, innerHeight stays full height while visualViewport.height shrinks.
  // On Android Chrome with interactive-widget=resizes-content, innerHeight & vvHeight shrink together (inset ~ 0).
  const rawInset = Math.round(baseHeight - visibleHeight - offsetTop);
  const keyboardInset = rawInset > 40 ? rawInset : 0;

  const isKeyboardOpen =
    keyboardInset > 80 || (input.activeEditable && input.isCoarseOrMobile);

  return {
    visibleHeight,
    keyboardInset,
    isKeyboardOpen,
  };
}

export function computeScrollAdjustment(input: ScrollAdjustmentInput): number {
  const {
    elementTop,
    elementBottom,
    visibleTop,
    visibleBottom,
    containerTop = visibleTop,
    containerBottom = visibleBottom,
    stickyHeaderHeight = 0,
    bottomKeyboardClearance = 24,
  } = input;

  const safeTop = Math.max(visibleTop + 12, containerTop + stickyHeaderHeight + 12);
  const safeBottom = Math.min(visibleBottom, containerBottom) - bottomKeyboardClearance;

  if (safeBottom <= safeTop + 20) {
    return Math.round(elementTop - safeTop);
  }

  const isClippedTop = elementTop < safeTop;
  const isClippedBottom = elementBottom > safeBottom;

  if (!isClippedTop && !isClippedBottom) {
    return 0;
  }

  const availableHeight = safeBottom - safeTop;
  const elementHeight = Math.max(24, elementBottom - elementTop);

  // Place focused field around ~36% of the clear band above the keyboard so its label & typed text are clearly visible
  const preferredOffset = Math.max(
    12,
    Math.min(Math.round(availableHeight * 0.36), Math.max(12, availableHeight - elementHeight - 16))
  );
  const targetTop = safeTop + preferredOffset;

  return Math.round(elementTop - targetTop);
}

function getStickyHeaderClearance(container: HTMLElement): number {
  const containerRect = container.getBoundingClientRect();
  let clearance = 0;

  // Check immediate sticky header or sibling header right above scroll container
  const prevSibling = container.previousElementSibling;
  if (prevSibling instanceof HTMLElement) {
    const style = window.getComputedStyle(prevSibling);
    if (style.position === 'sticky' || style.position === 'fixed') {
      const sibRect = prevSibling.getBoundingClientRect();
      if (sibRect.bottom > containerRect.top) {
        clearance = Math.max(clearance, Math.round(sibRect.bottom - containerRect.top));
      }
    }
  }

  const stickyChildren = container.querySelectorAll('.sticky, [class*="sticky"]');
  for (let i = 0; i < stickyChildren.length; i++) {
    const child = stickyChildren[i];
    if (!(child instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(child);
    if (style.position !== 'sticky' && style.position !== 'fixed') continue;
    const rect = child.getBoundingClientRect();
    if (rect.top <= containerRect.top + 8 && rect.height < 140) {
      clearance = Math.max(clearance, Math.round(rect.bottom - containerRect.top));
    }
  }

  return clearance;
}

export function findScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const containers: HTMLElement[] = [];
  let current = el.parentElement;

  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight + 2
    ) {
      containers.push(current);
    }
    current = current.parentElement;
  }

  return containers;
}

export function ensureElementVisibleAboveKeyboard(el: HTMLElement): void {
  if (typeof window === 'undefined' || !el.isConnected) return;

  const vv = window.visualViewport;
  const vvTop = vv ? vv.offsetTop : 0;
  const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

  const containers = findScrollableAncestors(el);

  for (const container of containers) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const stickyClearance = getStickyHeaderClearance(container);

    const deltaY = computeScrollAdjustment({
      elementTop: elRect.top,
      elementBottom: elRect.bottom,
      visibleTop: vvTop,
      visibleBottom: vvBottom,
      containerTop: containerRect.top,
      containerBottom: containerRect.bottom,
      stickyHeaderHeight: stickyClearance,
      bottomKeyboardClearance: 24,
    });

    if (Math.abs(deltaY) > 4) {
      container.scrollBy({
        top: deltaY,
        behavior: 'smooth',
      });
    }
  }

  // Also ensure element is visible in window / visualViewport if not fully resolved by containers
  const finalRect = el.getBoundingClientRect();
  const topNavbar = document.querySelector('header.sticky, nav.sticky');
  let navbarClearance = 0;
  if (topNavbar instanceof HTMLElement) {
    const navRect = topNavbar.getBoundingClientRect();
    if (navRect.top <= vvTop + 6 && navRect.height < 120) {
      navbarClearance = Math.round(navRect.bottom - vvTop);
    }
  }

  const windowDeltaY = computeScrollAdjustment({
    elementTop: finalRect.top,
    elementBottom: finalRect.bottom,
    visibleTop: vvTop,
    visibleBottom: vvBottom,
    containerTop: vvTop,
    containerBottom: vvBottom,
    stickyHeaderHeight: navbarClearance,
    bottomKeyboardClearance: 28,
  });

  if (Math.abs(windowDeltaY) > 4 && containers.length === 0) {
    window.scrollBy({
      top: windowDeltaY,
      behavior: 'smooth',
    });
  } else if (finalRect.bottom > vvBottom - 16 || finalRect.top < vvTop + 12) {
    window.scrollBy({
      top: windowDeltaY,
      behavior: 'smooth',
    });
  }
}
