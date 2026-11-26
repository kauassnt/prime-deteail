import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomerPortalConfig } from '../../types';
import defaultStudioHeroImg from '../../assets/images/pk_detail_hero_studio_1794590546785.jpg';
import {
  Globe,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  Search,
  Sparkles,
  Camera,
  DollarSign,
  MapPin,
  MessageCircle,
  ShieldCheck,
  RotateCcw,
  Save,
  Upload,
  Plus,
  X,
  Bike
} from 'lucide-react';
import {
  DEFAULT_APPOINTMENT_SLOTS,
  PRESET_ONE_HOUR_CANDIDATE_SLOTS,
  formatSlotRange,
  isSlotWithinBusinessHours
} from '../../utils/schedulingUtils';

const PRESET_SLOTS = PRESET_ONE_HOUR_CANDIDATE_SLOTS;

interface ToggleOption {
  key: keyof Pick<
    CustomerPortalConfig,
    | 'allowOnlineBooking'
    | 'allowOrderTracking'
    | 'allowServicesCatalog'
    | 'showPrices'
    | 'showBeforeAfterPhotos'
    | 'showPaymentSummaryInTracking'
    | 'showLocationAndHours'
    | 'showWhatsappButton'
    | 'showStudioHighlights'
  >;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FEATURE_TOGGLES: ToggleOption[] = [
  {
    key: 'allowOnlineBooking',
    label: 'Agendamento Online',
    description: 'Permite que o cliente solicite reservas de data e horário pelo portal.',
    icon: Calendar,
  },
  {
    key: 'allowOrderTracking',
    label: 'Acompanhar Minha Moto',
    description: 'Consulta em tempo real do andamento da OS pela placa ou número.',
    icon: Search,
  },
  {
    key: 'allowServicesCatalog',
    label: 'Tabela de Serviços',
    description: 'Exibe o catálogo completo de lavagens, detalhamento e acabamentos.',
    icon: Sparkles,
  },
  {
    key: 'showPrices',
    label: 'Exibir Valores Públicos',
    description: 'Mostra preços nos cartões. Se desativado, exibe "Sob consulta".',
    icon: DollarSign,
  },
  {
    key: 'showBeforeAfterPhotos',
    label: 'Galeria Antes & Depois',
    description: 'Exibe fotos registradas pela equipe na tela de acompanhamento.',
    icon: Camera,
  },
  {
    key: 'showPaymentSummaryInTracking',
    label: 'Resumo de Pagamento na OS',
    description: 'Mostra total, valor já pago e saldo pendente quando o cliente consulta a placa.',
    icon: ShieldCheck,
  },
  {
    key: 'showLocationAndHours',
    label: 'Endereço e Horários',
    description: 'Exibe localização do estúdio, dias de funcionamento e horários de atendimento.',
    icon: MapPin,
  },
  {
    key: 'showWhatsappButton',
    label: 'Contato Direto WhatsApp',
    description: 'Exibe botão de atendimento rápido pelo WhatsApp oficial da empresa.',
    icon: MessageCircle,
  },
  {
    key: 'showStudioHighlights',
    label: 'Pilares & Diferenciais',
    description: 'Exibe os 3 cartões de diferenciais técnicos logo abaixo da capa.',
    icon: ShieldCheck,
  },
];

interface CustomerPortalConfigPanelProps {
  onOpenPreview?: () => void;
}

export const CustomerPortalConfigPanel: React.FC<CustomerPortalConfigPanelProps> = ({ onOpenPreview }) => {
  const {
    portalConfig,
    updatePortalConfig,
    resetPortalConfig,
    enterClientOnlyMode
  } = useApp();

  const [draft, setDraft] = useState<CustomerPortalConfig>(portalConfig);
  const [customSlot, setCustomSlot] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);

  useEffect(() => {
    setDraft(portalConfig);
  }, [portalConfig]);

  const publicPortalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?portal=1`
      : '?portal=1';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicPortalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = publicPortalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleToggleSlot = (slot: string) => {
    setDraft(prev => {
      const exists = prev.availableTimeSlots.includes(slot);
      const nextSlots = exists
        ? prev.availableTimeSlots.filter(s => s !== slot)
        : [...prev.availableTimeSlots, slot].sort();
      return { ...prev, availableTimeSlots: nextSlots };
    });
  };

  const [slotNotice, setSlotNotice] = useState<string | null>(null);

  const handleAddCustomSlot = () => {
    const clean = customSlot.trim();
    if (!/^\d{2}:\d{2}$/.test(clean)) return;
    if (!isSlotWithinBusinessHours(clean)) {
      setSlotNotice('Cada lavagem requer 1h00 e o expediente vai das 09:00 às 17:00 (início máximo às 16:00).');
      return;
    }
    setSlotNotice(null);
    if (!draft.availableTimeSlots.includes(clean)) {
      setDraft(prev => ({
        ...prev,
        availableTimeSlots: [...prev.availableTimeSlots, clean].sort(),
      }));
    }
    setCustomSlot('');
  };

  const handleUploadHeroImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setHeroImgError(false);
        setDraft(prev => ({ ...prev, heroImageUrl: reader.result as string, showHeroImage: true }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPin = draft.kioskPin.replace(/\D/g, '').slice(0, 8) || '1234';
    const validSlots = draft.availableTimeSlots.filter(s => isSlotWithinBusinessHours(s));
    const nextConfig: CustomerPortalConfig = {
      ...draft,
      kioskPin: normalizedPin,
      availableTimeSlots: validSlots.length > 0 ? validSlots : [...DEFAULT_APPOINTMENT_SLOTS],
    };
    updatePortalConfig(nextConfig);
    setDraft(nextConfig);
    setSlotNotice(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3200);
  };

  const handleRestoreDefaults = () => {
    resetPortalConfig();
    setConfirmReset(false);
    setHeroImgError(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3200);
  };

  const allDisplaySlots = Array.from(
    new Set([...PRESET_SLOTS, ...draft.availableTimeSlots.filter(s => isSlotWithinBusinessHours(s))])
  ).sort();
  const activeHeroSrc = draft.heroImageUrl.trim() ? draft.heroImageUrl : defaultStudioHeroImg;

  return (
    <form onSubmit={handleSave} className="pk-section-stack text-left min-w-0">
      {/* Top Access & Isolation Control Card */}
      <div className="bg-[#171717] text-white rounded-2xl border border-neutral-800 pk-card-pad space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-[#F97316] block">
              Acesso Público & Isolamento do Cliente
            </span>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Controle de Visibilidade e Link Exclusivo do Cliente
            </h2>
            <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
              Compartilhe o link direto ou ative o Modo Cliente Exclusivo para que visitantes e tablets de recepção acessem apenas o Portal do Cliente, sem acesso ao sistema administrativo interno.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenPreview && (
              <button
                type="button"
                onClick={onOpenPreview}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-neutral-700 text-neutral-200 hover:bg-neutral-800 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>Visualizar Portal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => enterClientOnlyMode(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs font-bold flex items-center gap-2 transition whitespace-nowrap"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Ativar Modo Cliente Exclusivo</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap pt-3.5 border-t border-neutral-800 items-end">
          <div className="lg:col-span-8 space-y-1.5 min-w-0">
            <label className="text-xs font-semibold text-neutral-300 block">
              Link Público Direto (abre somente o Portal do Cliente)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-neutral-200 truncate select-all">
                {publicPortalUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 font-bold text-xs flex items-center justify-center gap-2 transition shrink-0 whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-4 h-4 text-orange-600 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span>{copiedLink ? 'Link Copiado' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 block">
              PIN de Desbloqueio Admin (Modo Quiosque)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={draft.kioskPin}
              onChange={e => setDraft(prev => ({ ...prev, kioskPin: e.target.value.replace(/\D/g, '') }))}
              placeholder="Ex: 1234"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white tracking-widest focus:border-[#EA580C] focus:outline-hidden tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Save Feedback */}
      {savedNotice && (
        <div className="px-4 py-3 rounded-xl bg-[#FFEDD5] border border-[#EA580C]/30 text-[#9A3412] text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>Configurações do Portal do Cliente salvas e aplicadas em tempo real.</span>
        </div>
      )}

      {/* Section 1: Portal Availability & Maintenance */}
      <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Disponibilidade do Portal</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pause temporariamente o portal externo caso o estúdio esteja em manutenção ou com agenda fechada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition shrink-0 whitespace-nowrap ${
              draft.portalEnabled
                ? 'bg-[#FFEDD5] border-[#EA580C]/40 text-[#9A3412]'
                : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}
          >
            {draft.portalEnabled ? <Globe className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
            <span>{draft.portalEnabled ? 'Portal Ativo (Online)' : 'Portal Pausado (Manutenção)'}</span>
          </button>
        </div>

        {!draft.portalEnabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Mensagem exibida enquanto o portal estiver pausado
            </label>
            <textarea
              rows={2}
              value={draft.maintenanceMessage}
              onChange={e => setDraft(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>
        )}
      </div>

      {/* Section 2: Hero Presentation & Photography */}
      <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-3.5">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Identidade Visual & Capa do Portal</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalize os textos principais, aviso promocional e imagem de destaque exibidos para o cliente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap items-start">
          <div className="lg:col-span-7 pk-form-stack text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Etiqueta de Especialidade</label>
              <input
                type="text"
                value={draft.heroBadge}
                onChange={e => setDraft(prev => ({ ...prev, heroBadge: e.target.value }))}
                placeholder="Ex: Estúdio Especializado em Motocicletas"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Título Principal da Capa</label>
              <input
                type="text"
                required
                value={draft.heroTitle}
                onChange={e => setDraft(prev => ({ ...prev, heroTitle: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Subtítulo / Descrição de Valor</label>
              <textarea
                rows={3}
                value={draft.heroSubtitle}
                onChange={e => setDraft(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Faixa de Aviso ou Campanha (opcional — deixe vazio para ocultar)
              </label>
              <input
                type="text"
                value={draft.promoNotice}
                onChange={e => setDraft(prev => ({ ...prev, promoNotice: e.target.value }))}
                placeholder="Ex: Semana da Vitrificação: 10% de bônus em proteção cerâmica até sábado."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">Fotografia do Estúdio na Capa</span>
              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, showHeroImage: !prev.showHeroImage }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap ${
                  draft.showHeroImage
                    ? 'bg-[#FFEDD5] border-[#EA580C]/40 text-[#9A3412]'
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                {draft.showHeroImage ? 'Foto Visível' : 'Foto Oculta'}
              </button>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-slate-200 flex items-center justify-center">
              {draft.showHeroImage && !heroImgError ? (
                <img
                  src={activeHeroSrc}
                  alt="Prévia da capa do estúdio PK Detail"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-neutral-400 p-4 text-center">
                  <Bike className="w-8 h-8 text-[#EA580C]" />
                  <span className="text-xs font-medium">
                    {draft.showHeroImage ? 'Visualização alternativa em gradiente escuro' : 'Capa tipográfica sem fotografia'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="min-h-[38px] px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Enviar Outra Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadHeroImage}
                  className="hidden"
                />
              </label>

              {draft.heroImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setHeroImgError(false);
                    setDraft(prev => ({ ...prev, heroImageUrl: '' }));
                  }}
                  className="min-h-[38px] px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition whitespace-nowrap"
                >
                  Usar Foto Padrão PK Detail
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Feature Toggles */}
      <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-3">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Recursos e Privacidade Visíveis ao Cliente</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Defina exatamente quais abas e informações os clientes podem acessar no portal público.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 pk-grid-gap">
          {FEATURE_TOGGLES.map(item => {
            const Icon = item.icon;
            const enabled = Boolean(draft[item.key]);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`text-left p-3 sm:p-3.5 rounded-xl border transition flex items-start justify-between gap-2.5 ${
                  enabled
                    ? 'bg-[#FFFBF7] border-[#EA580C]/40'
                    : 'bg-slate-50/80 border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 shrink-0 ${enabled ? 'text-[#EA580C]' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-900">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{item.description}</p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 whitespace-nowrap ${
                    enabled ? 'bg-[#EA580C] text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {enabled ? 'Ativo' : 'Oculto'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Booking Time Slots & Confirmation Message */}
      <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-3">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Grade de Horários (09:00 às 17:00 · Blocos de 1h00)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cada lavagem requer 1h00 e apenas horários sem reserva aparecem disponíveis para o cliente (agendamento único por horário).
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {allDisplaySlots.map(slot => {
              const active = draft.availableTimeSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleToggleSlot(slot)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition tabular-nums flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#9A3412] text-white border-[#9A3412]'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatSlotRange(slot)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="time"
              min="09:00"
              max="16:00"
              value={customSlot}
              onChange={e => {
                setCustomSlot(e.target.value);
                setSlotNotice(null);
              }}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
            />
            <button
              type="button"
              onClick={handleAddCustomSlot}
              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Adicionar Horário (09:00–16:00)</span>
            </button>
          </div>

          {slotNotice && (
            <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {slotNotice}
            </p>
          )}
        </div>

        <div className="pt-2 space-y-1.5 text-xs">
          <label className="block font-semibold text-slate-700">
            Mensagem de Confirmação Pós-Agendamento
          </label>
          <textarea
            rows={2}
            value={draft.bookingConfirmationMessage}
            onChange={e => setDraft(prev => ({ ...prev, bookingConfirmationMessage: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Section 5: 3 Editable Studio Highlight Pillars */}
      <div className="bg-white rounded-2xl border border-slate-200/80 pk-card-pad space-y-3">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Pilares de Qualidade & Diferenciais</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalize os 3 pontos de destaque exibidos aos clientes no portal.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 pk-grid-gap text-xs">
          {draft.highlightCards.map((card, idx) => (
            <div key={idx} className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-[#9A3412] block tabular-nums">
                0{idx + 1}. Pilar de Destaque
              </span>
              <input
                type="text"
                value={card.title}
                onChange={e => {
                  const val = e.target.value;
                  setDraft(prev => ({
                    ...prev,
                    highlightCards: prev.highlightCards.map((c, i) => (i === idx ? { ...c, title: val } : c)),
                  }));
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:border-[#EA580C] focus:outline-hidden"
              />
              <textarea
                rows={3}
                value={card.description}
                onChange={e => {
                  const val = e.target.value;
                  setDraft(prev => ({
                    ...prev,
                    highlightCards: prev.highlightCards.map((c, i) => (i === idx ? { ...c, description: val } : c)),
                  }));
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-600 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Restaurar Padrões do Portal</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-rose-800">Confirmar restauração?</span>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="p-1 text-rose-700 hover:bg-rose-100 rounded-lg"
              aria-label="Cancelar restauração"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          type="submit"
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition whitespace-nowrap"
        >
          <Save className="w-4 h-4 shrink-0" />
          <span>Salvar Configurações do Portal</span>
        </button>
      </div>
    </form>
  );
};
