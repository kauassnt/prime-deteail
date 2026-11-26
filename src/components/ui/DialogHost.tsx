import React, { useEffect, useSyncExternalStore } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import { resolveDialog, subscribeDialog, getDialogSnapshot } from '../../services/dialogService';

/**
 * Renderiza os diálogos de confirmar/avisar com o visual do PK Detail.
 * Fica montado uma única vez na raiz do App.
 */
export const DialogHost: React.FC = () => {
  const dialog = useSyncExternalStore(subscribeDialog, getDialogSnapshot, getDialogSnapshot);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveDialog(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        resolveDialog(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog]);

  if (!dialog) return null;

  const isDanger = dialog.tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 pk-fade-enter"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) resolveDialog(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-dialog-title"
        aria-describedby="pk-dialog-message"
        className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pk-modal-enter"
      >
        <div
          className={`flex items-start gap-2.5 px-4 pt-3.5 pb-3 border-b border-slate-100 ${
            isDanger ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-[#EA580C]'
          }`}
        >
          <span
            className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-[#EA580C]'
            }`}
          >
            {isDanger ? <AlertTriangle className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
          </span>
          <h2 id="pk-dialog-title" className="flex-1 min-w-0 text-sm font-black text-slate-900 leading-snug pt-1.5">
            {dialog.title}
          </h2>
          <button
            type="button"
            onClick={() => resolveDialog(false)}
            aria-label="Fechar"
            className="w-8 h-8 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="pk-dialog-message" className="px-4 py-4 text-[13px] text-slate-600 leading-relaxed">
          {dialog.message}
        </p>

        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          {dialog.kind === 'confirm' && (
            <button
              type="button"
              onClick={() => resolveDialog(false)}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              {dialog.cancelLabel}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => resolveDialog(true)}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-extrabold text-white transition ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#EA580C] hover:bg-[#C2410C]'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
