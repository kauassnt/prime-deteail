import { useEffect, useMemo, useRef, useState } from 'react';

export interface ProgressiveListOptions {
  initialCount?: number;
  stepCount?: number;
  resetKey?: string | number;
}

/**
 * Lightweight progressive windowing hook for large lists (catalog models, fleet, clients, OS history).
 * Keeps initial DOM node count small (reducing style/layout recalc & TBT) while transparently loading
 * additional slices via IntersectionObserver when the user scrolls toward the bottom.
 */
export function useProgressiveList<T>(
  items: readonly T[],
  options: ProgressiveListOptions = {}
) {
  const { initialCount = 30, stepCount = 30, resetKey } = options;
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [resetKey, initialCount]);

  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisibleCount(prev => Math.min(items.length, prev + stepCount));
        }
      },
      { rootMargin: '140px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, items.length, stepCount]);

  const visibleItems = useMemo(
    () => (items.length <= visibleCount ? items : items.slice(0, visibleCount)),
    [items, visibleCount]
  );

  const showMore = () => {
    setVisibleCount(prev => Math.min(items.length, prev + stepCount));
  };

  return {
    visibleItems,
    totalCount: items.length,
    visibleCount: visibleItems.length,
    hasMore,
    remainingCount: Math.max(0, items.length - visibleItems.length),
    sentinelRef,
    showMore,
  };
}
