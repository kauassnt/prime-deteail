import { useState, useEffect } from 'react';

/**
 * Formats a Date into local YYYY-MM-DD (never shifts day due to UTC timezone offset).
 */
export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns local YYYY-MM-DD shifted by offsetDays (e.g., -1 for yesterday, -6 for 6 days ago).
 */
export function getOffsetLocalDateStr(offsetDays: number, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  return getLocalDateStr(d);
}

/**
 * Safely parses YYYY-MM-DD or ISO timestamps into a local Date without UTC off-by-one-day bugs.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // Date-only string 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(dateStr);
}

/**
 * Extracts local YYYY-MM-DD key from either 'YYYY-MM-DD' or full ISO date-time string.
 */
export function getLocalDateKey(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return dateStr.slice(0, 10);
  }
  return getLocalDateStr(parsed);
}

export function formatDateShortBR(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  return `${d}/${m}`;
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Aceita tanto 'YYYY-MM-DD' quanto ISO completo (ex.: createdAt/validUntil)
  const [y, m, d] = getLocalDateKey(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const datePart = formatDateBR(getLocalDateStr(d));
  const timePart = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

export function isDateStrInPeriod(
  dateStr: string | undefined,
  period: 'hoje' | 'ontem' | '7dias' | '30dias' | 'mes_atual' | 'mes_anterior' | 'tudo',
  now: Date = new Date()
): boolean {
  if (!dateStr) return false;
  if (period === 'tudo') return true;

  const itemKey = getLocalDateKey(dateStr);
  if (!itemKey || itemKey.length !== 10) return false;

  const todayKey = getLocalDateStr(now);
  const yesterdayKey = getOffsetLocalDateStr(-1, now);

  if (period === 'hoje') return itemKey === todayKey;
  if (period === 'ontem') return itemKey === yesterdayKey;

  if (period === '7dias') {
    const startKey = getOffsetLocalDateStr(-6, now);
    return itemKey >= startKey && itemKey <= todayKey;
  }
  if (period === '30dias') {
    const startKey = getOffsetLocalDateStr(-29, now);
    return itemKey >= startKey && itemKey <= todayKey;
  }

  const [y, m] = itemKey.split('-').map(Number);
  if (period === 'mes_atual') {
    return y === now.getFullYear() && m === now.getMonth() + 1;
  }
  if (period === 'mes_anterior') {
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return y === prevYear && m === prevMonth;
  }

  return true;
}

/**
 * Reactive hook providing the live local date.
 * Automatically updates when midnight passes or when the tab regains focus.
 */
export function useCurrentDate() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const checkDate = () => {
      const current = new Date();
      setNow(prev => (getLocalDateStr(prev) !== getLocalDateStr(current) ? current : prev));
    };

    const interval = setInterval(checkDate, 30_000);
    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== 'hidden') {
        checkDate();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  const todayStr = getLocalDateStr(now);
  const yesterdayStr = getOffsetLocalDateStr(-1, now);
  const formattedToday = formatDateBR(todayStr);

  return {
    now,
    todayStr,
    yesterdayStr,
    formattedToday,
  };
}
