// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Signal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { LivekitConnectionStatus } from "../../hooks/useLivekitConnection";

const DOT: Record<SessionWsStatus, { color: string; key: string }> = {
  connected: { color: "#1B5E20", key: "connected" },
  connecting: { color: "#F57F17", key: "connecting" },
  reconnecting: { color: "#F57F17", key: "reconnecting" },
  disconnected: { color: "#EF5350", key: "disconnected" },
  error: { color: "#EF5350", key: "disconnected" },
};

interface ConnectionStatusProps {
  status: SessionWsStatus;
  livekitStatus?: LivekitConnectionStatus;
  className?: string;
  /** Light text for dark translucent bars (e.g. immersive live session). */
  variant?: "default" | "onDark";
  /** Dot only (no status text). */
  iconsOnly?: boolean;
  /** Mockup ghost pill: signal icon + status label. */
  ghostPill?: boolean;
}

const LIVEKIT_DOT: Record<
  LivekitConnectionStatus,
  { color: string; key: "idle" | "connecting" | "connected" | "disconnected" | "error" }
> = {
  idle: { color: "#9CA3AF", key: "idle" },
  requesting_token: { color: "#D4A843", key: "connecting" },
  connecting: { color: "#D4A843", key: "connecting" },
  connected: { color: "#1B5E20", key: "connected" },
  disconnected: { color: "#6B7280", key: "disconnected" },
  error: { color: "#EF5350", key: "error" },
};

export function ConnectionStatus({
  status,
  livekitStatus,
  className = "",
  variant = "default",
  iconsOnly = false,
  ghostPill = false,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const cfg = DOT[status] ?? DOT.disconnected;
  const livekitCfg = livekitStatus ? LIVEKIT_DOT[livekitStatus] : null;
  const labelKey = `liveSession.${cfg.key}` as const;

  const labelClass =
    variant === "onDark" ? "text-white/80" : "text-[var(--color-text-muted)]";

  if (ghostPill) {
    return (
      <span
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-white px-3 text-[13px] font-medium text-[#6B7280]",
          className,
        )}
        title={t(labelKey)}
      >
        <Signal
          className="size-[15px]"
          strokeWidth={2}
          style={{ color: cfg.color }}
          aria-hidden
        />
        <span className="text-[#1A1A1A]">{t(labelKey)}</span>
      </span>
    );
  }

  if (iconsOnly) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="sr-only">{t(labelKey)}</span>
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cfg.color }}
          aria-hidden
        />
        {livekitCfg ? (
          <>
            <span className="sr-only">{t(`liveSession.audio.${livekitCfg.key}`)}</span>
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: livekitCfg.color }}
              aria-hidden
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span
        className="inline-flex size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: cfg.color }}
        aria-hidden
      />
      <span className={labelClass}>{t(labelKey)}</span>
      {livekitCfg ? (
        <>
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: livekitCfg.color }}
            aria-hidden
          />
          <span className={labelClass}>{t(`liveSession.audio.${livekitCfg.key}`)}</span>
        </>
      ) : null}
    </div>
  );
}
