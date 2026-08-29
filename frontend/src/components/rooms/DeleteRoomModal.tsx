// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { usePurgeRoom } from "../../data/rooms";

interface DeleteRoomModalProps {
  open: boolean;
  roomId: string | null;
  roomName: string;
  onClose: () => void;
  onDeleted: () => void;
}

/** Permanently deletes an archived room (API: DELETE /rooms/{id}/permanent). */
export function DeleteRoomModal({ open, roomId, roomName, onClose, onDeleted }: DeleteRoomModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const purgeMutation = usePurgeRoom(
    () => {
      onDeleted();
      onClose();
    },
    (message) => setError(message),
  );

  const loading = purgeMutation.isPending;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function confirmDelete() {
    if (!roomId || loading) return;
    setError(null);
    purgeMutation.mutate(roomId);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("rooms.deleteTitle")}>
      <p className="mb-6 text-[var(--color-text-muted)]">
        {t("rooms.deleteConfirm", { name: roomName || "—" })}
      </p>
      {error ? (
        <p className="mb-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="danger" className="min-w-0 flex-1" loading={loading} onClick={confirmDelete}>
          {t("rooms.deletePermanent")}
        </Button>
      </div>
    </Modal>
  );
}
