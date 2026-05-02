// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useCancellableEffect } from "./useCancellableEffect";
import { api } from "../lib/api";

export interface QfStreak {
  days: number;
  longest: number | null;
}

export function useQfStreak(enabled: boolean) {
  const [data, setData] = useState<QfStreak | null>(null);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(true);

  useCancellableEffect(
    async (signal) => {
      if (!enabled) {
        setData(null);
        setLoading(false);
        setLinked(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get<QfStreak>("qf/me/streak", { signal });
        setData(res.data);
        setLinked(true);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setLinked(false);
          return;
        }
        setLinked(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [enabled],
  );

  return { data, loading, linked };
}
