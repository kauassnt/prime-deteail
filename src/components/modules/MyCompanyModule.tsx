import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Check,
  Info,
  Lock,
  Mail,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CompanySettings } from '../../types';
import { brandIdentityEngine, useBrandIdentity } from '../../core/brandIdentityEngine';
import { validateAndPrepareBrandLogoFile } from '../../core/brandIdentityValidation';
import { DEFAULT_DOCUMENT_COLOR, resolveDocumentColor } from '../../utils/documentTheme';
import { LogoSourceSheet, LogoCropModal } from '../common/CompanyLogoModals';

type Tab = 'dados' | 'aparencia' | 'preferencias' | 'seguranca';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados da Empresa' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'preferencias', label: 'Preferências' },
  { id: 'seguranca', label: 'Segurança' },
];

const DOCUMENT_COLORS = ['#FACC15', '#2563EB', '#22C55E', '#7C3AED', '#EF4444', '#EA580C', '#111827'];

const SAMPLE_SERVICES = [
  { name: 'Vitrificação', description: 'Aplicação de vitrificador cerâmico com durabilidade de 12 meses.', price: 'R$ 1.000,00' },
  { name: 'Higienização', description: 'Higienização completa de bancos, tapetes e painel.', price: 'R$ 500,00' },
];

export const MyCompanyModule: React.FC = () => {
  const { settings, updateSettings, currentUser, logAudit } = useApp();
  const brand = useBrandIdentity();

  const [tab, setTab] = useState<Tab>('dados');
  const [form, setForm] = useState<CompanySettings>(settings);
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [logoFeedback, setLogoFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [logoSheetOpen, setLogoSheetOpen] = useState(false);
  const [cropImage, setCropImage] = useState<{ url: string; fileName: string } | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordRequested, setPasswordRequested] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!savedTab) return;
    const timer = window.setTimeout(() => setSavedTab(null), 2200);
    return () => window.clearTimeout(timer);
  }, [savedTab]);

  const setField = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSavedTab(null);
  };

  const saveDados = () => {
    // Um único estado de empresa: os campos já são as chaves do settings (fantasyName = nome exibido).
    updateSettings(form);
    logAudit('ATUALIZAR_EMPRESA', 'Minha Empresa', 'Dados cadastrais da empresa atualizados.');
    setSavedTab('dados');
  };

  const saveAparencia = () => {
    updateSettings(form);
    logAudit('ATUALIZAR_APARENCIA', 'Minha Empresa', `Cor dos documentos alterada para ${form.documentColor || DEFAULT_DOCUMENT_COLOR}.`);
    setSavedTab('aparencia');
  };

  const savePreferencias = (next: boolean) => {
    const updated = { ...form, showServiceDescriptions: next };
    setForm(updated);
    updateSettings(updated);
    logAudit(
      'ATUALIZAR_PREFERENCIAS',
      'Minha Empresa',
      `${next ? 'Ativou' : 'Desativou'} a exibição das descrições de serviços nos PDFs.`
    );
    setSavedTab('preferencias');
  };

  const handleLogoPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setLogoFeedback(null);

    if (currentUser.role !== 'admin') {
      setLogoFeedback({ type: 'error', text: 'Somente administradores podem alterar a logo da empresa.' });
      return;
    }

    const prepared = await validateAndPrepareBrandLogoFile(file);
    if (!prepared.ok) {
      setLogoFeedback({ type: 'error', text: prepared.error });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setLogoSheetOpen(false);
      setCropImage({ url: reader.result, fileName: prepared.fileName });
    };
    reader.onerror = () => {
      setLogoFeedback({ type: 'error', text: 'Não foi possível ler a imagem selecionada.' });
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (croppedFile: File) => {
    setUploadingLogo(true);
    const result = await brandIdentityEngine.uploadLogo(croppedFile, currentUser);
    setUploadingLogo(false);

    if (!result.ok) {
      setLogoFeedback({ type: 'error', text: result.error.userMessage });
      return;
    }

    setCropImage(null);
    setLogoFeedback({ type: 'success', text: 'Logo atualizada e sincronizada em todo o sistema.' });
    logAudit('ALTERAR_LOGO', 'Minha Empresa', `Logomarca "${croppedFile.name}" atualizada.`);  };

  const handleRemoveLogo = async () => {
    setLogoSheetOpen(false);
    setLogoFeedback(null);
    setRemovingLogo(true);
    const result = await brandIdentityEngine.removeLogo(currentUser);
    setRemovingLogo(false);

    if (!result.ok) {
      setLogoFeedback({ type: 'error', text: result.error.userMessage });
      return;
    }

    setLogoFeedback({ type: 'success', text: 'Logo removida. O sistema voltou à identidade padrão.' });
    logAudit('REMOVER_LOGO', 'Minha Empresa', 'Logomarca removida da identidade da empresa.');
  };

  const requestPasswordChange = () => {
    setPasswordRequested(true);
    setPasswordModalOpen(false);
    logAudit('SOLICITAR_ALTERACAO_SENHA', 'Segurança', `Solicitação de alteração de senha para ${currentUser.email}.`);  };

  const documentColor = resolveDocumentColor(form.documentColor || DEFAULT_DOCUMENT_COLOR);
  const showDescriptions = form.showServiceDescriptions === true;
  const logoUrl = brand.activeLogo?.assetUrl || null;

  const inputClass =
    'w-full min-h-[38px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden';
  const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="flex flex-col gap-4 min-w-0 max-w-[1080px]">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Minha Empresa</h1>
        <p className="text-xs text-slate-500 mt-1.5">Gerencie os dados, a identidade e os documentos da sua empresa.</p>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start max-w-full overflow-x-auto no-scrollbar">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[30px] px-3 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
              tab === item.id
                ? 'bg-white border border-[#EA580C] text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ================= DADOS ================= */}
      {tab === 'dados' && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Identidade</h2>

            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="relative">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo da empresa"
                    className="w-[92px] h-[92px] rounded-full object-cover bg-white border border-slate-200"
                  />
                ) : (
                  <span className="w-[92px] h-[92px] rounded-full border-2 border-[#EA580C] bg-white flex items-center justify-center text-slate-400">
                    <Camera className="w-7 h-7" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setLogoSheetOpen(true)}
                  disabled={uploadingLogo || removingLogo}
                  aria-label="Alterar logo da empresa"
                  className="absolute -right-0.5 -bottom-0.5 w-7 h-7 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white border-2 border-white flex items-center justify-center shadow-sm transition disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs font-bold text-slate-800 mt-1">Logo da empresa</p>
              <p className="text-[10.5px] text-slate-500 max-w-[320px] leading-snug">
                Essa logo será exibida nos documentos da sua empresa. PNG ou JPG, de preferência quadrada.
              </p>

              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setLogoSheetOpen(true)}
                  disabled={uploadingLogo || removingLogo}
                  className="min-h-[32px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition disabled:opacity-60"
                >
                  {uploadingLogo ? 'Enviando…' : 'Alterar logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveLogo()}
                    disabled={uploadingLogo || removingLogo}
                    className="min-h-[32px] px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition disabled:opacity-60"
                  >
                    {removingLogo ? 'Removendo…' : 'Remover'}
                  </button>
                )}
              </div>

              {logoFeedback && (
                <p
                  className={`text-[10.5px] font-semibold max-w-[320px] ${
                    logoFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {logoFeedback.text}
                </p>
              )}
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleLogoPicked}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoPicked}
              className="hidden"
            />

            <div>
              <label className={labelClass} htmlFor="company-name">
                Nome da empresa <span className="text-rose-500">*</span>
              </label>
              <input
                id="company-name"
                type="text"
                value={form.fantasyName}
                onChange={e => setField('fantasyName', e.target.value)}
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                É assim que a empresa aparece no sistema, nos documentos e no Portal do Cliente.
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Contato</h2>
              <div>
                <label className={labelClass} htmlFor="company-phone">Telefone</label>
                <input
                  id="company-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="(75) 98888-8888"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="company-whatsapp">WhatsApp</label>
                <input
                  id="company-whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => setField('whatsapp', e.target.value)}
                  placeholder="5575988888888"
                  className={inputClass}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Usado nos botões de WhatsApp do sistema, portal e mensagens.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="company-email">E-mail</label>
                <input
                  id="company-email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  className={inputClass}
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Dados fiscais <span className="text-[10px] font-medium text-slate-400">(opcional)</span>
              </h2>
              <div>
                <label className={labelClass} htmlFor="company-legal-name">Razão social</label>
                <input
                  id="company-legal-name"
                  type="text"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="company-cnpj">CNPJ</label>
                <input
                  id="company-cnpj"
                  type="text"
                  value={form.cnpj}
                  onChange={e => setField('cnpj', e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Aparece no cabeçalho dos documentos, exatamente como digitado.
                </p>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Endereço <span className="text-[10px] font-medium text-slate-400">(opcional)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div>
                <label className={labelClass} htmlFor="company-cep">CEP</label>
                <input
                  id="company-cep"
                  type="text"
                  value={form.postalCode}
                  onChange={e => setField('postalCode', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="company-address">Endereço</label>
                <input
                  id="company-address"
                  type="text"
                  value={form.address}
                  onChange={e => setField('address', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="company-city">Cidade</label>
                <input
                  id="company-city"
                  type="text"
                  value={form.city}
                  onChange={e => setField('city', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[160px] gap-3">
              <div>
                <label className={labelClass} htmlFor="company-state">Estado</label>
                <input
                  id="company-state"
                  type="text"
                  value={form.state || ''}
                  onChange={e => setField('state', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            {savedTab === 'dados' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <Check className="w-3.5 h-3.5" /> Dados salvos
              </span>
            )}
            <button
              type="button"
              onClick={saveDados}
              className="min-h-[38px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
            >
              Salvar dados da empresa
            </button>
          </div>
        </>
      )}

      {/* ================= APARÊNCIA / PREFERÊNCIAS ================= */}
      {(tab === 'aparencia' || tab === 'preferencias') && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
          {tab === 'aparencia' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900">Cor dos documentos</h2>
              <p className="text-[11px] text-slate-500 leading-snug">
                Personalize a cor usada nos PDFs da sua empresa. Isso não altera as cores do sistema.
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {DOCUMENT_COLORS.map(color => {
                  const selected = documentColor.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setField('documentColor', color)}
                      aria-label={`Cor ${color}`}
                      aria-pressed={selected}
                      className={`w-11 h-11 rounded-lg flex items-center justify-center transition ${
                        selected ? 'ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}

                <input
                  ref={colorInputRef}
                  type="color"
                  value={documentColor}
                  onChange={e => setField('documentColor', e.target.value)}
                  className="sr-only"
                  aria-label="Cor personalizada"
                />
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  aria-label="Escolher cor personalizada"
                  className="w-11 h-11 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center transition"
                >
                  <PenLine className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[10.5px] text-slate-500">
                Cor selecionada: <span className="font-semibold text-slate-700">{documentColor}</span>
              </p>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setField('documentColor', DEFAULT_DOCUMENT_COLOR)}
                  className="min-h-[32px] px-2.5 rounded-lg text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar padrão</span>
                </button>
                <div className="flex items-center gap-2">
                  {savedTab === 'aparencia' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <Check className="w-3.5 h-3.5" /> Salvo
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={saveAparencia}
                    className="min-h-[36px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
                  >
                    Salvar aparência
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug pt-1 border-t border-slate-100">
                A cor é aplicada de verdade nos PDFs de Ordem de Serviço (o comprovante/recibo emitido pela
                própria OS usa o mesmo cabeçalho e também recebe a cor) e de Orçamento. Agendamentos e
                Relatórios não geram PDF neste sistema — não existe documento deles para colorir.
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Documentos</h2>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Exibir descrição dos serviços nos PDFs</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Exibe abaixo de cada serviço a descrição cadastrada nos PDFs de OS e de Orçamentos.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showDescriptions}
                  aria-label="Exibir descrição dos serviços nos PDFs"
                  onClick={() => savePreferencias(!showDescriptions)}
                  className={`shrink-0 mt-1 w-11 h-6 rounded-full transition relative ${
                    showDescriptions ? 'bg-[#EA580C]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      showDescriptions ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              {savedTab === 'preferencias' && (
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> Preferência salva
                </p>
              )}
            </section>
          )}

          {/* Document preview */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-600">Prévia do documento</p>
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-white px-4 py-4 text-[7px] text-slate-700 leading-snug">
              <div className="flex items-start gap-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-contain" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-slate-100" />
                )}
                <div className="pt-0.5">
                  <p className="text-[9px] font-bold text-slate-900">{form.name || 'Sua empresa'}</p>
                  <p className="text-[6px] text-slate-500">{form.cnpj ? `CNPJ: ${form.cnpj}` : 'CNPJ: —'}</p>
                </div>
              </div>
              <div className="h-[3px] mt-2 rounded-sm" style={{ backgroundColor: documentColor }} />
              <p className="text-center text-[9px] font-bold text-slate-900 tracking-wide mt-3">ORDEM DE SERVIÇO</p>
              <p className="text-center text-[6px] text-slate-500">#00125</p>

              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <p className="text-[5.5px] uppercase tracking-wide text-slate-400 font-bold">Cliente</p>
                  <p className="text-[6.5px] font-semibold text-slate-800">João da Silva</p>
                </div>
                <div>
                  <p className="text-[5.5px] uppercase tracking-wide text-slate-400 font-bold">Veículo</p>
                  <p className="text-[6.5px] font-semibold text-slate-800">Honda Civic</p>
                </div>
              </div>

              <div className="mt-2 rounded-sm overflow-hidden border border-slate-200">
                <div
                  className="flex items-center justify-between px-2 py-1 text-[5.5px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: documentColor }}
                >
                  <span>Serviços</span>
                  <span>Valor</span>
                </div>
                {SAMPLE_SERVICES.map(service => (
                  <div key={service.name} className="flex items-start justify-between gap-2 px-2 py-1 border-t border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[6.5px] font-semibold text-slate-800">{service.name}</p>
                      {showDescriptions && (
                        <p className="text-[5.5px] text-slate-500 leading-tight">{service.description}</p>
                      )}
                    </div>
                    <span className="text-[6.5px] text-slate-700 shrink-0">{service.price}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 py-1 border-t border-slate-200 bg-slate-100">
                  <span className="text-[5.5px] font-bold uppercase tracking-wide text-slate-700">Valor total</span>
                  <span className="text-[6.5px] font-bold text-slate-900">R$ 1.500,00</span>
                </div>
              </div>

              <p className="text-[5.5px] uppercase tracking-wide text-slate-400 font-bold mt-2.5">Observações</p>
              <div className="mt-3 h-[1px] bg-slate-200" />
              <div className="mt-6 flex flex-col items-center">
                <div className="w-24 h-[1px] bg-slate-300" />
                <p className="text-[5.5px] text-slate-500 mt-1">Assinatura do cliente</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">Exemplo ilustrativo com dados fictícios.</p>
          </section>
        </div>
      )}

      {/* ================= SEGURANÇA ================= */}
      {tab === 'seguranca' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 max-w-[520px] space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            Segurança
          </h2>
          <p className="text-xs font-semibold text-slate-800 pt-1">Senha de acesso</p>
          <p className="text-[11px] text-slate-500 leading-snug">
            Para manter sua conta segura, você pode solicitar um link para alterar sua senha de acesso ao PK Detail.
          </p>
          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            className="mt-1 min-h-[34px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center gap-1.5 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Alterar minha senha</span>
          </button>
          {passwordRequested && (
            <p className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-1 pt-1">
              <Info className="w-3.5 h-3.5" />
              Solicitação registrada para {currentUser.email}.
            </p>
          )}
        </section>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Alterar minha senha"
            className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-black text-slate-900">Alterar senha de acesso</h2>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enviaremos uma solicitação de alteração de senha para a conta de acesso vinculada a este e-mail:
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 truncate">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="min-h-[36px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={requestPasswordChange}
                className="min-h-[36px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
              >
                Solicitar alteração
              </button>
            </div>
          </div>
        </div>
      )}

      <LogoSourceSheet
        isOpen={logoSheetOpen}
        canRemoveLogo={!!logoUrl}
        onClose={() => setLogoSheetOpen(false)}
        onTakePhoto={() => {
          setLogoSheetOpen(false);
          cameraInputRef.current?.click();
        }}
        onPickGallery={() => {
          setLogoSheetOpen(false);
          galleryInputRef.current?.click();
        }}
        onRemove={() => {
          setLogoSheetOpen(false);
          void handleRemoveLogo();
        }}
      />

      <LogoCropModal
        isOpen={!!cropImage}
        imageUrl={cropImage?.url ?? null}
        fileName={cropImage?.fileName}
        busy={uploadingLogo}
        onCancel={() => setCropImage(null)}
        onConfirm={file => void handleCropConfirm(file)}
      />
    </div>
  );
};
