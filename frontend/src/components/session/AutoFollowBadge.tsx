// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AutoFollowBadgeProps {
  enabled: boolean;
  onToggle: () => void;
  /** When true, omit fixed corner positioning (immersive live layout bottom stack). */
  inline?: boolean;
  /** Mode-row pill (Mushaf 2 mockup): green tint when following. */
  variant?: "default" | "modePill";
  /**
   * `student` — follow teacher page.
   * `teacher` — whether page changes are broadcast for students to follow.
   */
  role?: "student" | "teacher";
}

/** Toggle following teacher page (student) or broadcasting page sync (teacher). */
export function AutoFollowBadge({
  enabled,
  onToggle,
  inline = false,
  variant = "default",
  role = "student",
}: AutoFollowBadgeProps) {
  const { t } = useTranslation();

  const onLabel =
    role === "teacher" ? t("liveSession.autoFollow.on") : t("liveSession.following");
  const offLabel =
    role === "teacher" ? t("liveSession.autoFollow.off") : t("liveSession.freeBrowse");
  const tip =
    role === "teacher"
      ? t("liveSession.tooltip.pageBroadcastSwitch")
      : t("liveSession.tooltip.autoFollowSwitch");

  if (variant === "modePill") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggle}
            aria-label={tip}
            aria-pressed={enabled}
            className={cn(
              "inline-flex h-[34px] max-w-full items-center gap-2 rounded-[9px] border px-3.5 text-[13px] font-semibold transition-colors",
              enabled
                ? "border-[rgba(27,94,32,0.22)] bg-[rgba(27,94,32,0.07)] text-[#1B5E20]"
                : "border-[rgba(15,23,42,0.10)] bg-white text-[#6B7280]",
            )}
            style={{ fontFamily: "var(--font-ui)" }}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: enabled ? "#1B5E20" : "#9CA3AF" }}
              aria-hidden
            />
            <Link2 className="size-3.5 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
            <span className="min-w-0 truncate">{enabled ? onLabel : offLabel}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-center">
          {tip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={tip}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-xs font-medium shadow-md backdrop-blur-sm",
            inline
              ? "border-white/20 bg-black/50 text-white"
              : "fixed bottom-28 right-4 z-[26] md:bottom-32",
          )}
          style={{ fontFamily: "var(--font-ui)" }}
          aria-pressed={enabled}
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: enabled ? "#1B5E20" : "#6B7280" }}
            aria-hidden
          />
          <span className={inline ? "text-white" : "text-[var(--color-text)]"}>
            {enabled ? onLabel : offLabel}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-xs text-center">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
