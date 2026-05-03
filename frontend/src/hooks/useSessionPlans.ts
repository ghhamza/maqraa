// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { api } from "../lib/api";
import type { RecitationPublic } from "../types";

export interface UseSessionPlansArgs {
  setPlans: Dispatch<SetStateAction<RecitationPublic[]>>;
}

export function useSessionPlans({ setPlans }: UseSessionPlansArgs) {
  const transition = useCallback(
    async (planId: string, action: "start" | "pause" | "skip" | "reopen", body?: object) => {
      let snapshot: RecitationPublic[] = [];
      setPlans((prev) => {
        snapshot = prev;
        const optimisticStatus: RecitationPublic["plan_status"] | null =
          action === "start"
            ? "in_progress"
            : action === "pause"
              ? "paused"
              : action === "skip"
                ? "skipped"
                : action === "reopen"
                  ? "planned"
                  : null;
        if (!optimisticStatus) return prev;
        return prev.map((p) => (p.id === planId ? { ...p, plan_status: optimisticStatus } : p));
      });

      try {
        const { data } = await api.post<RecitationPublic>(`recitations/${planId}/${action}`, body ?? {});
        setPlans((prev) => prev.map((p) => (p.id === planId ? data : p)));
      } catch (err) {
        setPlans(snapshot);
        throw err;
      }
    },
    [setPlans],
  );

  const start = useCallback((planId: string) => transition(planId, "start"), [transition]);
  const pause = useCallback((planId: string) => transition(planId, "pause"), [transition]);
  const skip = useCallback((planId: string) => transition(planId, "skip"), [transition]);
  const reopen = useCallback(
    (planId: string, clearGrade: boolean = true) => transition(planId, "reopen", { clear_grade: clearGrade }),
    [transition],
  );

  return { start, pause, skip, reopen, transition };
}
