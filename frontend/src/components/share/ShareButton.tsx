// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Mail, Share2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { BottomSheet } from "../ui/BottomSheet";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  findActiveShareLink,
  findPrimaryShareLink,
  useCreateShareLink,
  useShareLinks,
  type ShareTargetType,
} from "../../data/share";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  targetType: ShareTargetType;
  displayName: string;
  targetId?: string;
  /** When true, panel only shares an existing active link (no auto-create). */
  existingOnly?: boolean;
}

/** Prevents duplicate auto-creates for the same target while a request is in flight. */
const autoCreateInFlight = new Set<string>();

function shareAutoCreateKey(targetType: ShareTargetType, targetId?: string): string {
  return `${targetType}:${targetId ?? ""}`;
}

function useMdUp() {
  const [mdUp, setMdUp] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setMdUp(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mdUp;
}

function ShareIntents({
  shareUrl,
  inviteMessage,
  copied,
  canNativeShare,
  onCopy,
  onWhatsApp,
  onEmail,
  onNativeShare,
}: {
  shareUrl: string;
  inviteMessage: string;
  copied: boolean;
  canNativeShare: boolean;
  onCopy: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onNativeShare: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Input
        label={t("share.copy")}
        readOnly
        value={shareUrl}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => void onCopy()}>
          <span className="inline-flex items-center gap-2">
            {copied ? <Check className="h-4 w-4 text-[#1B5E20]" /> : <Copy className="h-4 w-4" />}
            {copied ? t("share.copied") : t("share.copy")}
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20"
          onClick={onWhatsApp}
        >
          {t("share.whatsapp")}
        </Button>
        {canNativeShare ? (
          <Button type="button" variant="secondary" onClick={() => void onNativeShare()}>
            {t("share.nativeShare")}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onEmail}>
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t("share.email")}
          </span>
        </Button>
      </div>
      <p className="text-xs text-[#6B7280]">{inviteMessage}</p>
    </>
  );
}

function SharePanelContent({
  targetType,
  targetId,
  displayName,
  existingOnly = false,
  open,
  onDone,
}: ShareButtonProps & { open: boolean; onDone?: () => void }) {
  const { t } = useTranslation();
  const linksQuery = useShareLinks(targetType, targetId, open);
  const createMutation = useCreateShareLink(targetType, targetId);
  const activeLink = useMemo(() => findPrimaryShareLink(linksQuery.data), [linksQuery.data]);
  const hasActiveLink = useMemo(() => !!findActiveShareLink(linksQuery.data), [linksQuery.data]);
  const autoKey = shareAutoCreateKey(targetType, targetId);
  const autoCreateTriggeredRef = useRef(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [copied, setCopied] = useState(false);

  const shareUrl = activeLink?.share_url ?? "";
  const inviteMessage =
    targetType === "instance"
      ? t("instanceInvite.subtitle")
      : t("share.inviteMessage", { name: displayName });
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    if (!open) {
      autoCreateTriggeredRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || existingOnly) return;
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
  }, [
    open,
    existingOnly,
    linksQuery.isPending,
    hasActiveLink,
    createMutation,
    autoKey,
  ]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleAdvancedCreate() {
    const payload: { expires_at?: string; max_uses?: number } = {};
    if (expiresAt.trim()) {
      payload.expires_at = new Date(expiresAt).toISOString();
    }
    const parsedMax = maxUses.trim() ? Number.parseInt(maxUses, 10) : undefined;
    if (parsedMax != null && Number.isFinite(parsedMax) && parsedMax > 0) {
      payload.max_uses = parsedMax;
    }
    await createMutation.mutateAsync(payload);
    setAdvancedOpen(false);
    setExpiresAt("");
    setMaxUses("");
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  function openWhatsApp() {
    const text = `${inviteMessage} ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function openEmail() {
    const subject = t("common.appName");
    const body = `${inviteMessage} ${shareUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function handleNativeShare() {
    if (!canNativeShare || !shareUrl) return;
    try {
      await navigator.share({
        title: t("common.appName"),
        text: inviteMessage,
        url: shareUrl,
      });
      onDone?.();
    } catch {
      // user cancelled
    }
  }

  const isAutoCreating =
    !existingOnly &&
    !activeLink &&
    !linksQuery.isPending &&
    (createMutation.isPending || autoCreateInFlight.has(autoKey));

  if (linksQuery.isPending) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
      </div>
    );
  }

  if (existingOnly && !activeLink) {
    return <p className="p-1 text-sm text-[#6B7280]">{t("instanceInvite.noLinks")}</p>;
  }

  if (isAutoCreating) {
    return (
      <div className="flex items-center gap-3 p-1 py-4 text-sm text-[#6B7280]">
        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#1B5E20]/20 border-t-[#1B5E20]" />
        {t("share.preparing")}
      </div>
    );
  }

  if (!activeLink) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <ShareIntents
        shareUrl={shareUrl}
        inviteMessage={inviteMessage}
        copied={copied}
        canNativeShare={canNativeShare}
        onCopy={handleCopy}
        onWhatsApp={openWhatsApp}
        onEmail={openEmail}
        onNativeShare={handleNativeShare}
      />
      {!existingOnly ? (
        <>
          <button
            type="button"
            className="text-sm text-[#6B7280] underline-offset-2 hover:underline"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {t("share.advanced")}
          </button>
          {advancedOpen ? (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <Input
                label={t("share.expiry")}
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <Input
                label={t("share.maxUses")}
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                fullWidth
                loading={createMutation.isPending}
                onClick={() => void handleAdvancedCreate()}
              >
                {t("share.createLink")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ShareButton({
  targetType,
  targetId,
  displayName,
  existingOnly = false,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const mdUp = useMdUp();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button type="button" variant="secondary">
      <span className="inline-flex items-center gap-2">
        <Share2 className="h-4 w-4" />
        {t("share.share")}
      </span>
    </Button>
  );

  const panel = open ? (
    <SharePanelContent
      open={open}
      targetType={targetType}
      targetId={targetId}
      displayName={displayName}
      existingOnly={existingOnly}
      onDone={() => setOpen(false)}
    />
  ) : null;

  if (mdUp) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn("w-80 rounded-xl border-gray-100 bg-white p-4 shadow-md")}
        >
          {panel}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          {t("share.share")}
        </span>
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title={t("share.share")}>
        {panel}
      </BottomSheet>
    </>
  );
}
