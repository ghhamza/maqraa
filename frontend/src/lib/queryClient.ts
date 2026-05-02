// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { QueryClient } from "@tanstack/react-query";

/**
 * App-wide TanStack Query client.
 *
 * Defaults are tuned for "mostly fresh, retry-on-network-error" behaviour:
 * - `staleTime`: 30s — most lists are fine to serve from cache for half a minute.
 * - `gcTime`: 5 min — keep dropped queries in cache briefly so back-navigation is instant.
 * - `retry`: only retry on network errors; do not retry 4xx responses.
 * - `refetchOnWindowFocus`: true — matches the existing `LiveSessionsContext` behaviour.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        // Don't retry client errors (auth, validation, 404). Retry network errors up to 2x.
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
