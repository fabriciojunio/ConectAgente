'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { GlobalFilters, StatusVisita } from '@/types';

/** Keys allowed in the GlobalFilters object */
const FILTER_KEYS: (keyof GlobalFilters)[] = [
  'periodo_inicio',
  'periodo_fim',
  'unidade_saude',
  'bairro',
  'microarea',
  'agente_id',
  'status',
];

interface UseFiltersReturn {
  /** Current filter values (read from URL search params) */
  filters: GlobalFilters;
  /** Set a single filter value. Pass undefined to remove the filter. */
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  /** Reset all filters (clears URL search params) */
  resetFilters: () => void;
  /** Filters as a URLSearchParams string for API calls */
  filterParams: string;
}

/**
 * Hook for managing global dashboard filters synchronized with URL search params.
 * Reads filter values from the URL and writes changes back, enabling
 * shareable/bookmarkable filtered views.
 */
export function useFilters(): UseFiltersReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Parse current filters from URL search params */
  const filters = useMemo<GlobalFilters>(() => {
    const result: GlobalFilters = {};

    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value !== null && value !== '') {
        if (key === 'status') {
          result[key] = value as StatusVisita;
        } else {
          (result as Record<string, string>)[key] = value;
        }
      }
    }

    return result;
  }, [searchParams]);

  /** Set a single filter and update the URL */
  const setFilter = useCallback(
    <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  /** Reset all filters */
  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  /** Build a query string from current filters for API calls */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();

    for (const key of FILTER_KEYS) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    return params.toString();
  }, [filters]);

  return {
    filters,
    setFilter,
    resetFilters,
    filterParams,
  };
}
