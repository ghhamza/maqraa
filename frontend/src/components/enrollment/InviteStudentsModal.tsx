// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import type { Room } from "../../types";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { InputControl } from "../ui/Input";
import {
  findActiveShareLink,
  findPrimaryShareLink,
  useCreateShareLink,
  useShareLinks,
} from "../../data/share";
import { copyShareUrl, shareTeaserUrl } from "../../lib/shareIntents";
import { formatSessionTimeInviteLine } from "../../lib/sessionTime";
import { useAuthStore } from "../../stores/authStore";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const autoCreateInFlight = new Set<string>();

function autoCreateKey(roomId: string): string {
  return `invite-modal:halaqah:${roomId}`;
}

export interface InviteStudentsModalProps {
  open: boolean;
  room: Room;
  onClose: () => void;
}

export function InviteStudentsModal({ open, room, onClose }: InviteStudentsModalProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const linksQuery = useShareLinks("halaqah", room.id, open);
  const createMutation = useCreateShareLink("halaqah", room.id);
  const activeLink = useMemo(() => findPrimaryShareLink(linksQuery.data), [linksQuery.data]);
  const hasActiveLink = useMemo(() => !!findActiveShareLink(linksQuery.data), [linksQuery.data]);
  const key = autoCreateKey(room.id);
  const autoCreateTriggeredRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const token = activeLink?.token ?? room.share_token ?? null;
  const shareUrl = activeLink?.share_url ?? (token ? shareTeaserUrl(token) : "");

  const upcoming = useMemo(() => {
    const first = room.first_session;
    if (!first) return null;
    if (new Date(first.scheduled_at).getTime() < Date.now() - 60_000) return null;
    return first;
  }, [room.first_session]);

  const dateLabel = upcoming
    ? formatSessionTimeInviteLine(
        upcoming.scheduled_at,
        room.timezone,
        user?.timezone,
        i18n.language,
        t,
      )
    : null;

  const whatsappMessage = useMemo(() => {
    if (!shareUrl) return "";
    const nextSessionLine = dateLabel
      ? t("invite.whatsappNextSession", { date: dateLabel })
      : "";
    return t("invite.whatsappMessage", {
      halaqahName: room.name,
      nextSessionLine,
      link: shareUrl,
    });
  }, [shareUrl, dateLabel, room.name, t]);

  useEffect(() => {
    if (!open) {
      autoCreateTriggeredRef.current = false;
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (linksQuery.isPending) return;
    if (hasActiveLink) return;
    if (createMutation.isPending || autoCreateInFlight.has(key)) return;
    if (autoCreateTriggeredRef.current) return;
    autoCreateTriggeredRef.current = true;
    autoCreateInFlight.add(key);
    void createMutation
      .mutateAsync({})
      .catch(() => {
        autoCreateTriggeredRef.current = false;
      })
      .finally(() => {
        autoCreateInFlight.delete(key);
      });
  }, [open, linksQuery.isPending, hasActiveLink, createMutation, key]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!shareUrl) return;
    await copyShareUrl(shareUrl);
    setCopied(true);
  }

  function handleWhatsApp() {
    if (!whatsappMessage) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const preparing =
    open &&
    !activeLink &&
    !linksQuery.isPending &&
    (createMutation.isPending || autoCreateInFlight.has(key));

  const showPendingHint = room.is_public && room.requires_approval;

  return (
    <Modal open={open} onClose={onClose} title={t("invite.inviteStudents")} contentClassName="max-w-md">
      {linksQuery.isPending || preparing ? (
        <div className="flex items-center gap-3 py-8 text-sm text-[var(--color-text-muted)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)]" />
          {t("share.preparing")}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-2">
            <label htmlFor={`invite-share-url-${room.id}`} className="sr-only">
              {t("invite.copyLink")}
            </label>
            <InputControl
              id={`invite-share-url-${room.id}`}
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!shareUrl}
              onClick={() => void handleCopy()}
              className="shrink-0"
            >
              <span className="inline-flex items-center gap-1.5">
                {copied ? <Check className="size-4 text-[var(--color-primary)]" /> : <Copy className="size-4" />}
                {copied ? t("invite.linkCopied") : t("invite.copyLink")}
              </span>
            </Button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!shareUrl}
            className="bg-[#25D366] text-white hover:bg-[#1EBE57]"
            onClick={handleWhatsApp}
          >
            <span className="inline-flex items-center gap-2">
              <WhatsAppIcon className="size-5" />
              {t("invite.shareWhatsapp")}
            </span>
          </Button>

          <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
            {t("invite.howItWorks")}
          </p>

          {showPendingHint ? (
            <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
              {t("invite.pendingRequests", { count: room.pending_count })}
            </p>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
