'use client';

import { useCallback, useMemo, useState } from 'react';
import { PAGINATION } from '@/lib/constants';

interface UsePaginationReturn {
  /** Current page number (1-based) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Navigate to a specific page */
  setPage: (page: number) => void;
  /** Change the number of items per page (resets to page 1) */
  setPerPage: (perPage: number) => void;
  /** Set the total number of items (recalculates totalPages) */
  setTotal: (total: number) => void;
  /** Alias for setTotal — sets total_pages directly (total * perPage) */
  setTotalPages: (totalPages: number) => void;
  /** Offset for database queries (0-based, for use with Supabase .range()) */
  offset: number;
}

/**
 * Hook for managing pagination state.
 * Provides page, perPage, totalPages, and a computed offset for database queries.
 *
 * @param initialPerPage - Initial items per page (defaults to PAGINATION.DEFAULT_PAGE_SIZE)
 */
export function usePagination(
  initialPerPage: number = PAGINATION.DEFAULT_PAGE_SIZE,
): UsePaginationReturn {
  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState(
    Math.min(initialPerPage, PAGINATION.MAX_PAGE_SIZE),
  );
  const [total, setTotalState] = useState(0);

  /** Total pages based on total items and items per page */
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / perPage)),
    [total, perPage],
  );

  /** Database offset (0-based) */
  const offset = useMemo(() => (page - 1) * perPage, [page, perPage]);

  /** Navigate to a specific page (clamped to valid range) */
  const setPage = useCallback(
    (newPage: number) => {
      setPageState(Math.max(1, Math.min(newPage, totalPages)));
    },
    [totalPages],
  );

  /** Change items per page and reset to page 1 */
  const setPerPage = useCallback((newPerPage: number) => {
    const clamped = Math.max(1, Math.min(newPerPage, PAGINATION.MAX_PAGE_SIZE));
    setPerPageState(clamped);
    setPageState(1);
  }, []);

  /** Set total items count */
  const setTotal = useCallback((newTotal: number) => {
    setTotalState(Math.max(0, newTotal));
  }, []);

  /** Set total pages directly (converts to total items internally) */
  const setTotalPages = useCallback(
    (newTotalPages: number) => {
      setTotalState(Math.max(0, newTotalPages) * perPage);
    },
    [perPage],
  );

  return {
    page,
    perPage,
    totalPages,
    setPage,
    setPerPage,
    setTotal,
    setTotalPages,
    offset,
  };
}
