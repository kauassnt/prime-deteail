import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Download,
  Zap,
  Share,
  PlusSquare,
  MoreVertical,
  MonitorDown,
  Lock,
  Headphones,
  ShieldCheck,
  X,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { BrandLogo } from '../common/BrandLogo';
import { PushNotificationsCard } from '../common/PushNotificationsCard';

type Device = 'ios' | 'android' | 'desktop';

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  caption: string;
}

const STEPS: Record<Device, Step[]> = {
  ios: [
    { icon: Share, caption: "Abra o PK Detail no Safari." },
    { icon: Share, caption: 'Toque em compartilhar.' },
    { icon: PlusSquare, caption: "Selecione 'Adicionar à Tela de Início'." },
    { icon: CheckCircle2, caption: "Confirme o toque em 'Adicionar'." },
    { icon: Smartphone, caption: 'Pronto! Ícone na tela inicial.' },
  ],
  android: [
    { icon: MoreVertical, caption: 'Abra o PK Detail no Chrome.' },
    { icon: MoreVertical, caption: 'Toque no menu de três pontos.' },
    { icon: Download, caption: "Selecione 'Instalar aplicativo'." },
    { icon: CheckCircle2, caption: "Confirme o toque em 'Instalar'." },
    { icon: Smartphone, caption: 'Pronto! Ícone na tela inicial.' },
  ],
  desktop: [
    { icon: MonitorDown, caption: 'Abra o PK Detail no Chrome ou Edge.' },
    { icon: Download, caption: 'Clique no ícone de instalar na barra de endereço.' },
    { icon: CheckCircle2, caption: "Confirme em 'Instalar'." },
    { icon: Smartphone, caption: 'Pronto! O app abre em janela própria.' },
  ],
};

const TITLE_BY_DEVICE: Record<Device, string> = {
  ios: 'Como instalar no iPhone',
  android: 'Como instalar no Android',
  desktop: 'Como instalar no Notebook/Desktop',
};

const HIGHLIGHTS = [
  { icon: Smartphone, title: 'Acesso em um toque', description: 'Abra o PK Detail direto pela tela inicial.' },
  { icon: RefreshCw, title: 'Sempre atualizado', description: 'As melhorias ficam disponíveis automaticamente.' },
  { icon: Download, title: 'Leve e rápido', description: 'Ocupa pouco espaço no dispositivo.' },
  { icon: Zap, title: 'Mais agilidade', description: 'Gerencie sua empresa de onde estiver.' },
];

export const InstallAppModule: React.FC = () => {
  const { settings } = useApp();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [device, setDevice] = useState<Device>(isIOS ? 'ios' : 'android');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const supportUrl = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`
    : null;

  const handleInstall = () => {
    if (isInstallable) {
      void install();
      return;
    }
    setTutorialOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 min-w-0 max-w-[1080px]">
      {/* Hero */}
      <section className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden min-w-0">
        <div className="p-5 sm:p-6 pr-4 sm:pr-6 flex items-start justify-between gap-4">
          <div className="min-w-0 max-w-[560px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EA580C] bg-[#FFEDD5] px-2.5 py-1 text-[10px] font-bold text-[#9A3412]">
              <Smartphone className="w-3 h-3" />
              PK Detail no Celular ou Notebook
            </span>
            <h1 className="text-2xl sm:text-[28px] font-black text-slate-900 leading-tight mt-2.5">
              Instale o PK Detail
              <br />
              no Celular ou Notebook!
            </h1>
            <p className="text-xs text-slate-500 mt-2 max-w-[440px]">
              Acesse a gestão da sua estética automotiva direto da tela inicial, com mais rapidez.
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-3.5">
              <button
                type="button"
                onClick={handleInstall}
                className="min-h-[38px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-2 transition"
              >
                <span className="w-5 h-5 rounded-full bg-slate-900/90 text-[#FDBA74] flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{isInstallable ? 'Instalar aplicativo' : 'Ver tutorial de instalação'}</span>
              </button>
              {isInstalled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> App instalado neste dispositivo
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:flex shrink-0 w-[190px] h-[190px] -mt-5 -mr-5 rounded-l-2xl bg-[#111827] items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(circle_at_30%_20%,#FDBA74,transparent_55%)]" />
            <div className="relative flex flex-col items-center gap-2">
              <BrandLogo variant="icon" className="w-16 h-16 rounded-2xl shadow-lg" />
              <span className="text-[10px] font-bold text-white/80 tracking-wide">PK DETAIL</span>
            </div>
          </div>
        </div>
      </section>

      <PushNotificationsCard onShowInstallGuide={() => setTutorialOpen(true)} />

      {/* Highlights */}
      <section className="rounded-2xl border border-slate-200 bg-white px-3 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {HIGHLIGHTS.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex flex-col items-center text-center gap-1.5 px-1.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFEDD5] text-[#A16207] flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
              <p className="text-[11.5px] font-extrabold text-slate-900 leading-tight">{item.title}</p>
              <p className="text-[10.5px] text-slate-500 leading-snug">{item.description}</p>
            </div>
          );
        })}
      </section>

      {/* Device guide */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900 mr-1">Escolha seu dispositivo</p>
          <div className="flex items-center gap-1.5">
            {([
              { id: 'ios' as Device, label: 'iPhone (iOS)', icon: Smartphone },
              { id: 'android' as Device, label: 'Android', icon: Smartphone },
              { id: 'desktop' as Device, label: 'Notebook/Desktop', icon: MonitorDown },
            ]).map(item => {
              const Icon = item.icon;
              const selected = device === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDevice(item.id)}
                  className={`relative min-h-[34px] px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                    selected
                      ? 'bg-[#FFEDD5] border border-[#EA580C] text-[#9A3412]'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.id === 'ios' && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#EA580C] text-white text-[8px] font-black flex items-center justify-center">
                      1
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs font-bold text-slate-900 mt-4">{TITLE_BY_DEVICE[device]}</p>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STEPS[device].map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={`${device}-${index}`} className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col items-center gap-1.5 w-[62px] shrink-0">
                  <div className="relative">
                    <span className="w-10 h-10 rounded-xl border border-[#EA580C] bg-[#FFEDD5]/50 text-[#A16207] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#EA580C] text-white text-[9px] font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-600 leading-snug min-w-0">{step.caption}</p>
                {index < STEPS[device].length - 1 && (
                  <span className="hidden lg:block text-[#FDBA74] text-sm shrink-0" aria-hidden="true">
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-2.5">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-extrabold text-slate-900">Tecnologia PWA segura</p>
            <p className="text-[10.5px] text-slate-600 leading-snug">
              Conexão segura e seus dados sempre protegidos.
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
              <Lock className="w-3 h-3" /> Conexão criptografada
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#A16207] flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-extrabold text-slate-900">Precisa de ajuda?</p>
            <p className="text-[10.5px] text-slate-500 leading-snug">Nossa equipe te ajuda em cada passo.</p>
          </div>
          <a
            href={supportUrl || undefined}
            target="_blank"
            rel="noreferrer"
            onClick={e => {
              if (!supportUrl) e.preventDefault();
            }}
            className="shrink-0 min-h-[34px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center transition"
          >
            Suporte
          </a>
        </section>
      </div>

      {/* Tutorial modal */}
      {tutorialOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tutorial de instalação"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 max-h-[85dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-900">Instalar o PK Detail</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Siga os passos no seu dispositivo.</p>
              </div>
              <button
                type="button"
                onClick={() => setTutorialOpen(false)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {([
                { id: 'ios' as Device, label: 'iPhone' },
                { id: 'android' as Device, label: 'Android' },
                { id: 'desktop' as Device, label: 'Notebook' },
              ]).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDevice(item.id)}
                  className={`flex-1 min-h-[30px] rounded-lg text-[11px] font-bold transition ${
                    device === item.id
                      ? 'bg-[#FFEDD5] border border-[#EA580C] text-[#9A3412]'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {STEPS[device].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={`modal-${device}-${index}`} className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-3 py-2">
                    <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-snug flex items-center gap-1.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{step.caption}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTutorialOpen(false)}
                className="min-h-[36px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Fechar
              </button>
              {isInstallable && (
                <button
                  type="button"
                  onClick={() => {
                    void install();
                    setTutorialOpen(false);
                  }}
                  className="min-h-[36px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
                >
                  Instalar agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
