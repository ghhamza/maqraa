// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import type { Room, SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { findPrimaryShareLink, useShareLinks } from "../../data/share";
import { trackProductEvent } from "../../data/productEvents";
import { openWhatsAppText, shareTeaserUrl } from "../../lib/shareIntents";
import { formatSessionTimeInviteLine } from "../../lib/sessionTime";
import { useAuthStore } from "../../stores/authStore";
import { sessionDetailPath } from "../../lib/sessionNav";

export interface WhatsAppReminderButtonProps {
  session: SessionPublic;
  room?: Pick<Room, "id" | "name" | "timezone" | "share_token"> | null;
  size?: "sm" | "default" | "lg";
}

function sessionJoinUrl(sessionId: string): string {
  if (typeof window === "undefined") return sessionDetailPath(sessionId);
  return `${window.location.origin}${sessionDetailPath(sessionId)}`;
}

/** Secondary WhatsApp nudge for teachers — never competes with بدء الحصة. */
export function WhatsAppReminderButton({
  session,
  room,
  size = "lg",
}: WhatsAppReminderButtonProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const roomId = room?.id ?? session.room_id;
  const linksQuery = useShareLinks("halaqah", roomId, true);
  const activeLink = useMemo(() => findPrimaryShareLink(linksQuery.data), [linksQuery.data]);

  const link = useMemo(() => {
    const token = activeLink?.token ?? room?.share_token ?? null;
    if (token) return activeLink?.share_url ?? shareTeaserUrl(token);
    return sessionJoinUrl(session.id);
  }, [activeLink, room?.share_token, session.id]);

  const halaqahName = room?.name ?? session.room_name;
  const roomTz = room?.timezone || session.room_timezone || "Asia/Riyadh";

  function handleClick() {
    const when = formatSessionTimeInviteLine(
      session.scheduled_at,
      roomTz,
      user?.timezone,
      i18n.language,
      t,
    );
    const message = t("reminder.whatsappMessage", {
      halaqahName,
      when,
      link,
    });
    void trackProductEvent("reminder_whatsapp_opened");
    openWhatsAppText(message);
  }

  return (
    <Button type="button" variant="secondary" size={size} onClick={handleClick}>
      <span className="inline-flex items-center gap-2">
        <MessageCircle className="size-4" aria-hidden />
        {t("reminder.whatsapp")}
      </span>
    </Button>
  );
}
