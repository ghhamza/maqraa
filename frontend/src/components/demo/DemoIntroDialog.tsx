// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface DemoIntroDialogProps {
  open: boolean;
  onStartTour: () => void;
  onSkipToPractice: () => void;
}

/** Entry popup so the sandbox is clearly not a real live session. */
export function DemoIntroDialog({ open, onStartTour, onSkipToPractice }: DemoIntroDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkipToPractice();
      }}
    >
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-[var(--color-primary)] px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-white/15" aria-hidden>
              <Sparkles className="size-5 text-[var(--color-gold)]" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              {t("demo.modeBadge")}
            </p>
          </div>
          <DialogHeader className="mt-3 gap-1.5 text-start">
            <DialogTitle className="font-[family-name:var(--font-heading)] text-xl text-white">
              {t("demo.introTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/85">
              {t("demo.introBody")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <ul className="space-y-2 px-5 py-4 text-sm text-[var(--color-text-muted)]">
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" aria-hidden />
            <span>{t("demo.introPoint1")}</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" aria-hidden />
            <span>{t("demo.introPoint2")}</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" aria-hidden />
            <span>{t("demo.introPoint3")}</span>
          </li>
        </ul>
        <DialogFooter className="mx-0 mb-0 border-t border-black/5 bg-[var(--color-surface)] sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onSkipToPractice}>
            {t("demo.introSkip")}
          </Button>
          <Button type="button" variant="primary" size="lg" onClick={onStartTour}>
            {t("demo.introStart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Persistent ribbon under the header — always visible during the sandbox. */
export function DemoModeBanner() {
  const { t } = useTranslation();
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--color-gold)]/35 bg-[linear-gradient(90deg,rgba(212,168,67,0.18),rgba(212,168,67,0.08)_40%,rgba(212,168,67,0.18))] px-4 py-2 text-center"
      role="status"
    >
      <Sparkles className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <p className="text-xs font-medium text-[var(--color-text)] sm:text-sm">{t("demo.modeBanner")}</p>
    </div>
  );
}
