import React, { useState } from 'react';
import { MessageCircle, Clock, X, Headphones } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useApp } from '../../context/AppContext';
import { companyDisplayName } from '../../utils/company';

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '';
const SUPPORT_HOURS = 'Segunda a sexta, das 9h às 17h';

export const SupportCenterModule: React.FC = () => {
  const { settings } = useApp();
  const [missingNumber, setMissingNumber] = useState(false);

  const openSupport = () => {
    if (!SUPPORT_WHATSAPP) {
      setMissingNumber(true);
      return;
    }
    const text = encodeURIComponent(`Olá! Preciso de ajuda com o ${companyDisplayName(settings)}.`);
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[calc(100dvh-190px)] px-4 py-10">
      <div className="rounded-[26px] bg-[#FFEDD5]/70 p-3">
        <BrandLogo variant="icon" className="w-14 h-14 rounded-2xl" />
      </div>

      <h1 className="text-[26px] sm:text-3xl font-black text-slate-900 tracking-tight mt-4">Central de Suporte</h1>
      <p className="text-xs text-slate-500 mt-2 max-w-[340px] leading-relaxed">
        Precisa de ajuda com o PK Detail? Nossa equipe está pronta para te atender!
      </p>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 mt-3.5">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        {SUPPORT_HOURS}
      </span>

      <button
        type="button"
        onClick={openSupport}
        className="mt-5 min-h-[42px] px-6 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-extrabold uppercase tracking-wide flex items-center gap-2 transition shadow-sm active:scale-[0.98]"
      >
        <MessageCircle className="w-4 h-4" />
        <span>Falar com suporte</span>
      </button>

      <p className="text-[10.5px] text-slate-400 mt-2.5">Atendimento humanizado via WhatsApp</p>

      {missingNumber && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Suporte"
            className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 text-left space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#A16207] flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-black text-slate-900">Suporte via WhatsApp</h2>
              </div>
              <button
                type="button"
                onClick={() => setMissingNumber(false)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O número de WhatsApp do suporte ainda não foi configurado. Defina a variável{' '}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                VITE_SUPPORT_WHATSAPP
              </code>{' '}
              com DDI + DDD + número (ex.: 5511999999999) para habilitar o botão.
            </p>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Horário de atendimento</p>
              <p className="text-[11px] font-semibold text-slate-700 mt-0.5">{SUPPORT_HOURS}</p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMissingNumber(false)}
                className="min-h-[36px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
