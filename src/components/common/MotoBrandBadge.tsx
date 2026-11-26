import React, { useState } from 'react';
import { MotoCatalogBrand } from '../../types';
import { sanitizeImageUrl } from '../../core/errorHandler';

interface MotoBrandBadgeProps {
  brand?: Partial<MotoCatalogBrand> | null;
  brandName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<MotoBrandBadgeProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px] rounded-md',
  sm: 'w-7 h-7 text-[10px] rounded-lg',
  md: 'w-9 h-9 text-xs rounded-xl',
  lg: 'w-12 h-12 text-sm rounded-2xl',
};

function renderCustomEmblem(normName: string) {
  switch (normName) {
    case 'bmw':
      return (
        <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" fill="currentColor" fillOpacity="0.9" />
          <path d="M12 22 A10 10 0 0 1 2 12 L12 12 Z" fill="currentColor" fillOpacity="0.9" />
        </svg>
      );
    case 'honda':
      return (
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden="true">
          <path
            d="M4 17 C8 13, 13 8, 20 5 C17 9, 15 11, 20 10 C15 14, 12 16, 4 17 Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'yamaha':
      return (
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 3.5 L12 12 M12 12 L5 17 M12 12 L19 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'ducati':
      return (
        <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" aria-hidden="true">
          <path
            d="M5 4 H19 V12 C19 17 12 21 12 21 C12 21 5 17 5 12 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <path d="M7.5 14 L16.5 9" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
    case 'triumph':
      return (
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden="true">
          <path d="M4 7 H20 M12 7 V18 M6 18 H18" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
    case 'kawasaki':
      return (
        <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" aria-hidden="true">
          <path d="M6 4 V20 M6 12 L17 4 M10 12 L18 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'suzuki':
      return (
        <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" aria-hidden="true">
          <path
            d="M17 6 H9 L6 9.5 L15 12 L18 14.5 L15 18 H7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'harley davidson':
      return (
        <svg viewBox="0 0 24 24" className="w-[74%] h-[74%]" aria-hidden="true">
          <path d="M4 6 H20 L18 16 L12 20 L6 16 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="2.5" y="9.5" width="19" height="4.2" rx="1" fill="currentColor" />
        </svg>
      );
    case 'royal enfield':
      return (
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden="true">
          <path d="M5 17 L6 8 L10 12 L12 6 L14 12 L18 8 L19 17 Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export const MotoBrandBadge: React.FC<MotoBrandBadgeProps> = React.memo(({
  brand,
  brandName,
  size = 'sm',
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = brand?.name || brandName || '?';
  const norm = (brand?.normalizedName || displayName).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const monogram =
    brand?.monogram ||
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() ||
    'MT';
  const color = brand?.brandColor || '#0F172A';
  const emblem = renderCustomEmblem(norm);
  const safeLogoUrl = sanitizeImageUrl(brand?.logoUrl);

  if (safeLogoUrl && !imgError) {
    return (
      <span
        className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center bg-white border border-slate-200 overflow-hidden shrink-0`}
      >
        <img
          src={safeLogoUrl}
          alt={displayName}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-0.5"
        />
      </span>
    );
  }

  return (
    <span
      className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center font-black tracking-tight text-white shrink-0 shadow-2xs`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {emblem || <span>{monogram.slice(0, 3)}</span>}
    </span>
  );
});

MotoBrandBadge.displayName = 'MotoBrandBadge';
