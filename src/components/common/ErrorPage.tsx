import React from 'react';
import { Home, RotateCcw, AlertTriangle } from 'lucide-react';

export interface ErrorPageProps {
  /** Código exibido (404, 500...). */
  code?: string;
  title?: string;
  description?: string;
  /** Detalhe técnico opcional (mensagem do erro), exibido em um bloco recolhível. */
  detail?: string;
  /** Ação principal: voltar para o início do sistema. */
  onHome?: () => void;
  /** Ação secundária: recarregar a página. Padrão: window.location.reload(). */
  onRetry?: () => void;
}

/**
 * Página de erro em tela cheia, usada em rotas de erro (/erro) e como fallback
 * quando o app inteiro falha na renderização.
 */
export const ErrorPage: React.FC<ErrorPageProps> = ({
  code = '404',
  title = 'Página não encontrada',
  description = 'O endereço acessado não existe ou foi movido. Volte para o início e continue de onde parou.',
  detail,
  onHome,
  onRetry,
}) => (
  <div className="min-h-dvh w-full bg-[#FFFBF7] text-[#171717] font-sans antialiased flex items-center justify-center px-5 py-10">
    <div role="alert" className="w-full max-w-md text-center">
      <span className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#9A3412] to-[#EA580C] text-white items-center justify-center shadow-lg shadow-orange-950/15">
        <AlertTriangle className="w-6 h-6" />
      </span>

      <p className="mt-4 text-[10.5px] font-extrabold tracking-[0.2em] uppercase text-slate-400">
        Erro {code}
      </p>
      <h1 className="mt-1 text-[26px] leading-tight font-black tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{description}</p>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            className="min-h-[44px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[13px] font-bold flex items-center justify-center gap-2 transition"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Ir para o início</span>
          </button>
        )}
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          className="min-h-[44px] px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-[13px] font-bold flex items-center justify-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Recarregar página</span>
        </button>
      </div>

      {detail && (
        <details className="mt-6 text-left rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="text-[11.5px] font-bold text-slate-600 cursor-pointer">
            Detalhes técnicos
          </summary>
          <p className="mt-2 text-[11px] font-mono text-slate-500 break-words">{detail}</p>
        </details>
      )}

      <p className="mt-6 text-[11px] text-slate-400">PK Detail · seus dados locais permanecem salvos.</p>
    </div>
  </div>
);
