// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Button } from "../ui/Button";
import { PageCard } from "../layout/PageCard";
import { useSendSessionGuide } from "../../data/users";

interface UserCommunicationSectionProps {
  userId: string;
}

export function UserCommunicationSection({ userId }: UserCommunicationSectionProps) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const sendGuideMutation = useSendSessionGuide(
    () => setToast("success"),
    () => setToast("error"),
  );

  useEffect(() => {
    if (!toast) return;
    const tm = window.setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(tm);
  }, [toast]);

  const handleSendFirstSessionGuide = useCallback(() => {
    if (cooldown || sendGuideMutation.isPending) return;
    sendGuideMutation.mutate(userId, {
      onSuccess: () => {
        setCooldown(true);
        window.setTimeout(() => setCooldown(false), 30_000);
      },
    });
  }, [userId, cooldown, sendGuideMutation]);

  return (
    <>
      <PageCard>
        <h2 className="mb-1 text-lg font-semibold text-[var(--color-text)]">
          {t("users.communication.title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          {t("users.communication.description")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={cooldown || sendGuideMutation.isPending}
            loading={sendGuideMutation.isPending}
            onClick={handleSendFirstSessionGuide}
            title={t("users.communication.firstSessionGuide.description")}
          >
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#D4A843]" aria-hidden />
              {t("users.communication.firstSessionGuide.button")}
            </span>
          </Button>
        </div>
      </PageCard>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border-2 p-4 shadow-lg md:left-auto md:right-6 md:top-24 ${
            toast === "success"
              ? "border-[var(--color-primary)]/40 bg-[#E8F5E9] text-[var(--color-primary)]"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-semibold">
            {toast === "success"
              ? t("users.communication.sendSuccess")
              : t("users.communication.sendError")}
          </p>
        </div>
      ) : null}
    </>
  );
}
