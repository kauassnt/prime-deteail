import React, { useEffect, useCallback } from 'react';

export interface UseModalResponsiveOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
  lockBodyScroll?: boolean;
  maxHeight?: string;
  ariaLabel?: string;
}

export interface UseModalResponsiveReturn {
  overlayProps: {
    role: 'dialog';
    'aria-modal': true;
    'aria-label'?: string;
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
  };
  modalProps: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    style: React.CSSProperties;
  };
  modalClasses: string;
}

// Track active modal count so nested modals do not prematurely unlock body scroll
let activeModalCount = 0;

/**
 * Centralizes responsive modal behavior across all modules:
 * - Enforces max-height: 80vh and overflow-y: auto so modals never escape the viewport
 * - Handles Esc key press consistently
 * - Handles overlay click consistently (ignoring clicks inside the modal panel)
 * - Locks background document scroll while open
 */
export function useModalResponsive({
  isOpen,
  onClose,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  lockBodyScroll = true,
  maxHeight = '80vh',
  ariaLabel,
}: UseModalResponsiveOptions): UseModalResponsiveReturn {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEsc, onClose]);

  useEffect(() => {
    if (!isOpen || !lockBodyScroll) return;

    activeModalCount += 1;
    const previousOverflow = document.body.style.overflow;
    if (activeModalCount === 1) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = previousOverflow || '';
      }
    };
  }, [isOpen, lockBodyScroll]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!closeOnOverlayClick) return;
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  const handleModalClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return {
    overlayProps: {
      role: 'dialog',
      'aria-modal': true,
      ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      onClick: handleOverlayClick,
    },
    modalProps: {
      onClick: handleModalClick,
      style: maxHeight === '80vh'
        ? {}
        : {
            maxHeight,
            overflowY: 'auto',
          },
    },
    modalClasses:
      maxHeight === '80vh'
        ? 'modal-responsive-panel max-h-[min(85dvh,calc(var(--vvh,100dvh)-16px))] overflow-y-auto'
        : 'overflow-y-auto',
  };
}
