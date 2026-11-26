import React, { useEffect, useState } from 'react';
import { useBrandIdentity } from '../../core/brandIdentityEngine';
import { sanitizeImageUrl } from '../../core/errorHandler';

export type BrandLogoVariant =
  | 'icon'
  | 'sidebar'
  | 'navbar'
  | 'login'
  | 'loading'
  | 'portal'
  | 'document';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  companyName?: string;
  subtitle?: string;
  compact?: boolean;
  /** Optional historical logo URL snapshot for already-issued PDFs/ServiceOrders. Pass undefined to always track current live logo. */
  snapshotUrl?: string | null;
  className?: string;
}

const SIZE_BY_VARIANT: Record<BrandLogoVariant, string> = {
  icon: 'w-9 h-9 rounded-xl',
  sidebar: 'w-10 h-10 rounded-xl',
  navbar: 'w-8 h-8 rounded-xl',
  login: 'w-16 h-16 rounded-2xl',
  loading: 'w-14 h-14 rounded-2xl',
  portal: 'h-9 max-w-[148px] rounded-xl',
  document: 'w-14 h-14 rounded-xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = React.memo(
  ({
    variant = 'icon',
    companyName = 'PK DETAIL',
    subtitle = 'Estética de Motos',
    compact = false,
    snapshotUrl,
    className = '',
  }) => {
    const brandIdentity = useBrandIdentity();
    const [imgFailed, setImgFailed] = useState(false);

    // If snapshotUrl is explicitly null -> document was issued under default identity;
    // If snapshotUrl is a string -> document preserves issuance logo;
    // If snapshotUrl is undefined -> track live global active logo automatically.
    const rawLogoUrl =
      snapshotUrl !== undefined ? snapshotUrl : brandIdentity.activeLogo?.assetUrl || null;
    const safeUrl = sanitizeImageUrl(rawLogoUrl);

    useEffect(() => {
      setImgFailed(false);
    }, [safeUrl]);

    const boxClass = SIZE_BY_VARIANT[variant];

    const renderMark = () => {
      if (safeUrl && !imgFailed) {
        const bgFrame =
          variant === 'document'
            ? 'bg-white border border-slate-300 p-1'
            : variant === 'portal'
            ? 'bg-white border border-slate-200 px-1.5 py-1'
            : 'bg-white border border-slate-200/90 p-1 shadow-xs';

        return (
          <div
            className={`${boxClass} ${bgFrame} flex items-center justify-center overflow-hidden shrink-0 ${className}`}
          >
            <img
              src={safeUrl}
              alt={`Logomarca oficial ${companyName}`}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-contain select-none"
            />
          </div>
        );
      }

      if (variant === 'document') {
        return (
          <div
            className={`${boxClass} bg-[#171717] border-2 border-[#EA580C] flex flex-col items-center justify-center text-white shrink-0 ${className}`}
          >
            <span className="font-black text-lg leading-none tracking-tighter">PK</span>
            <span className="text-[6.5px] font-bold tracking-widest text-[#F97316] uppercase mt-0.5">
              DETAIL
            </span>
          </div>
        );
      }

      if (variant === 'portal') {
        return (
          <div className={`flex items-center gap-2 shrink-0 ${className}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#9A3412] to-[#EA580C] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              PK
            </div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 whitespace-nowrap">
              {companyName}
            </span>
          </div>
        );
      }

      const fontSize =
        variant === 'login' || variant === 'loading'
          ? 'text-2xl'
          : variant === 'navbar'
          ? 'text-xs'
          : 'text-base';

      return (
        <div
          className={`${boxClass} bg-gradient-to-tr from-[#9A3412] to-[#EA580C] flex items-center justify-center shadow-md shadow-[#EA580C]/20 shrink-0 ${className}`}
        >
          <span className={`text-white font-black ${fontSize} tracking-tighter`}>PK</span>
        </div>
      );
    };

    if (variant === 'portal') {
      if (safeUrl && !imgFailed) {
        return (
          <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
            {renderMark()}
            <span className="text-sm sm:text-base font-black tracking-tight text-slate-900 whitespace-nowrap">
              {companyName}
            </span>
          </div>
        );
      }
      return renderMark();
    }

    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-3 min-w-0">
          {renderMark()}
          {!compact && (
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm tracking-wider text-slate-900 uppercase truncate">
                {companyName}
              </h1>
              <span className="text-[10px] font-semibold text-[#EA580C] block tracking-widest uppercase truncate">
                {subtitle}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (variant === 'navbar') {
      return (
        <div className="flex items-center gap-2 shrink-0">
          {renderMark()}
          {!compact && (
            <span className="hidden min-[360px]:inline md:hidden font-extrabold text-xs tracking-wider uppercase text-slate-900 whitespace-nowrap">
              {companyName}
            </span>
          )}
        </div>
      );
    }

    return renderMark();
  }
);
