// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, Mail, QrCode, Share2 } from "lucide-react";
import type { Room, RoomFirstSession } from "../../types";
import { Button } from "../ui/Button";
import { InputControl } from "../ui/Input";
import { InviteStudentsModal } from "./InviteStudentsModal";
import {
  findActiveShareLink,
  findPrimaryShareLink,
  useCreateShareLink,
  useShareLinks,
} from "../../data/share";
import {
  cardImageUrl,
  canNativeShare,
  copyShareUrl,
  downloadPng,
  nativeShareText,
  openEmailShare,
  openTelegramShare,
  openWhatsAppShare,
  shareOrDownloadPng,
  shareTeaserUrl,
} from "../../lib/shareIntents";
import { formatSessionMecca } from "../../lib/meccaTime";
import { cn } from "@/lib/utils";

const autoCreateInFlight = new Set<string>();

function shareAutoCreateKey(roomId: string): string {
  return `halaqah:${roomId}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export interface ShareCardProps {
  roomId: string;
  roomName: string;
  room?: Room | null;
  firstSession?: RoomFirstSession | null;
  shareToken?: string | null;
  variant: "full" | "compact";
  hideTitle?: boolean;
  className?: string;
}

export function ShareCard({
  roomId,
  roomName,
  room,
  firstSession,
  shareToken: shareTokenProp,
  variant,
  hideTitle = false,
  className,
}: ShareCardProps) {
  const { t, i18n } = useTranslation();
  const linksQuery = useShareLinks("halaqah", roomId, true);
  const createMutation = useCreateShareLink("halaqah", roomId);
  const activeLink = useMemo(() => findPrimaryShareLink(linksQuery.data), [linksQuery.data]);
  const hasActiveLink = useMemo(() => !!findActiveShareLink(linksQuery.data), [linksQuery.data]);
  const autoKey = shareAutoCreateKey(roomId);
  const autoCreateTriggeredRef = useRef(false);

  const [copied, setCopied] = useState(false);
  const [cardFormat, setCardFormat] = useState<"square" | "story">("square");
  const [inviteOpen, setInviteOpen] = useState(false);

  const token = activeLink?.token ?? shareTokenProp ?? null;
  const shareUrl = activeLink?.share_url ?? (token ? shareTeaserUrl(token) : "");

  const dateLabel = firstSession
    ? formatSessionMecca(firstSession.scheduled_at, i18n.language)
    : null;

  const typeLabel = room?.halaqah_type
    ? t(`rooms.halaqah${room.halaqah_type.charAt(0).toUpperCase()}${room.halaqah_type.slice(1)}`, {
        defaultValue: room.halaqah_type,
      })
    : "";
  const riwayaLabel = room?.riwaya
    ? t(`mushaf.${room.riwaya}`, { defaultValue: room.riwaya })
    : "";

  const inviteMessage = dateLabel
    ? t("share.inviteMessageDated", {
        name: roomName,
        type: typeLabel,
        riwaya: riwayaLabel,
        date: dateLabel,
      })
    : t("share.inviteMessage", { name: roomName });

  useEffect(() => {
    if (linksQuery.isPending) return;
    if (hasActiveLink) return;
    if (createMutation.isPending || autoCreateInFlight.has(autoKey)) return;
    if (autoCreateTriggeredRef.current) return;
    autoCreateTriggeredRef.current = true;
    autoCreateInFlight.add(autoKey);
    void createMutation
      .mutateAsync({})
      .catch(() => {
        autoCreateTriggeredRef.current = false;
      })
      .finally(() => {
        autoCreateInFlight.delete(autoKey);
      });
  }, [linksQuery.isPending, hasActiveLink, createMutation, autoKey]);

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

  const pngUrl = token ? cardImageUrl(token, cardFormat) : "";
  const joined = room?.enrolled_count ?? activeLink?.join_count ?? 0;
  const max = room?.max_students ?? 0;
  const visits = activeLink?.use_count ?? 0;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[var(--color-surface)] px-4 py-3",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{t("share.stats", { joined, max, visits })}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!shareUrl}
            onClick={() => openWhatsAppShare(inviteMessage, shareUrl)}
          >
            <span className="inline-flex items-center gap-1.5">
              <WhatsAppIcon className="size-4" />
              {t("share.whatsapp")}
            </span>
          </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!shareUrl}
              onClick={() => void handleCopy()}
              aria-label={copied ? t("share.copied") : t("share.copy")}
            >
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </Button>
          {token ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(cardImageUrl(token, "square"), "_blank", "noopener,noreferrer")}
            >
              {t("share.card")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const preparing =
    !activeLink &&
    !linksQuery.isPending &&
    (createMutation.isPending || autoCreateInFlight.has(autoKey));

  const sessionLine = dateLabel
    ? `${t("share.firstSession", { date: dateLabel })} · ${t("share.meccaTime")}`
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl bg-[var(--color-surface)] p-6 shadow-sm",
        className,
      )}
    >
      {linksQuery.isPending || preparing ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          {t("share.preparing")}
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Preview column — first on mobile; start side on md+ */}
          <div className="order-1 flex w-full shrink-0 flex-col gap-3 md:order-none md:max-w-[320px]">
            <div
              className="inline-flex h-11 w-full overflow-hidden rounded-lg border-2 border-primary"
              role="group"
              aria-label={t("share.card")}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-full flex-1 items-center justify-center gap-2 rounded-none border-0 px-3 text-sm font-medium transition-colors",
                  cardFormat === "square"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-primary hover:bg-primary/5",
                )}
                onClick={() => setCardFormat("square")}
                aria-pressed={cardFormat === "square"}
              >
                <span
                  className={cn(
                    "size-3.5 shrink-0 rounded-[2px] border-2",
                    cardFormat === "square" ? "border-primary-foreground" : "border-primary",
                  )}
                  aria-hidden
                />
                {t("share.cardSquare")}
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex h-full flex-1 items-center justify-center gap-2 rounded-none border-0 border-s-2 border-s-primary px-3 text-sm font-medium transition-colors",
                  cardFormat === "story"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-primary hover:bg-primary/5",
                )}
                onClick={() => setCardFormat("story")}
                aria-pressed={cardFormat === "story"}
              >
                <span
                  className={cn(
                    "h-4 w-2.5 shrink-0 rounded-[2px] border-2",
                    cardFormat === "story" ? "border-primary-foreground" : "border-primary",
                  )}
                  aria-hidden
                />
                {t("share.cardStory")}
              </button>
            </div>

            {token ? (
              <div className="overflow-hidden rounded-xl shadow-md">
                <img src={pngUrl} alt="" className="w-full bg-[#FDF6E3]" />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={!token}
                onClick={() =>
                  token &&
                  void shareOrDownloadPng({
                    pngUrl,
                    filename: `halaqah-${cardFormat}.png`,
                    text: `${inviteMessage} ${shareUrl}`,
                    title: roomName,
                  })
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <Share2 className="size-4" />
                  {t("share.shareImage")}
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={!token}
                onClick={() => token && downloadPng(pngUrl, `halaqah-${cardFormat}.png`)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Download className="size-4" />
                  {t("share.downloadPng")}
                </span>
              </Button>
            </div>
          </div>

          {/* Actions column */}
          <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 md:order-none">
            {!hideTitle ? (
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("wizard.shareTitle")}</h2>
                {sessionLine ? (
                  <p className="mt-1 text-sm text-muted-foreground">{sessionLine}</p>
                ) : null}
              </div>
            ) : sessionLine ? (
              <p className="text-sm text-muted-foreground">{sessionLine}</p>
            ) : null}

            <div className="flex gap-2">
              <label htmlFor={`share-url-${roomId}`} className="sr-only">
                {t("share.copy")}
              </label>
              <InputControl
                id={`share-url-${roomId}`}
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={!shareUrl}
                onClick={() => void handleCopy()}
                className="shrink-0"
              >
                <span className="inline-flex items-center gap-1.5">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? t("share.copied") : t("share.copy")}
                </span>
              </Button>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!shareUrl}
              onClick={() => openWhatsAppShare(inviteMessage, shareUrl)}
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="size-5" />
                {t("share.whatsapp")}
              </span>
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={!shareUrl}
                onClick={() => openTelegramShare(inviteMessage, shareUrl)}
              >
                {t("share.telegram")}
              </Button>
              {canNativeShare() ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  disabled={!shareUrl}
                  onClick={() =>
                    void nativeShareText({
                      title: t("common.appName"),
                      text: inviteMessage,
                      url: shareUrl,
                    })
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Share2 className="size-4" />
                    {t("share.nativeShare")}
                  </span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={!shareUrl}
                onClick={() => openEmailShare(t("common.appName"), inviteMessage, shareUrl)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-4" />
                  {t("share.email")}
                </span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="default"
                onClick={() => setInviteOpen(true)}
              >
                {t("share.inviteByEmail")}
              </Button>
              {token ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  onClick={() =>
                    window.open(cardImageUrl(token, "square"), "_blank", "noopener,noreferrer")
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <QrCode className="size-4" />
                    {t("share.qrOnly")}
                  </span>
                </Button>
              ) : null}
            </div>

            <p className="line-clamp-3 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {inviteMessage} {shareUrl}
            </p>
          </div>
        </div>
      )}

      <InviteStudentsModal open={inviteOpen} onClose={() => setInviteOpen(false)} roomId={roomId} />
    </div>
  );
}
