import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageCircle, ExternalLink, Copy, Check, X, Sparkles, ArrowRight } from 'lucide-react';

export const AutoWhatsappBanner: React.FC = () => {
  const {
    activeWhatsappPrompt,
    dismissWhatsappPrompt,
    markWhatsappLogSent,
    setActiveModule,
  } = useApp();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [activeWhatsappPrompt?.id]);

  if (!activeWhatsappPrompt) return null;

  const isWebhookSending =
    activeWhatsappPrompt.mode === 'webhook_api' && activeWhatsappPrompt.deliveryStatus === 'enviando';
  const isWebhookSent =
    activeWhatsappPrompt.mode === 'webhook_api' && activeWhatsappPrompt.deliveryStatus === 'enviada';
  const isWebhookError = activeWhatsappPrompt.deliveryStatus === 'erro';
  const hasValidUrl = activeWhatsappPrompt.whatsappUrl && activeWhatsappPrompt.whatsappUrl !== '#';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeWhatsappPrompt.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-20 md:bottom-5 right-3 left-3 sm:left-auto sm:w-[min(26rem,calc(100vw-2rem))] z-40 bg-white rounded-2xl border-2 border-[#EA580C] shadow-2xl p-3.5 sm:p-4 text-left pk-sheet-enter"
    >
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#9A3412] flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-slate-900 truncate">
                {isWebhookSending
                  ? 'Enviando via Webhook...'
                  : isWebhookSent
                  ? 'WhatsApp Enviado via API'
                  : isWebhookError
                  ? 'Falha no Envio — Verifique'
                  : 'WhatsApp Pronto p/ Cliente'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#9A3412] shrink-0">
                {activeWhatsappPrompt.orderId || 'OS'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {activeWhatsappPrompt.clientName} · {activeWhatsappPrompt.clientPhone}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissWhatsappPrompt}
          aria-label="Fechar aviso WhatsApp"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-[11px] text-slate-700 max-h-28 overflow-y-auto pk-scroll-compact whitespace-pre-wrap wrap-anywhere leading-relaxed">
        {activeWhatsappPrompt.message}
      </div>

      {activeWhatsappPrompt.errorMessage && (
        <p className="mt-1.5 text-[11px] font-semibold text-rose-600 wrap-anywhere">
          Detalhe: {activeWhatsappPrompt.errorMessage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasValidUrl ? (
          <a
            href={activeWhatsappPrompt.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => markWhatsappLogSent(activeWhatsappPrompt.id)}
            className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <span>{isWebhookSent ? 'Abrir Conversa' : 'Enviar no WhatsApp'}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        ) : (
          <span className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center">
            Número sem WhatsApp válido
          </span>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[38px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 transition shrink-0"
          title="Copiar mensagem"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#EA580C]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiada' : 'Copiar'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('whatsapp');
            dismissWhatsappPrompt();
          }}
          className="min-h-[38px] px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition shrink-0"
          title="Abrir Módulo WhatsApp"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
