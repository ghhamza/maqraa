// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MoreVertical } from "lucide-react";
import type { RecitationPublic } from "../../../types";
import { getSurahNameWithArabic } from "../../../lib/quranService";
import { GradeBadge } from "../../recitations/GradeBadge";
import { Button } from "../../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function DonePlanRow({
  plan,
  studentName,
  isTeacher,
  locale,
  onReopen,
}: {
  plan: RecitationPublic;
  studentName: string;
  isTeacher: boolean;
  locale: string;
  onReopen: (clearGrade: boolean) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const skipped = plan.plan_status === "skipped";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            aria-hidden
          >
            {initials(studentName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{studentName}</p>
            <p className="truncate text-xs text-muted-foreground" style={{ fontFamily: "var(--font-quran)" }}>
              {getSurahNameWithArabic(plan.surah, locale)} · {plan.ayah_start}–{plan.ayah_end}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {skipped ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("liveSession.statusSkipped")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#1B5E20]" aria-hidden>
              <Check className="size-4" strokeWidth={2.5} />
            </span>
          )}
          {!skipped ? <GradeBadge grade={plan.grade} /> : null}
          {isTeacher ? (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={t("liveSession.overflowMore")}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  {t("liveSession.actionReopen")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("liveSession.reopenConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("liveSession.reopenConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <AlertDialogCancel className="sm:mt-0">{t("common.cancel")}</AlertDialogCancel>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  onReopen(false);
                  setConfirmOpen(false);
                }}
              >
                {t("liveSession.reopenKeepGrade")}
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  onReopen(true);
                  setConfirmOpen(false);
                }}
              >
                {t("liveSession.reopenClearGrade")}
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
