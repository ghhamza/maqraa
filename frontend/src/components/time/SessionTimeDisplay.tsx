// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { formatSessionTime } from "../../lib/sessionTime";
import { cn } from "@/lib/utils";

export interface SessionTimeDisplayProps {
  scheduledAt: string;
  roomTz: string;
  userTz?: string | null;
  className?: string;
  primaryClassName?: string;
  /** Show room-tz city label after primary (share surfaces). Default false. */
  showRoomLabel?: boolean;
}

/** Primary room-tz time + muted "بتوقيتك" when the viewer's zone differs. */
export function SessionTimeDisplay({
  scheduledAt,
  roomTz,
  userTz,
  className,
  primaryClassName,
  showRoomLabel = false,
}: SessionTimeDisplayProps) {
  const { t, i18n } = useTranslation();
  const f = formatSessionTime(scheduledAt, roomTz, userTz, i18n.language);

  return (
    <span className={cn("inline-flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2", className)}>
      <span className={primaryClassName}>
        {f.primary}
        {showRoomLabel ? (
          <span className="text-[var(--color-text-muted)]">
            {" · "}
            {t("tz.roomTime", { city: f.city })}
          </span>
        ) : null}
      </span>
      {f.secondaryTime ? (
        <span className="text-xs text-[#6B7280] sm:text-sm">
          {t("tz.yourTime", { time: f.secondaryTime })}
        </span>
      ) : null}
    </span>
  );
}
