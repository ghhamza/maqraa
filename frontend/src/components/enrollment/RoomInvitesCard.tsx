// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, QrCode } from "lucide-react";
import type { Room } from "../../types";
import { PageCard } from "../layout/PageCard";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ShareCard } from "../share/ShareCard";
import {
  findActiveShareLink,
  findPrimaryShareLink,
  useCreateShareLink,
  useShareLinks,
} from "../../data/share";
import { copyShareUrl, shareTeaserUrl } from "../../lib/shareIntents";

const autoCreateInFlight = new Set<string>();

function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `…${url.slice(-(max - 1))}`;
}

export interface RoomInvitesCardProps {
  room: Room;
  onInviteOpen: () => void;
}

/** Compact invitations summary — active link, joins, pending requests. */
export function RoomInvitesCard({ room, onInviteOpen }: RoomInvitesCardProps) {
  const { t } = useTranslation();
  const linksQuery = useShareLinks("halaqah", room.id, true);
  const createMutation = useCreateShareLink("halaqah", room.id);
  const activeLink = useMemo(() => findPrimaryShareLink(linksQuery.data), [linksQuery.data]);
  const hasActiveLink = useMemo(() => !!findActiveShareLink(linksQuery.data), [linksQuery.data]);
  const key = `invites-card:halaqah:${room.id}`;
  const autoCreateTriggeredRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const token = activeLink?.token ?? room.share_token ?? null;
  const shareUrl = activeLink?.share_url ?? (token ? shareTeaserUrl(token) : "");
  const joinCount = activeLink?.join_count ?? 0;

  useEffect(() => {
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
  }, [linksQuery.isPending, hasActiveLink, createMutation, key]);

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

  return (
    <PageCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t("invite.invitesCardTitle")}
          </h2>
          {linksQuery.isPending && !shareUrl ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)]" />
          ) : shareUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code
                className="max-w-full truncate rounded-md bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                title={shareUrl}
              >
                {truncateUrl(shareUrl)}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleCopy()}
                aria-label={copied ? t("invite.linkCopied") : t("invite.copyLink")}
              >
                {copied ? (
                  <Check className="size-4 text-[var(--color-primary)]" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("invite.joinsViaLink", { count: joinCount })}
          </p>
          {room.pending_count > 0 ? (
            <p className="text-sm text-[var(--color-gold)]">
              {t("invite.pendingRequests", { count: room.pending_count })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={onInviteOpen}>
            {t("invite.inviteStudents")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShareCardOpen(true)}>
            <QrCode className="size-4" />
            {t("invite.shareCardButton")}
          </Button>
        </div>
      </div>
      {shareCardOpen ? (
        <Modal
          open={shareCardOpen}
          title={t("invite.shareCardTitle")}
          onClose={() => setShareCardOpen(false)}
          contentClassName="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        >
          <ShareCard
            roomId={room.id}
            roomName={room.name}
            room={room}
            firstSession={room.first_session ?? null}
            shareToken={room.share_token ?? null}
            variant="full"
            hideTitle
          />
        </Modal>
      ) : null}
    </PageCard>
  );
}
