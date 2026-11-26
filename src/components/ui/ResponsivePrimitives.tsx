import React from 'react';
import { X } from 'lucide-react';
import { useModalResponsive } from '../../hooks/useModalResponsive';

interface PageHeaderProps {
  title: string;
  badge?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  subtitle,
  actions
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3 bg-white pk-page-header rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="fluid-heading font-black text-slate-900 tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 wrap-anywhere">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end min-w-0">
          {actions}
        </div>
      )}
    </div>
  );
};

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  children: React.ReactNode;
  headerClassName?: string;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
  headerClassName
}) => {
  const { overlayProps, modalProps } = useModalResponsive({
    isOpen,
    onClose,
    ariaLabel: typeof title === 'string' ? title : undefined,
  });

  if (!isOpen) return null;

  return (
    <div
      {...overlayProps}
      className="fixed inset-x-0 top-0 z-50 h-[var(--vvh,100dvh)] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pk-fade-enter"
    >
      <div
        {...modalProps}
        className={`modal-responsive-shell w-full ${maxWidthMap[maxWidth]} max-w-[100vw] max-h-[min(88dvh,calc(var(--vvh,100dvh)-14px))] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pk-sheet-enter sm:pk-modal-enter`}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0 bg-white">
          <span className="w-9 h-1 rounded-full bg-slate-200/90" aria-hidden="true" />
        </div>
        <div
          className={`sticky top-0 z-10 pk-modal-header border-b border-slate-100 flex items-center justify-between gap-2.5 shrink-0 bg-white ${headerClassName || ''}`}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-extrabold leading-snug truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs opacity-75 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:bg-black/10 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pk-scroll-compact pk-modal-body safe-area-bottom modal-responsive-scroll min-w-0 pb-8 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
};
