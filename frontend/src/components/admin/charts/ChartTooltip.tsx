// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { palette } from "./chartTheme";

export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  /** Optional full label when axis tick is truncated. */
  fullLabel?: string;
}

export function ChartTooltip({ active, payload, label, fullLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const title = fullLabel ?? label;
  return (
    <div
      className="rounded-lg bg-white px-3 py-2 text-xs shadow-md"
      style={{ border: `1px solid ${palette.border}` }}
    >
      {title ? (
        <p className="mb-1.5 font-semibold text-[var(--color-text)]">{title}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-[var(--color-text)]">
            <span
              className="inline-block size-2.5 shrink-0 rounded-sm"
              style={{ background: p.color ?? palette.primary }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="tabular-nums font-medium">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
