// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { parseEmailInput, useInviteStudents } from "../../data/share";
import { userFacingApiError } from "../../lib/api";
import { cn } from "@/lib/utils";

interface InviteStudentsModalProps {
  open: boolean;
  roomId: string;
  onClose: () => void;
}

export function InviteStudentsModal({ open, roomId, onClose }: InviteStudentsModalProps) {
  const { t, i18n } = useTranslation();
  const inviteMutation = useInviteStudents(roomId);

  const [rawInput, setRawInput] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [chipEmails, setChipEmails] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [invalidHint, setInvalidHint] = useState(false);

  const locale = i18n.language?.startsWith("ar")
    ? "ar"
    : i18n.language?.startsWith("fr")
      ? "fr"
      : "en";

  useEffect(() => {
    if (!open) {
      setRawInput("");
      setChipEmails([]);
      setAutoApprove(true);
      setFeedback(null);
      setFeedbackIsError(false);
      setInvalidHint(false);
    }
  }, [open]);

  const pendingFromInput = useMemo(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];
    return parseEmailInput(trimmed).valid;
  }, [rawInput]);

  const allEmails = useMemo(() => {
    const set = new Set(chipEmails);
    for (const e of pendingFromInput) set.add(e);
    return [...set];
  }, [chipEmails, pendingFromInput]);

  function commitInputToChips() {
    const { valid, invalidCount } = parseEmailInput(rawInput);
    if (valid.length > 0) {
      setChipEmails((prev) => [...new Set([...prev, ...valid])]);
      setRawInput("");
    }
    setInvalidHint(invalidCount > 0);
  }

  function removeChip(email: string) {
    setChipEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInputToChips();
    }
  }

  async function handleSend() {
    setFeedback(null);
    setFeedbackIsError(false);

    const { valid: fromRaw, invalidCount } = parseEmailInput(rawInput);
    if (invalidCount > 0) setInvalidHint(true);
    const emails = [...new Set([...chipEmails, ...fromRaw])];
    if (emails.length === 0) {
      setInvalidHint(true);
      return;
    }

    try {
      await inviteMutation.mutateAsync({
        emails,
        auto_approve: autoApprove,
        locale,
      });
      onClose();
    } catch (err) {
      setFeedback(userFacingApiError(err));
      setFeedbackIsError(true);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("invite.invite")} contentClassName="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">
            {t("invite.emailsPlaceholder")}
          </label>
          <div
            className={cn(
              "min-h-[120px] rounded-xl border bg-white p-3 shadow-sm",
              "focus-within:border-[#1B5E20]/40 focus-within:ring-2 focus-within:ring-[#1B5E20]/10",
              invalidHint ? "border-amber-300" : "border-[#6B7280]/30",
            )}
          >
            <div className="mb-2 flex flex-wrap gap-2">
              {chipEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-md border border-[#6B7280]/30 bg-[#FAFAF5] px-2 py-1 text-sm text-[#1A1A1A]"
                >
                  {email}
                  <button
                    type="button"
                    className="rounded p-0.5 text-[#6B7280] hover:bg-white hover:text-[#1A1A1A]"
                    aria-label={email}
                    onClick={() => removeChip(email)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <textarea
              className="w-full resize-none border-0 bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-[#6B7280]"
              rows={3}
              placeholder={chipEmails.length === 0 ? t("invite.emailsPlaceholder") : ""}
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setInvalidHint(false);
              }}
              onBlur={() => commitInputToChips()}
              onKeyDown={handleKeyDown}
            />
          </div>
          {invalidHint ? (
            <p className="mt-1.5 text-xs text-amber-800">{t("invite.invalidEmail")}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-[#FAFAF5] p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#1B5E20]"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-[#1A1A1A]">{t("invite.autoApprove")}</span>
            <span className="mt-0.5 block text-xs text-[#6B7280]">{t("invite.autoApproveHint")}</span>
          </span>
        </label>

        {feedback ? (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              feedbackIsError ? "bg-red-50 text-red-800" : "bg-[#E8F5E9] text-[#1B5E20]",
            )}
            role="alert"
          >
            {feedback}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={inviteMutation.isPending}
            disabled={allEmails.length === 0 && !rawInput.trim()}
            onClick={() => void handleSend()}
          >
            <span className="inline-flex items-center gap-2">
              <Send className="h-4 w-4" />
              {t("invite.send")}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
