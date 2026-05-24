// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { Button } from "../ui/Button";

/** Non-blocking warning when the live-sessions poll fails (TanStack Query error). */
export function LiveSessionsErrorToast() {
  const { t } = useTranslation();
  const { error } = useLiveSessions();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!error) setDismissed(false);
  }, [error]);

  if (!error || dismissed) return null;

  return (
    <div
      role="alert"
      className="sticky top-[calc(var(--pre-launch-banner-height)+4rem)] z-[31] flex w-full min-w-0 items-start gap-2 border-b border-amber-500/35 bg-amber-500/15 px-3 py-2 text-start shadow-sm sm:px-4 md:px-6"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-xs text-foreground sm:text-sm">{t("liveSession.errors.pollingFailed")}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-foreground"
        aria-label={t("common.close")}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
