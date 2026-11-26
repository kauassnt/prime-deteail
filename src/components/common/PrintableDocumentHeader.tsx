import React from 'react';
import { companyDisplayName } from '../../utils/company';

import { BrandLogo } from './BrandLogo';
import { useApp } from '../../context/AppContext';
import { formatDateTimeBR } from '../../utils/dateUtils';
import { useBrandIdentity } from '../../core/brandIdentityEngine';
import { documentAccentInk, documentBarGradient, documentOnAccent, resolveDocumentColor } from '../../utils/documentTheme';

interface PrintableDocumentHeaderProps {
  documentTypeLabel: string;
  documentCode?: string;
  issuedAt?: string;
  subtitle?: string;
  snapshotLogoUrl?: string | null;
  badges?: { label: string; dark?: boolean }[];
}

export const PrintableDocumentHeader: React.FC<PrintableDocumentHeaderProps> = ({
  documentTypeLabel,
  documentCode,
  issuedAt,
  subtitle = 'Estética & Detalhamento Especializado de Motocicletas',
  snapshotLogoUrl,
  badges = [],
}) => {
  const { settings } = useApp();
  const brandIdentity = useBrandIdentity();
  const effectiveLogoVersion =
    snapshotLogoUrl === undefined ? brandIdentity.version : undefined;
  const documentColor = resolveDocumentColor(settings.documentColor);
  const accentInk = documentAccentInk(settings.documentColor);
  const onAccent = documentOnAccent(settings.documentColor);

  return (
    <div className="space-y-3 print-avoid-break">
      <div
        className="h-1.5 rounded-full print:rounded-none print:!bg-none"
        style={{ backgroundImage: documentBarGradient(settings.documentColor), backgroundColor: documentColor }}
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b-2 border-slate-900">
        <div className="flex items-start gap-3 min-w-0">
          <BrandLogo
            variant="document"
            companyName={companyDisplayName(settings)}
            snapshotUrl={snapshotLogoUrl}
          />
          <div className="space-y-0.5 min-w-0">
            <h1 className="font-black text-xl tracking-tight text-slate-900 leading-none">
              {companyDisplayName(settings)}
            </h1>
            <p
              className="text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: accentInk }}
            >
              {subtitle}
            </p>
            <p className="text-[10.5px] text-slate-600">
              CNPJ: {settings.cnpj || '—'} · Tel: {settings.phone || '—'} · WhatsApp:{' '}
              {settings.whatsapp || settings.phone || '—'}
            </p>
            <p className="text-[10.5px] text-slate-600">
              {settings.address || '—'} — {settings.city || '—'}
              {settings.state ? `/${settings.state}` : ''}
              {settings.email ? ` · ${settings.email}` : ''}
            </p>
          </div>
        </div>

        <div
          className="w-full sm:w-auto border border-slate-300 rounded-xl bg-slate-50 px-3.5 py-2.5 text-left sm:text-right shrink-0 border-t-4"
          style={{ borderTopColor: documentColor }}
        >
          <span
            className="text-[9.5px] font-extrabold uppercase tracking-widest block"
            style={{ color: accentInk }}
          >
            {documentTypeLabel}
          </span>
          {documentCode && (
            <span className="text-lg font-black font-mono text-slate-900 block tracking-tight">
              {documentCode}
            </span>
          )}
          <span className="text-[10.5px] text-slate-600 block mt-0.5 tabular-nums">
            Emissão: {formatDateTimeBR(issuedAt || new Date().toISOString())}
          </span>
          {effectiveLogoVersion && !brandIdentity.isDefault && (
            <span className="text-[9px] text-slate-400 font-mono block tabular-nums">
              Identidade Visual v{effectiveLogoVersion}
            </span>
          )}
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap sm:justify-end gap-1.5 text-[9.5px] font-extrabold uppercase">
              {badges.map((b, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded ${
                    b.dark ? '' : 'border border-slate-400 text-slate-800 bg-white'
                  }`}
                  style={b.dark ? { backgroundColor: documentColor, color: onAccent } : undefined}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
