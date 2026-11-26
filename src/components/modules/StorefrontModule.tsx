import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StorefrontSettings } from '../../types';
import { companyDisplayName } from '../../utils/company';
import {
  Globe,
  Copy,
  Check,
  Palette,
  Image as ImageIcon,
  MessageCircle,
  MapPin,
  Clock,
  Sparkles,
  Pencil,
  Plus,
  AlertTriangle,
  Monitor,
  Smartphone,
  Lock,
  Info
} from 'lucide-react';

type StorefrontTab = 'geral' | 'aparencia' | 'contato' | 'horarios' | 'servicos' | 'empresa';

const TABS: { id: StorefrontTab; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'contato', label: 'Contato' },
  { id: 'horarios', label: 'Horários' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'empresa', label: 'Empresa' },
];

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const ACCENT_PRESETS = ['#FCE020', '#FACC15', '#111827', '#2563EB', '#10B981', '#8B5CF6', '#EF4444'];

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'minha-estetica';

const initialsOf = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'PK';

const buildDefaultHours = (): StorefrontSettings['hours'] =>
  WEEKDAYS.map(day => ({
    day,
    open: day !== 'Domingo' && day !== 'Sábado',
    start: '08:00',
    end: '18:00',
  }));

export const StorefrontModule: React.FC = () => {
  const {
    portalConfig,
    updatePortalConfig,
    services,
    toggleServiceActive,
    settings,
    updateSettings,
    setActiveModule,
  } = useApp();

  const [tab, setTab] = useState<StorefrontTab>('geral');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const [enabled, setEnabled] = useState(portalConfig.portalEnabled);
  const [showPrices, setShowPrices] = useState(portalConfig.showPrices);
  const [showAddress, setShowAddress] = useState(portalConfig.showLocationAndHours);
  const [showWhatsapp, setShowWhatsapp] = useState(portalConfig.showWhatsappButton);
  const [coverUrl, setCoverUrl] = useState(portalConfig.heroImageUrl || '');

  const [companyName, setCompanyName] = useState(companyDisplayName(settings));
  const [companyCity, setCompanyCity] = useState(settings.city || '');
  const [companyAddress, setCompanyAddress] = useState(settings.address || '');
  const [companyPostalCode, setCompanyPostalCode] = useState(settings.postalCode || '');

  const [store, setStore] = useState<StorefrontSettings>(() => ({
    slug: portalConfig.storefront?.slug || slugify(companyDisplayName(settings)),
    accentColor: portalConfig.storefront?.accentColor || '#FCE020',
    description: portalConfig.storefront?.description || '',
    googleMapsUrl: portalConfig.storefront?.googleMapsUrl || '',
    publishedServiceIds:
      portalConfig.storefront?.publishedServiceIds || services.filter(s => s.active).map(s => s.id),
    state: portalConfig.storefront?.state || '',
    hours: portalConfig.storefront?.hours?.length ? portalConfig.storefront.hours : buildDefaultHours(),
  }));

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      enabled: portalConfig.portalEnabled,
      showPrices: portalConfig.showPrices,
      showAddress: portalConfig.showLocationAndHours,
      showWhatsapp: portalConfig.showWhatsappButton,
      coverUrl: portalConfig.heroImageUrl || '',
      companyName: companyDisplayName(settings),
      companyCity: settings.city || '',
      companyAddress: settings.address || '',
      companyPostalCode: settings.postalCode || '',
      store: {
        slug: portalConfig.storefront?.slug || slugify(companyDisplayName(settings)),
        accentColor: portalConfig.storefront?.accentColor || '#FCE020',
        description: portalConfig.storefront?.description || '',
        googleMapsUrl: portalConfig.storefront?.googleMapsUrl || '',
        publishedServiceIds:
          portalConfig.storefront?.publishedServiceIds || services.filter(s => s.active).map(s => s.id),
        state: portalConfig.storefront?.state || '',
        hours: portalConfig.storefront?.hours?.length ? portalConfig.storefront.hours : buildDefaultHours(),
      },
    })
  );

  const currentSnapshot = JSON.stringify({
    enabled,
    showPrices,
    showAddress,
    showWhatsapp,
    coverUrl,
    companyName,
    companyCity,
    companyAddress,
    companyPostalCode,
    store,
  });
  const isDirty = currentSnapshot !== savedSnapshot;

  const publishedServices = useMemo(() => services.filter(s => s.active), [services]);

  const isOpenNow = useMemo(() => {
    const today = WEEKDAYS[new Date().getDay()];
    const entry = store.hours.find(h => h.day === today);
    return Boolean(entry?.open);
  }, [store.hours]);

  const origin = typeof window !== 'undefined' ? window.location.host : 'meuorbita.com.br';
  const publicUrl = `${origin}/${store.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard bloqueado
    }
  };

  const handleSave = () => {
    updatePortalConfig({
      ...portalConfig,
      portalEnabled: enabled,
      showPrices,
      showLocationAndHours: showAddress,
      showWhatsappButton: showWhatsapp,
      heroImageUrl: coverUrl,
      storefront: {
        ...store,
        publishedServiceIds: services.filter(s => s.active).map(s => s.id),
      },
    });

    if (
      companyName !== companyDisplayName(settings) ||
      companyCity !== settings.city ||
      companyAddress !== settings.address ||
      companyPostalCode !== settings.postalCode
    ) {
      updateSettings({
        ...settings,
        fantasyName: companyName,
        city: companyCity,
        address: companyAddress,
        postalCode: companyPostalCode,
      });
    }

    setSavedSnapshot(currentSnapshot);
  };

  const handleCoverUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
        setCoverError(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const accent = store.accentColor || '#FCE020';

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Vitrine Online</h1>
            <p className="text-xs text-slate-500 mt-1.5">Configure sua página pública de agendamento online.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 min-w-0 items-start">
        {/* ---------------- CONFIG COLUMN ---------------- */}
        <div className="min-w-0 space-y-3.5">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-white rounded-xl border border-slate-200/80 p-1.5">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`min-h-[32px] px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  tab === item.id
                    ? 'bg-[#EA580C] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* GERAL */}
          {tab === 'geral' && (
            <>
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Status da Vitrine</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {enabled ? 'Vitrine publicada' : 'Vitrine desativada'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">Quando ativa, sua página pública fica disponível para os clientes.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Ativar vitrine"
                  onClick={() => setEnabled(prev => !prev)}
                  className={`shrink-0 mt-1 w-11 h-6 rounded-full transition relative ${enabled ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </section>

              <section className="bg-white rounded-2xl border-2 border-[#EA580C] shadow-xs p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#9A3412] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">Link da Vitrine</p>
                    <p className="text-[11px] text-slate-500">Endereço do seu agendamento online</p>
                  </div>
                </div>

                <div className="flex items-stretch min-h-[42px] bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#EA580C]">
                  <span className="px-3 flex items-center text-[11px] text-slate-500 bg-slate-50 border-r border-slate-200 whitespace-nowrap">
                    {origin}/
                  </span>
                  <input
                    type="text"
                    value={store.slug}
                    onChange={e => setStore(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                    className="flex-1 min-w-0 bg-transparent px-3 text-xs font-semibold text-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    aria-label="Copiar link"
                    className="px-3 text-slate-500 hover:text-slate-800 border-l border-slate-200 flex items-center"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[10px] text-slate-400">Letras minúsculas, números e hífens. De 3 a 40 caracteres.</p>
              </section>
            </>
          )}

          {/* APARÊNCIA */}
          {tab === 'aparencia' && (
            <>
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Palette className="w-4 h-4 text-[#EA580C]" />
                  Aparência
                </p>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-semibold text-slate-800">Logo da empresa</p>
                      <p className="text-[10.5px] text-slate-500">Sem logo, aparecem as iniciais da empresa.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule('empresa')}
                    className="shrink-0 min-h-[32px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition"
                  >
                    Alterar
                  </button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11.5px] font-semibold text-slate-800">Imagem de capa</p>
                  <p className="text-[10.5px] text-slate-500">
                    1920 × 640 px (proporção 3:1). JPG, PNG ou WebP até 5 MB. No celular, a imagem é adaptada
                    automaticamente para o formato da tela.
                  </p>

                  {coverUrl && !coverError ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={coverUrl}
                        alt="Capa da vitrine"
                        onError={() => setCoverError(true)}
                        className="w-full h-28 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setCoverUrl('')}
                        className="absolute top-1.5 right-1.5 min-h-[26px] px-2 rounded-md bg-black/60 hover:bg-rose-600 text-white text-[10px] font-bold transition"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 min-h-[110px] flex items-center justify-center">
                      <p className="text-[11px] text-slate-400">Nenhuma imagem de capa</p>
                    </div>
                  )}

                  <label className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold cursor-pointer transition">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Enviar imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        handleCoverUpload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[11.5px] font-semibold text-slate-800">Cor principal</p>
                  <p className="text-[10.5px] text-slate-500">Usada nos destaques da Vitrine. Não altera a cor dos seus PDFs.</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label
                      className="w-9 h-9 rounded-lg border border-slate-200 overflow-hidden cursor-pointer shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      <input
                        type="color"
                        value={accent}
                        onChange={e => setStore(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="sr-only"
                        aria-label="Cor principal"
                      />
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-slate-600 uppercase">{accent}</span>
                    <div className="flex items-center gap-1.5 ml-1">
                      {ACCENT_PRESETS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setStore(prev => ({ ...prev, accentColor: color }))}
                          aria-label={`Usar cor ${color}`}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            accent.toLowerCase() === color.toLowerCase() ? 'border-slate-900' : 'border-white'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* CONTATO */}
          {tab === 'contato' && (
            <>
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MessageCircle className="w-4 h-4 text-[#EA580C]" />
                  Contato e localização
                </p>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-semibold text-slate-800">WhatsApp</p>
                      <p className="text-[10.5px] text-slate-500">{settings.whatsapp || settings.phone || 'Não informado'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule('empresa')}
                    className="shrink-0 min-h-[32px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition"
                  >
                    Alterar
                  </button>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-800 mb-1">Link do Google (Maps ou avaliações)</label>
                  <input
                    type="url"
                    value={store.googleMapsUrl}
                    onChange={e => setStore(prev => ({ ...prev, googleMapsUrl: e.target.value }))}
                    placeholder="https://maps.google.com/..."
                    className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Opcional. Deve começar com https://</p>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="w-4 h-4 text-[#EA580C]" />
                  Descrição
                </p>
                <p className="text-[11px] text-slate-500">Conte para seus clientes um pouco sobre a sua empresa</p>
                <div className="relative">
                  <textarea
                    value={store.description}
                    onChange={e => setStore(prev => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                    rows={4}
                    maxLength={500}
                    placeholder="Ex.: Estética automotiva especializada em polimento e higienização..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pb-5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden resize-y"
                  />
                  <span className="absolute bottom-1.5 right-2.5 text-[10px] text-slate-400 tabular-nums">
                    {store.description.length}/500
                  </span>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-[#EA580C]" />
                  Preferências
                </p>

                {[
                  { label: 'Exibir preços', hint: 'Mostra os valores dos serviços publicados na Vitrine.', value: showPrices, set: setShowPrices },
                  { label: 'Exibir endereço', hint: 'Mostra o endereço cadastrado em Minha Empresa na Vitrine.', value: showAddress, set: setShowAddress },
                  { label: 'Exibir botão do WhatsApp', hint: 'Mostra o botão "Falar no WhatsApp" na sua página pública.', value: showWhatsapp, set: setShowWhatsapp },
                ].map(item => (
                  <div key={item.label} className="flex items-start justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[10.5px] text-slate-500 leading-snug">{item.hint}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      aria-label={item.label}
                      onClick={() => item.set(prev => !prev)}
                      className={`shrink-0 mt-0.5 w-10 h-[22px] rounded-full transition relative ${item.value ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${item.value ? 'left-[20px]' : 'left-0.5'}`}
                      />
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}

          {/* HORÁRIOS */}
          {tab === 'horarios' && (
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Clock className="w-4 h-4 text-[#EA580C]" />
                Horários de funcionamento
              </p>
              <p className="text-[11px] text-slate-500">Use intervalos para representar o horário de almoço ou outras pausas.</p>

              {store.hours.map((entry, index) => (
                <div key={entry.day} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11.5px] font-bold text-slate-800">{entry.day}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {entry.open ? 'Aberto' : 'Fechado'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={entry.open}
                        aria-label={`Abrir ${entry.day}`}
                        onClick={() =>
                          setStore(prev => ({
                            ...prev,
                            hours: prev.hours.map((h, i) => (i === index ? { ...h, open: !h.open } : h)),
                          }))
                        }
                        className={`w-10 h-[22px] rounded-full transition relative ${entry.open ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${entry.open ? 'left-[20px]' : 'left-0.5'}`}
                        />
                      </button>
                    </div>
                  </div>

                  {entry.open && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="time"
                        value={entry.start}
                        aria-label={`Abertura ${entry.day}`}
                        onChange={e =>
                          setStore(prev => ({
                            ...prev,
                            hours: prev.hours.map((h, i) => (i === index ? { ...h, start: e.target.value } : h)),
                          }))
                        }
                        className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                      />
                      <span className="text-[11px] text-slate-500">até</span>
                      <input
                        type="time"
                        value={entry.end}
                        aria-label={`Fechamento ${entry.day}`}
                        onChange={e =>
                          setStore(prev => ({
                            ...prev,
                            hours: prev.hours.map((h, i) => (i === index ? { ...h, end: e.target.value } : h)),
                          }))
                        }
                        className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* SERVIÇOS */}
          {tab === 'servicos' && (
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Sparkles className="w-4 h-4 text-[#EA580C]" />
                    Serviços da Vitrine
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Use a chave para exibir ou ocultar o serviço na Vitrine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('servicos')}
                  className="shrink-0 min-h-[34px] px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center gap-1 transition whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar serviço</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {services.map(service => (
                  <div
                    key={service.id}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 min-w-0"
                  >
                    <span className="text-slate-300 shrink-0" aria-hidden="true">
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2" cy="3" r="1.4" />
                        <circle cx="8" cy="3" r="1.4" />
                        <circle cx="2" cy="8" r="1.4" />
                        <circle cx="8" cy="8" r="1.4" />
                        <circle cx="2" cy="13" r="1.4" />
                        <circle cx="8" cy="13" r="1.4" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-slate-800 truncate">{service.name}</p>
                      <p className="text-[10.5px] text-slate-500 font-mono">{brl(service.price)}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={service.active}
                      aria-label={`Publicar ${service.name}`}
                      onClick={() => toggleServiceActive(service.id)}
                      className={`shrink-0 w-9 h-[20px] rounded-full transition relative ${service.active ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${service.active ? 'left-[18px]' : 'left-0.5'}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('servicos')}
                      aria-label={`Editar ${service.name}`}
                      className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-4">Nenhum serviço cadastrado ainda.</p>
                )}
              </div>
            </section>
          )}

          {/* EMPRESA */}
          {tab === 'empresa' && (
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Info className="w-4 h-4 text-[#EA580C]" />
                  Dados da empresa
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">As alterações feitas aqui também serão atualizadas em Minha Empresa.</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome da empresa</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Não informado"
                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">O nome é alterado em Minha Empresa.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={companyCity}
                    onChange={e => setCompanyCity(e.target.value)}
                    placeholder="Cidade"
                    className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Estado</label>
                  <input
                    type="text"
                    value={store.state}
                    onChange={e => setStore(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="UF"
                    maxLength={2}
                    className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium uppercase text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Endereço</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
                  placeholder="Rua, número, bairro"
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <div className="max-w-[220px]">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">CEP</label>
                <input
                  type="text"
                  value={companyPostalCode}
                  onChange={e => setCompanyPostalCode(e.target.value)}
                  placeholder="00000-000"
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              {!companyName.trim() && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Faltam informações importantes: nome da empresa. Complete o cadastro para uma Vitrine mais
                    completa.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Save bar */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              {isDirty ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Alterações não salvas
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-400" />
                  Todas as alterações salvas
                </>
              )}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className="min-h-[40px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold transition"
            >
              Salvar alterações
            </button>
          </div>
        </div>

        {/* ---------------- PREVIEW COLUMN ---------------- */}
        <div className="min-w-0 xl:sticky xl:top-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Prévia</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                  device === 'desktop'
                    ? 'border-[#EA580C] bg-[#EA580C] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Computador</span>
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                  device === 'mobile'
                    ? 'border-[#EA580C] bg-[#EA580C] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Celular</span>
              </button>
            </div>
          </div>

          <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
            <span aria-hidden="true">↳</span>
            Deslize a tela do computador ou celular para baixo e veja a prévia da sua Vitrine Online.
          </p>

          <div className="flex justify-center">
            <div className={`w-full transition-all ${device === 'mobile' ? 'max-w-[268px]' : 'max-w-[520px]'}`}>
              <div className="rounded-2xl bg-[#1F1F1F] p-2 shadow-xl">
                {/* browser chrome */}
                <div className="flex items-center gap-1.5 px-1 pb-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                  <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2 h-2 rounded-full bg-[#28C840]" />
                  <div className="flex-1 min-w-0 ml-1.5 h-5 rounded-md bg-white/90 flex items-center px-2">
                    <p className="text-[8.5px] text-slate-500 truncate">https://{publicUrl}</p>
                  </div>
                </div>

                {/* page */}
                <div className="bg-white rounded-lg overflow-hidden max-h-[560px] overflow-y-auto no-scrollbar">
                  <div className="relative" style={{ backgroundColor: accent }}>
                    <div className="h-16 w-full" />
                    {coverUrl && !coverError && (
                      <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                    )}
                    <div className="absolute left-3.5 -bottom-5 w-11 h-11 rounded-xl bg-[#EA580C] border-2 border-white shadow-sm flex items-center justify-center text-[11px] font-black text-white">
                      {initialsOf(companyName || companyDisplayName(settings))}
                    </div>
                  </div>

                  <div className="px-3.5 pt-6 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">
                          {companyName || 'Sua empresa'}
                        </p>
                        <p className="text-[8.5px] text-slate-500 flex items-center gap-1 flex-wrap">
                          <span className={`w-1 h-1 rounded-full ${isOpenNow ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isOpenNow ? 'Aberto agora' : 'Fechado agora'}
                          <span className="text-slate-300">·</span>
                          <span className="underline decoration-dotted">Ver horários</span>
                        </p>
                      </div>

                      {showWhatsapp && (
                        <span className="shrink-0 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-1 flex items-center gap-1">
                          <MessageCircle className="w-2.5 h-2.5" />
                          Falar no WhatsApp
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="min-w-0">
                        <p className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Localização</p>
                        <p className="text-[8.5px] text-slate-600 truncate flex items-center gap-1">
                          {showAddress && <MapPin className="w-2.5 h-2.5 shrink-0" />}
                          {showAddress
                            ? [companyAddress, companyCity].filter(Boolean).join(', ') || 'Não informado'
                            : 'Oculto na vitrine'}
                        </p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Contato</p>
                        <p className="text-[8.5px] text-slate-600 truncate">{settings.phone || 'Não informado'}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Escolha os serviços
                      </p>

                      {publishedServices.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-center">
                          <p className="text-[8.5px] text-slate-400">Nenhum serviço publicado ainda.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {publishedServices.slice(0, 6).map(service => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5"
                            >
                              <div className="min-w-0">
                                <p className="text-[8.5px] font-semibold text-slate-800 truncate">{service.name}</p>
                                {service.description && (
                                  <p className="text-[7.5px] text-slate-400 truncate">{service.description}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-[8px] font-mono font-bold text-slate-700">
                                {showPrices ? brl(service.price) : 'Sob consulta'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {store.description && (
                      <p className="text-[8px] text-slate-500 leading-snug line-clamp-3">{store.description}</p>
                    )}

                    {!enabled && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                        <p className="text-[7.5px] font-semibold text-rose-700">Vitrine desativada — não está pública</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {device === 'desktop' && (
                <div className="mx-auto w-24 h-2.5 bg-[#111111] rounded-b-lg" aria-hidden="true" />
              )}
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            Prévia apenas visual. As alterações só valem depois de salvar.
          </p>
        </div>
      </div>
    </div>
  );
};
