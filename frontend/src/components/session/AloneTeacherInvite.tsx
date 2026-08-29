// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { UserPlus, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

interface AloneTeacherInviteBarProps {
  onInvite: () => void;
  className?: string;
}

/** Persistent top bar when the teacher is the only person in the live room. */
export function AloneTeacherInviteBar({ onInvite, className }: AloneTeacherInviteBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative z-20 flex flex-wrap items-center gap-3 border-b border-black/10 bg-[var(--color-primary)] px-4 py-3 text-white shadow-[0_4px_18px_rgba(27,94,32,0.28)]",
        className,
      )}
      role="status"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15" aria-hidden>
        <Users className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 text-start">
        <p className="text-sm font-semibold leading-snug sm:text-base">{t("instant.inviteStripTitle")}</p>
        <p className="mt-0.5 text-xs text-white/85 sm:text-sm">{t("instant.inviteStripHint")}</p>
      </div>
      <Button
        type="button"
        size="lg"
        className="shrink-0 border-0 bg-[var(--color-gold)] text-[#1a1a1a] shadow-md hover:brightness-105 focus-visible:ring-[var(--color-gold)]"
        onClick={onInvite}
      >
        <span className="inline-flex items-center gap-2">
          <UserPlus className="size-5" aria-hidden />
          {t("invite.invite")}
        </span>
      </Button>
    </div>
  );
}

interface AloneTeacherInviteNudgeProps {
  onInvite: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * One-shot floating prompt over the mushaf so invite isn’t easy to miss.
 * Dismiss keeps the top bar available.
 */
export function AloneTeacherInviteNudge({
  onInvite,
  onDismiss,
  className,
}: AloneTeacherInviteNudgeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-3 z-[25] flex justify-center px-3 md:top-5",
        className,
      )}
    >
      <div
        className="pointer-events-auto relative w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)] duration-300"
        role="dialog"
        aria-labelledby="alone-invite-nudge-title"
      >
        <button
          type="button"
          className="absolute end-2 top-2 grid size-8 place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text)]"
          aria-label={t("common.dismiss")}
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
        <div className="flex gap-3 pe-6">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            aria-hidden
          >
            <UserPlus className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 text-start">
            <h2
              id="alone-invite-nudge-title"
              className="font-[family-name:var(--font-heading)] text-base text-[var(--color-text)] sm:text-lg"
            >
              {t("instant.inviteStripTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t("instant.inviteNudgeBody")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="sm:min-w-[9rem]" onClick={onDismiss}>
            {t("instant.inviteLater")}
          </Button>
          <Button type="button" variant="primary" size="lg" className="sm:min-w-[9rem]" onClick={onInvite}>
            <span className="inline-flex items-center gap-2">
              <UserPlus className="size-5" aria-hidden />
              {t("invite.invite")}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
