// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  contentClassName?: string;
}

export function Modal({ open, title, onClose, children, contentClassName }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className={cn(
          "max-w-lg gap-0 rounded-2xl border border-gray-100 bg-[var(--color-surface)] px-5 py-6 shadow-xl sm:max-w-lg sm:px-8 sm:py-7",
          contentClassName,
        )}
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <DialogTitle className="mb-4 text-lg font-bold text-[var(--color-text)]">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
