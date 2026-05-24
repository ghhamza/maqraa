// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { Modal } from "../ui/Modal";
import { SessionForm } from "./SessionForm";

interface SessionFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  session: SessionPublic | null;
  defaultRoomId?: string;
  defaultDatetime?: Date | null;
  /** When true (e.g. picked a day on the calendar), default time is 09:00 local */
  presetMorningStart?: boolean;
  /** When editing a recurring session, controls bulk PUT targets */
  editScope?: "this" | "this_and_future" | "all";
  onClose: () => void;
  onSaved: () => void;
}

export function SessionFormModal({
  open,
  mode,
  session,
  defaultRoomId,
  defaultDatetime,
  presetMorningStart,
  editScope,
  onClose,
  onSaved,
}: SessionFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("sessions.addSession") : t("sessions.editSession")}
    >
      <SessionForm
        active={open}
        mode={mode}
        session={session}
        defaultRoomId={defaultRoomId}
        defaultDatetime={defaultDatetime}
        presetMorningStart={presetMorningStart}
        editScope={editScope}
        onCancel={onClose}
        onSuccess={() => {
          onSaved();
          onClose();
        }}
      />
    </Modal>
  );
}
