// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";

export interface LiveSessionConfirmModalsProps {
  // Leave confirmation
  leaveOpen: boolean;
  onLeaveCancel: () => void;
  onLeaveConfirm: () => void;
  // End session (teacher only)
  endSessionOpen: boolean;
  endError: string | null;
  endingSession: boolean;
  onEndSessionCancel: () => void;
  onEndSessionConfirm: () => void;
  // Navigation block (react-router blocker)
  navBlockOpen: boolean;
  onNavStay: () => void;
  onNavLeave: () => void;
  // Microphone permission
  micPermissionOpen: boolean;
  onMicPermissionDismiss: () => void;
  onMicPermissionRetry: () => void;
}

export function LiveSessionConfirmModals(props: LiveSessionConfirmModalsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Modal open={props.leaveOpen} title={t("liveSession.leave")} onClose={props.onLeaveCancel}>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">{t("liveSession.leaveConfirm")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onLeaveCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={props.onLeaveConfirm}>
            {t("liveSession.leave")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={props.endSessionOpen}
        title={t("liveSession.endSession")}
        onClose={props.onEndSessionCancel}
      >
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("liveSession.endSessionConfirm")}</p>
        {props.endError ? <p className="mb-4 text-sm text-red-600">{props.endError}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onEndSessionCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={props.endingSession}
            onClick={props.onEndSessionConfirm}
          >
            {t("liveSession.endSession")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={props.navBlockOpen}
        title={t("liveSession.leaveSessionConfirm")}
        onClose={props.onNavStay}
      >
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">{t("liveSession.navigationLeaveHint")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onNavStay}>
            {t("liveSession.stay")}
          </Button>
          <Button type="button" variant="primary" onClick={props.onNavLeave}>
            {t("liveSession.leave")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={props.micPermissionOpen}
        title={t("liveSession.micPermissionDenied.title")}
        onClose={props.onMicPermissionDismiss}
      >
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          {t("liveSession.micPermissionDenied.description")}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onMicPermissionDismiss}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={props.onMicPermissionRetry}>
            {t("liveSession.micPermissionDenied.retry")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
