// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";

export function LiveSessionLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"
        role="status"
        aria-label={t("common.loading")}
      />
    </div>
  );
}

export function LiveSessionLoadError({
  message,
  onBack,
}: {
  message: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] p-6">
      <p className="text-center text-[var(--color-text-muted)]">{message ?? t("errors.not_found")}</p>
      <Button type="button" variant="outline" onClick={onBack}>
        {t("common.back")}
      </Button>
    </div>
  );
}

export function LiveSessionAnotherTab() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-bg)] p-6">
      <p className="max-w-md text-center text-[var(--color-text)]">
        {t("liveSession.connectedFromAnotherTab")}
      </p>
      <Button type="button" variant="primary" onClick={() => window.location.reload()}>
        {t("liveSession.refreshPage")}
      </Button>
    </div>
  );
}
