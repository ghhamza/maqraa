// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { BookOpen, Presentation } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContentMode } from "../../hooks/useSessionState";

interface ContentModeToggleProps {
  mode: ContentMode;
  onChange: (mode: ContentMode) => void;
  className?: string;
}

/** Teacher segmented control: Mushaf ↔ Board (mockup Mushaf 2). */
export function ContentModeToggle({ mode, onChange, className }: ContentModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex rounded-[11px] border border-[rgba(15,23,42,0.10)] bg-[#eef0ea] p-[3px]",
        className,
      )}
      role="tablist"
      aria-label={t("liveSession.mode.toggle")}
    >
      {/* Mushaf first in DOM → start edge: right in RTL, left in LTR */}
      <ModeSeg
        active={mode === "mushaf"}
        label={t("liveSession.mode.mushaf")}
        tip={t("liveSession.tooltip.modeMushaf")}
        onClick={() => onChange("mushaf")}
      >
        <BookOpen className="size-[15px]" strokeWidth={2} aria-hidden />
      </ModeSeg>
      <ModeSeg
        active={mode === "board"}
        label={t("liveSession.mode.board")}
        tip={t("liveSession.tooltip.modeBoard")}
        onClick={() => onChange("board")}
      >
        <Presentation className="size-[15px]" strokeWidth={2} aria-hidden />
      </ModeSeg>
    </div>
  );
}

function ModeSeg({
  active,
  label,
  tip,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  tip: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="tab"
          aria-selected={active}
          aria-label={tip}
          onClick={onClick}
          className={cn(
            "inline-flex h-[34px] items-center gap-[7px] rounded-[9px] border-0 px-4 text-[13px] font-semibold transition-colors",
            active
              ? "bg-white text-[#1B5E20] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "bg-transparent text-[#6B7280] hover:text-[#1A1A1A]",
          )}
        >
          {children}
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
