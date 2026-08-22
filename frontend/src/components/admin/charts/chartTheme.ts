// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

export const palette = {
  primary: "#1B5E20",
  primaryLight: "#4CAF50",
  gold: "#D4A843",
  goldLight: "#E9D8A6",
  muted: "#9CA3AF",
  grid: "#EEEEE8",
  axis: "#6B7280",
  tooltipCursor: "#F3F4F6",
  border: "#E5E7EB",
} as const;

export const gradeColors: Record<string, string> = {
  excellent: "#1B5E20",
  good: "#4CAF50",
  needs_work: "#F57F17",
  weak: "#EF5350",
};

export const severityColors: Record<string, string> = {
  jali: "#EF5350",
  khafi: "#F57F17",
};

/** Categorical series order: primary → gold → primaryLight → goldLight. muted for unknown only. */
export const seriesColors = [
  palette.primary,
  palette.gold,
  palette.primaryLight,
  palette.goldLight,
] as const;

export const chartFont =
  "'IBM Plex Sans Arabic', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";

export const axisTick = {
  fill: palette.axis,
  fontSize: 12,
  fontFamily: chartFont,
} as const;

export function colorForKey(key: string, index: number): string {
  if (key === "unknown") return palette.muted;
  return seriesColors[index % seriesColors.length] ?? palette.primary;
}

export function truncateLabel(label: string, max = 18): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function formatWeekTick(weekIso: string, locale: string): string {
  const d = new Date(`${weekIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return weekIso;
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
  } catch {
    return weekIso;
  }
}

export function formatLatinNumber(n: number, maxFractionDigits = 1): string {
  try {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits }).format(n);
  } catch {
    return String(n);
  }
}
