// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Hand, Highlighter, MousePointer2, PenLine, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type SessionToolId = "hand" | "annotate" | "pen" | "highlighter";

interface SessionToolRailProps {
  activeTool: SessionToolId;
  onToolChange: (tool: SessionToolId) => void;
  /** When false, annotation tool is hidden (students). */
  canAnnotate?: boolean;
  /** When true, annotate stays visible but disabled (e.g. board mode). */
  annotateDisabled?: boolean;
  annotateDisabledTitle?: string;
  /** Teacher drawing tools + undo/clear. */
  canDraw?: boolean;
  onUndo?: () => void;
  onClearAll?: () => void;
  className?: string;
}

/**
 * Desktop-only vertical tool rail (inline-start of the live stage).
 * Tooltips use the app-level Shadcn {@link TooltipProvider}.
 */
export function SessionToolRail({
  activeTool,
  onToolChange,
  canAnnotate = true,
  annotateDisabled = false,
  annotateDisabledTitle,
  canDraw = false,
  onUndo,
  onClearAll,
  className,
}: SessionToolRailProps) {
  const { t, i18n } = useTranslation();
  /** Open toward the page (away from the start-edge rail). */
  const tipSide = i18n.dir() === "rtl" ? "left" : "right";

  return (
    <nav
      className={cn(
        "pointer-events-auto absolute top-7 z-20 hidden flex-col gap-1 rounded-[14px] border border-[rgba(15,23,42,0.10)] bg-white p-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.06)] md:flex",
        "inset-inline-start-[22px]",
        className,
      )}
      aria-label={t("liveSession.tools.rail")}
    >
      <ToolButton
        active={activeTool === "hand"}
        label={t("liveSession.tools.hand")}
        tipSide={tipSide}
        onClick={() => onToolChange("hand")}
      >
        <Hand className="size-[18px]" strokeWidth={2} aria-hidden />
      </ToolButton>

      {canDraw ? (
        <>
          <ToolButton
            active={activeTool === "pen"}
            label={t("liveSession.tools.pen")}
            tipSide={tipSide}
            onClick={() => onToolChange("pen")}
          >
            <PenLine className="size-[18px]" strokeWidth={2} aria-hidden />
          </ToolButton>
          <ToolButton
            active={activeTool === "highlighter"}
            label={t("liveSession.tools.highlighter")}
            tipSide={tipSide}
            onClick={() => onToolChange("highlighter")}
          >
            <Highlighter className="size-[18px]" strokeWidth={2} aria-hidden />
          </ToolButton>
        </>
      ) : null}

      {canAnnotate ? (
        <>
          <div className="mx-1.5 my-0.5 h-px bg-[rgba(15,23,42,0.10)]" aria-hidden />
          <ToolButton
            active={activeTool === "annotate" && !annotateDisabled}
            label={
              annotateDisabled
                ? (annotateDisabledTitle ?? t("liveSession.board.annotateUnavailable"))
                : t("liveSession.tools.annotate")
            }
            tipSide={tipSide}
            disabled={annotateDisabled}
            onClick={() => onToolChange("annotate")}
          >
            <MousePointer2 className="size-[18px]" strokeWidth={2} aria-hidden />
          </ToolButton>
        </>
      ) : null}

      {canDraw ? (
        <>
          <div className="mx-1.5 my-0.5 h-px bg-[rgba(15,23,42,0.10)]" aria-hidden />
          <ToolButton
            active={false}
            label={t("liveSession.tools.undo")}
            tipSide={tipSide}
            onClick={() => onUndo?.()}
          >
            <RotateCcw className="size-[18px]" strokeWidth={2} aria-hidden />
          </ToolButton>
          <ToolButton
            active={false}
            label={t("liveSession.tools.clearAll")}
            tipSide={tipSide}
            danger
            onClick={() => onClearAll?.()}
          >
            <Trash2 className="size-[18px]" strokeWidth={2} aria-hidden />
          </ToolButton>
        </>
      ) : null}
    </nav>
  );
}

function ToolButton({
  active,
  label,
  tipSide,
  onClick,
  disabled,
  danger,
  children,
}: {
  active: boolean;
  label: string;
  tipSide: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center rounded-[10px] border-0 transition-colors",
        disabled
          ? "cursor-not-allowed bg-transparent text-[#c7cbc1] opacity-60"
          : active
            ? "bg-[rgba(27,94,32,0.10)] text-[#1B5E20]"
            : danger
              ? "bg-transparent text-[#6B7280] hover:bg-[rgba(239,83,80,0.12)] hover:text-[#EF5350]"
              : "bg-transparent text-[#6B7280] hover:bg-[#f1f3ee] hover:text-[#1A1A1A]",
      )}
    >
      {children}
    </button>
  );

  return (
    <Tooltip>
      {/* Disabled buttons don't fire pointer events — wrap so the tooltip still opens. */}
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent side={tipSide} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
