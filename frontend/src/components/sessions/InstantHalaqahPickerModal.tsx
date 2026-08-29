// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Room } from "../../types";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export interface InstantHalaqahPickerModalProps {
  open: boolean;
  rooms: Room[];
  loading?: boolean;
  onClose: () => void;
  onPick: (roomId: string) => void;
  onNewHalaqah: () => void;
}

export function InstantHalaqahPickerModal({
  open,
  rooms,
  loading,
  onClose,
  onPick,
  onNewHalaqah,
}: InstantHalaqahPickerModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} title={t("instant.pickHalaqah")} onClose={onClose} contentClassName="max-w-sm">
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              type="button"
              disabled={loading}
              onClick={() => onPick(room.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-[var(--color-primary)]/8 disabled:opacity-60"
            >
              <span className="min-w-0 truncate font-medium text-[var(--color-text)]">{room.name}</span>
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                {t("rooms.studentCount", { count: room.enrolled_count })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        className="mt-4"
        disabled={loading}
        loading={loading}
        onClick={onNewHalaqah}
      >
        <span className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("instant.newHalaqah")}
        </span>
      </Button>
    </Modal>
  );
}
