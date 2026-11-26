import React, { useRef, useState } from 'react';
import { companyDisplayName } from '../../utils/company';

import {
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User as UserIcon,
  FileCode2,
  Layers,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { brandIdentityEngine, useBrandIdentity } from '../../core/brandIdentityEngine';
import { validateAndPrepareBrandLogoFile } from '../../core/brandIdentityValidation';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { BrandLogo } from '../common/BrandLogo';
import { formatDateTimeBR } from '../../utils/dateUtils';
import type { BrandLogoFormat } from '../../types';

interface PendingLogoPreview {
  file: File;
  fileName: string;
  format: BrandLogoFormat;
  mimeType: string;
  sizeBytes: number;
  previewDataUrl: string;
  isReplacement: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const BrandIdentityPanel: React.FC = () => {
  const { currentUser, settings, logAudit } = useApp();
  const brandIdentity = useBrandIdentity();
  const isAdmin = currentUser.role === 'admin';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PendingLogoPreview | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const activeLogo = brandIdentity.activeLogo;

  const openFilePicker = () => {
    if (!isAdmin || submitting) return;
    setFeedback(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);

    if (!isAdmin) {
      setFeedback({
        type: 'error',
        text: 'Somente administradores autorizados podem anexar ou alterar a logomarca.',
      });
      return;
    }

    const prepared = await validateAndPrepareBrandLogoFile(file);
    if (!prepared.ok) {
      setFeedback({
        type: 'error',
        text: `${prepared.error} A identidade visual atual foi mantida sem alterações.`,
      });
      return;
    }

    // Both "ANEXAR LOGO" (direct confirm or preview) and "ALTERAR LOGO" show preview before confirming
    setPendingPreview({
      file,
      fileName: prepared.fileName,
      format: prepared.format,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
      previewDataUrl: prepared.previewDataUrl,
      isReplacement: Boolean(activeLogo),
    });
  };

  const handleConfirmUpload = async () => {
    if (!pendingPreview || !isAdmin) return;
    setSubmitting(true);
    setFeedback(null);

    const result = await brandIdentityEngine.uploadLogo(pendingPreview.file, currentUser);
    setSubmitting(false);

    if (!result.ok) {
      setFeedback({
        type: 'error',
        text: result.error.userMessage,
      });
      return;
    }

    const actionWord = pendingPreview.isReplacement ? 'alterada' : 'anexada';
    const nextLogo = result.value.activeLogo;
    setPendingPreview(null);
    setFeedback({
      type: 'success',
      text: `Logomarca ${actionWord} e sincronizada globalmente (v${result.value.version}).`,
    });

    logAudit(
      pendingPreview.isReplacement ? 'ALTERAR_LOGO' : 'ANEXAR_LOGO',
      'Identidade Visual',
      `Logo "${nextLogo?.fileName}" (${nextLogo?.format}, v${result.value.version}) sincronizada em todo o sistema.`
    );
  };

  const handleConfirmRemove = async () => {
    if (!isAdmin) return;
    setSubmitting(true);
    setFeedback(null);

    const result = await brandIdentityEngine.removeLogo(currentUser);
    setSubmitting(false);

    if (!result.ok) {
      setFeedback({
        type: 'error',
        text: result.error.userMessage,
      });
      setShowRemoveConfirm(false);
      return;
    }

    setShowRemoveConfirm(false);
    setFeedback({
      type: 'success',
      text: `Logomarca personalizada removida. Identidade visual padrão da PK Detail restaurada (v${result.value.version}).`,
    });

    logAudit(
      'REMOVER_LOGO',
      'Identidade Visual',
      `Logomarca personalizada removida. Identidade padrão restaurada (v${result.value.version}).`
    );
  };

  return (
    <section
      aria-labelledby="heading-identidade-visual"
      className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3.5 text-xs min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="heading-identidade-visual"
              className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase"
            >
              IDENTIDADE VISUAL DA EMPRESA
            </h2>
            <span className="text-[11px] font-mono font-bold text-[#9A3412] bg-[#FFEDD5] px-2 py-0.5 rounded-md tabular-nums">
              v{brandIdentity.version}
            </span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Anexe a logomarca oficial da PK Detail para atualização automática em login, menus, dashboard, portal do cliente e documentos PDF/impressão.
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold shrink-0">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Acesso somente Administrador</span>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-2xl border flex items-start justify-between gap-2 font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="wrap-anywhere leading-relaxed">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Hidden File Input (supports Phone gallery, iCloud/Drive, Tablet, Desktop) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
        onChange={handleFileSelected}
        className="sr-only"
        aria-label="Selecionar arquivo de logotipo"
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* Left 5 cols: Preview Card */}
        <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex flex-col justify-between gap-3 min-w-0">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Pré-visualização Ativa
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {activeLogo ? 'Logomarca Personalizada' : 'Identidade Padrão'}
              </span>
            </div>

            {/* Dual Surface Preview (Light PDF / Dark Studio) */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white border border-slate-200 p-3 flex flex-col items-center justify-center min-h-[104px] sm:min-h-[116px] gap-2">
                {activeLogo ? (
                  <img
                    src={activeLogo.assetUrl}
                    alt={`Prévia clara da logo ${activeLogo.fileName}`}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <BrandLogo
                    variant="login"
                    companyName={companyDisplayName(settings)}
                  />
                )}
                <span className="text-[10px] font-semibold text-slate-400">
                  Fundo Claro (PDFs / Menu)
                </span>
              </div>

              <div className="rounded-xl bg-[#141414] border border-neutral-800 p-3 flex flex-col items-center justify-center min-h-[104px] sm:min-h-[116px] gap-2">
                {activeLogo ? (
                  <img
                    src={activeLogo.assetUrl}
                    alt={`Prévia escura da logo ${activeLogo.fileName}`}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <BrandLogo
                    variant="login"
                    companyName={companyDisplayName(settings)}
                  />
                )}
                <span className="text-[10px] font-semibold text-neutral-400">
                  Fundo Escuro (Portal / Login)
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/80">
            {!activeLogo ? (
              <button
                type="button"
                disabled={!isAdmin || submitting}
                onClick={openFilePicker}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition whitespace-nowrap"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Upload className="w-4 h-4 shrink-0" />
                )}
                <span>ANEXAR LOGO</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!isAdmin || submitting}
                  onClick={openFilePicker}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-[#9A3412] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>ALTERAR LOGO</span>
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || submitting}
                  onClick={() => setShowRemoveConfirm(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 disabled:opacity-50 disabled:cursor-not-allowed font-extrabold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>REMOVER LOGO</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right 7 cols: Metadata, Formats & Audit */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 pk-grid-gap">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                Arquivo Atual
              </span>
              <p className="font-bold text-slate-900 truncate">
                {activeLogo ? activeLogo.fileName : 'Emblema Oficial Padrão (PK Detail)'}
              </p>
              <span className="text-[11px] text-slate-500 block font-mono tabular-nums">
                {activeLogo
                  ? `${activeLogo.format} · ${formatBytes(activeLogo.sizeBytes)}`
                  : 'SVG Vetorial Nativo'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Última Atualização
              </span>
              <p className="font-bold text-slate-900 tabular-nums">
                {activeLogo?.uploadedAt
                  ? formatDateTimeBR(activeLogo.uploadedAt)
                  : brandIdentity.updatedAt
                  ? formatDateTimeBR(brandIdentity.updatedAt)
                  : 'Padrão inicial do sistema'}
              </p>
              <span className="text-[11px] text-slate-500 block truncate">
                Armazenamento permanente no servidor
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                Responsável pela Alteração
              </span>
              <p className="font-bold text-slate-900 truncate">
                {activeLogo ? activeLogo.updatedBy : 'Sistema PK Detail'}
              </p>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                {activeLogo ? activeLogo.updatedByRole : 'padrão'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                Registro & Caminho
              </span>
              <p className="font-mono font-bold text-slate-900 text-[11px] truncate">
                {activeLogo ? activeLogo.id : 'pk_default_emblem'}
              </p>
              <span className="text-[10px] font-mono text-slate-500 block truncate">
                {activeLogo ? activeLogo.filePath : 'Identidade padrão embutida'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FFFBF7] border border-[#FED7AA] space-y-1.5">
            <span className="font-bold text-[#9A3412] flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 shrink-0" />
              Formatos Aceitos & Sincronização Automática
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Aceita imagens <strong>PNG</strong>, <strong>JPG/JPEG</strong>, <strong>WEBP</strong> e <strong>SVG</strong> (com sanitização automática contra scripts) até <strong>5 MB</strong>. Documentos já emitidos preservam sua logo original; novos PDFs e todas as telas passam a exibir imediatamente a versão atual.
            </p>
          </div>

          {brandIdentity.audit.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Histórico Recente de Identidade Visual
              </span>
              <div className="max-h-36 overflow-y-auto pk-scroll-compact space-y-1.5 pr-1">
                {brandIdentity.audit.slice(0, 5).map(evt => (
                  <div
                    key={evt.id}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-700 font-medium truncate">
                      <strong>{evt.userName}</strong>: {evt.details}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                      {formatDateTimeBR(evt.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview & Confirmation Modal before attaching or replacing */}
      <ResponsiveModal
        isOpen={Boolean(pendingPreview)}
        onClose={() => !submitting && setPendingPreview(null)}
        title={pendingPreview?.isReplacement ? 'Confirmar Alteração da Logomarca' : 'Confirmar Logomarca Oficial'}
        maxWidth="md"
      >
        {pendingPreview && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-3">
              <img
                src={pendingPreview.previewDataUrl}
                alt={`Prévia de ${pendingPreview.fileName}`}
                decoding="async"
                className="max-h-28 max-w-full object-contain rounded-lg bg-white p-2 border border-slate-200"
              />
              <div className="text-center space-y-0.5">
                <p className="font-bold text-slate-900 wrap-anywhere">{pendingPreview.fileName}</p>
                <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                  {pendingPreview.format} · {formatBytes(pendingPreview.sizeBytes)}
                </p>
              </div>
            </div>

            {pendingPreview.isReplacement && activeLogo && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
                A logomarca atual (<strong>{activeLogo.fileName}</strong>) será substituída em todas as telas, portal e novos PDFs após a confirmação. Documentos já emitidos preservam seu registro original.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setPendingPreview(null)}
                className="min-h-[42px] py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmUpload}
                className="min-h-[42px] py-2 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-extrabold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>
                    {pendingPreview.isReplacement ? 'Confirmar Substituição' : 'Salvar Logomarca'}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Confirm Remove Modal */}
      <ResponsiveModal
        isOpen={showRemoveConfirm}
        onClose={() => !submitting && setShowRemoveConfirm(false)}
        title="Remover Logomarca Personalizada"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Deseja remover a logomarca personalizada ativa? O sistema utilizará a identidade visual padrão da PK Detail até que uma nova logo seja anexada.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowRemoveConfirm(false)}
              className="min-h-[42px] py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmRemove}
              className="min-h-[42px] py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Confirmar Remoção</span>
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </section>
  );
};
