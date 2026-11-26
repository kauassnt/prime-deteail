import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, BellOff, BellRing, CheckCircle2, Loader2, Send, Smartphone } from 'lucide-react';
import {
  disablePushNotifications,
  enablePushNotifications,
  loadPushState,
  pushUnsupportedMessage,
  sendTestPush,
  type PushState,
} from '../../services/pushNotifications';

interface PushNotificationsCardProps {
  /** Abre o tutorial de instalação (iPhone exige o app na Tela de Início). */
  onShowInstallGuide?: () => void;
}

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

export const PushNotificationsCard: React.FC<PushNotificationsCardProps> = ({ onShowInstallGuide }) => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const refresh = useCallback(async () => {
    const next = await loadPushState();
    setState(next);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadPushState().then(next => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await enablePushNotifications();
      if (result.ok) {
        setFeedback({ tone: 'ok', text: 'Notificações ativadas neste dispositivo.' });
      } else {
        setFeedback({ tone: 'error', text: result.error || 'Não foi possível ativar.' });
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleDisable = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await disablePushNotifications();
      setFeedback({ tone: 'ok', text: 'Notificações desativadas neste dispositivo.' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleTest = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendTestPush();
      setFeedback(
        result.ok
          ? { tone: 'ok', text: 'Notificação de teste enviada. Confira a barra de avisos do celular.' }
          : { tone: 'error', text: result.error || 'Falha ao enviar o teste.' }
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const leadLabel = state
    ? state.leadMinutes >= 60 && state.leadMinutes % 60 === 0
      ? `${state.leadMinutes / 60} hora${state.leadMinutes === 60 ? '' : 's'}`
      : `${state.leadMinutes} minutos`
    : '1 hora';

  const active = Boolean(state?.subscribed && state?.permission === 'granted');
  const unsupportedReason = state && !state.supported ? state.reason : undefined;
  const blocked = Boolean(state?.supported) && state?.permission === 'denied';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
      <div className="flex items-start gap-3">
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            active ? 'bg-emerald-50 text-emerald-600' : 'bg-[#FFEDD5] text-[#A16207]'
          }`}
        >
          {active ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-slate-900">Notificações de agendamento</p>
            {active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Ativo
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-500 leading-snug mt-1">
            Receba no celular um aviso <strong className="text-slate-700">{leadLabel} antes</strong> de cada
            horário da agenda, mesmo com o app fechado.
          </p>

          {state === null && (
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando este dispositivo…
            </div>
          )}

          {unsupportedReason && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
              <Smartphone className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-snug text-amber-800">
                {pushUnsupportedMessage(unsupportedReason)}
              </p>
            </div>
          )}

          {unsupportedReason === 'ios-needs-install' && onShowInstallGuide && (
            <button
              type="button"
              onClick={onShowInstallGuide}
              className="mt-2 min-h-[36px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-bold transition"
            >
              Ver como instalar
            </button>
          )}

          {state?.supported && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {!active ? (
                <button
                  type="button"
                  onClick={() => void handleEnable()}
                  disabled={busy || blocked}
                  className="min-h-[36px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11.5px] font-extrabold inline-flex items-center gap-1.5 transition disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  Ativar notificações
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={busy}
                    className="min-h-[36px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11.5px] font-extrabold inline-flex items-center gap-1.5 transition disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar teste
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisable()}
                    disabled={busy}
                    className="min-h-[36px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-bold inline-flex items-center gap-1.5 transition disabled:opacity-60"
                  >
                    <BellOff className="w-3.5 h-3.5" /> Desativar
                  </button>
                </>
              )}
            </div>
          )}

          {blocked && (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-snug text-rose-800">
                As notificações estão bloqueadas para este app. Libere em Configurações → Notificações do
                site/app e ative novamente.
              </p>
            </div>
          )}

          {feedback && (
            <p
              className={`mt-2 text-[11px] font-semibold leading-snug ${
                feedback.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <p className="mt-2 text-[10.5px] text-slate-400 leading-snug">
            Android: funciona no navegador ou instalado. iPhone: somente com o app na Tela de Início (iOS
            16.4+).
          </p>
        </div>
      </div>
    </section>
  );
};
