// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, X } from "lucide-react";
import { api, userFacingApiError } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { Button } from "./ui/Button";

export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.email_verified || dismissed) {
    return null;
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError(null);
    try {
      const { data } = await api.post<{ ok: boolean; queued: boolean }>("auth/resend-verification");
      if (data.queued) {
        setResent(true);
      } else {
        setError(t("auth.verifyBanner.rateLimited"));
      }
      await loadUser();
    } catch (err) {
      setError(userFacingApiError(err, "auth.verifyBanner.failed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className="border-b border-[#D4A843]/40 bg-[#D4A843]/15 px-3 py-2.5 sm:px-4 md:px-6 lg:px-8"
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-text)]">
          <Mail className="h-4 w-4 shrink-0 text-[#B8860B]" aria-hidden />
          <span className="truncate">{resent ? t("auth.verifyBanner.resent") : t("auth.verifyBanner.text")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {error ? (
            <span className="text-xs text-red-600" role="alert">
              {error}
            </span>
          ) : null}
          {!resent ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={resending}
              onClick={(e) => {
                e.preventDefault();
                void handleResend();
              }}
            >
              {t("auth.verifyBanner.resend")}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text)]"
            aria-label={t("common.dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
