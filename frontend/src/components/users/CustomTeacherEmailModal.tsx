// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import {
  usePreviewCustomTeacherEmail,
  useSendCustomTeacherEmail,
  type CustomTeacherEmailInput,
  type CustomTeacherEmailPreview,
} from "../../data/users";

interface CustomTeacherEmailModalProps {
  open: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  preferredLanguage: string;
  onClose: () => void;
  onSent: () => void;
}

type Step = "compose" | "preview";

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

export function CustomTeacherEmailModal({
  open,
  userId,
  userName,
  userEmail,
  preferredLanguage,
  onClose,
  onSent,
}: CustomTeacherEmailModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("compose");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CustomTeacherEmailPreview | null>(null);

  const previewMutation = usePreviewCustomTeacherEmail(userId, (message) => setError(message));
  const sendMutation = useSendCustomTeacherEmail(
    userId,
    () => {
      onSent();
      onClose();
    },
    (message) => setError(message),
  );

  const loading = previewMutation.isPending || sendMutation.isPending;
  const isRtl = preferredLanguage === "ar";

  useEffect(() => {
    if (!open) return;
    setStep("compose");
    setSubject("");
    setMessage("");
    setError(null);
    setPreview(null);
  }, [open]);

  function validateCompose(): CustomTeacherEmailInput | null {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      setError(t("users.communication.customEmail.validationRequired"));
      return null;
    }
    if (trimmedSubject.length > MAX_SUBJECT) {
      setError(t("users.communication.customEmail.validationSubjectLength"));
      return null;
    }
    if (trimmedMessage.length > MAX_MESSAGE) {
      setError(t("users.communication.customEmail.validationMessageLength"));
      return null;
    }

    setError(null);
    return { subject: trimmedSubject, message: trimmedMessage };
  }

  function handlePreview() {
    const input = validateCompose();
    if (!input || loading) return;

    previewMutation.mutate(input, {
      onSuccess: (data) => {
        setPreview(data);
        setStep("preview");
      },
    });
  }

  function handleSend() {
    const input = validateCompose();
    if (!input || loading) return;
    sendMutation.mutate(input);
  }

  const title =
    step === "preview"
      ? t("users.communication.customEmail.previewTitle")
      : t("users.communication.customEmail.composeTitle");

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      contentClassName={step === "preview" ? "max-w-3xl sm:max-w-3xl" : undefined}
    >
      <div>
        {step === "compose" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handlePreview();
            }}
          >
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("users.communication.customEmail.recipient", {
                name: userName,
                email: userEmail,
              })}
            </p>

            <Input
              label={t("users.communication.customEmail.subjectLabel")}
              name="subject"
              value={subject}
              maxLength={MAX_SUBJECT}
              onChange={(event) => setSubject(event.target.value)}
              disabled={loading}
              dir={isRtl ? "rtl" : undefined}
            />

            <div className="w-full">
              <label
                htmlFor="custom-email-message"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
              >
                {t("users.communication.customEmail.messageLabel")}
              </label>
              <textarea
                id="custom-email-message"
                name="message"
                rows={8}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={loading}
                dir={isRtl ? "rtl" : undefined}
                className="flex w-full rounded-xl border border-input bg-[var(--color-surface)] px-3 py-2 text-start text-base text-foreground shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder={t("users.communication.customEmail.messagePlaceholder")}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t("users.communication.customEmail.messageHint")}
              </p>
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading} loading={previewMutation.isPending}>
                {t("users.communication.customEmail.previewButton")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("users.communication.customEmail.previewHint", { email: userEmail })}
            </p>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#FAFAF5]">
              <iframe
                title={t("users.communication.customEmail.previewTitle")}
                srcDoc={preview?.html ?? ""}
                sandbox=""
                className="h-[min(70vh,520px)] w-full border-0 bg-white"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep("compose");
                  setError(null);
                }}
                disabled={loading}
              >
                {t("users.communication.customEmail.backButton")}
              </Button>
              <Button type="button" onClick={handleSend} disabled={loading} loading={sendMutation.isPending}>
                {t("users.communication.customEmail.sendButton")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
