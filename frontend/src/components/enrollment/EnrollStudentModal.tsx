// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { EnrollStudentForm } from "./EnrollStudentForm";

interface EnrollStudentModalProps {
  open: boolean;
  roomId: string;
  maxStudents: number;
  currentCount: number;
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollStudentModal({
  open,
  roomId,
  maxStudents,
  currentCount,
  onClose,
  onEnrolled,
}: EnrollStudentModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t("enrollment.enrollModalTitle")}>
      <EnrollStudentForm
        active={open}
        roomId={roomId}
        maxStudents={maxStudents}
        currentCount={currentCount}
        onEnrolled={() => {
          onEnrolled();
          onClose();
        }}
      />
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
