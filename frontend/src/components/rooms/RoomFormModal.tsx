// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { Room } from "../../types";
import { Modal } from "../ui/Modal";
import { RoomForm } from "./RoomForm";

interface RoomFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  room: Room | null;
  isAdmin: boolean;
  onClose: () => void;
  /** On create, receives the new room; on edit, called with no argument. */
  onSaved: (createdRoom?: Room) => void;
}

export function RoomFormModal({
  open,
  mode,
  room,
  isAdmin,
  onClose,
  onSaved,
}: RoomFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("rooms.addRoomModal") : t("rooms.editRoomModal")}
    >
      <RoomForm
        active={open}
        mode={mode}
        room={room}
        isAdmin={isAdmin}
        onCancel={onClose}
        onSuccess={(created) => {
          onSaved(created);
          onClose();
        }}
      />
    </Modal>
  );
}
