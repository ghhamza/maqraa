// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip } from "./ChartTooltip";
import {
  axisTick,
  chartFont,
  formatWeekTick,
  palette,
  seriesColors,
} from "./chartTheme";

export interface TrendSeries {
  dataKey: string;
  name: string;
  color?: string;
  /** When true, draw as line without fill (multi-metric on one axis). */
  lineOnly?: boolean;
}

interface TrendProps {
  data: Record<string, string | number>[];
  /** ISO week start date field, e.g. "week" */
  xKey?: string;
  series: TrendSeries[];
  height?: number;
  locale: string;
  isRtl?: boolean;
  /** Stack bars/areas when multiple series. Default true for non-lineOnly. */
  stacked?: boolean;
}

export function Trend({
  data,
  xKey = "week",
  series,
  height = 280,
  locale,
  isRtl = false,
  stacked = true,
}: TrendProps) {
  const { t } = useTranslation();
  const empty =
    data.length === 0 ||
    series.every((s) => data.every((row) => !Number(row[s.dataKey])));

  if (empty) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--color-text-muted)]"
        style={{ height, fontFamily: chartFont }}
      >
        {t("admin.dashboard.empty")}
      </div>
    );
  }

  const useBars = data.length <= 12;
  const allLine = series.every((s) => s.lineOnly);

  const legend = (
    <ul className="mb-2 flex flex-wrap gap-3 text-xs">
      {series.map((s, i) => (
        <li key={s.dataKey} className="inline-flex items-center gap-1.5 text-[var(--color-text)]">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: s.color ?? seriesColors[i % seriesColors.length] }}
            aria-hidden
          />
          {s.name}
        </li>
      ))}
    </ul>
  );

  const xAxis = (
    <XAxis
      dataKey={xKey}
      axisLine={false}
      tickLine={false}
      tickMargin={8}
      interval="preserveStartEnd"
      tick={axisTick}
      tickFormatter={(v: string) => formatWeekTick(v, locale)}
    />
  );

  const yAxis = (
    <YAxis
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      width={28}
      tick={axisTick}
      orientation={isRtl ? "right" : "left"}
    />
  );

  const tooltip = (
    <Tooltip
      cursor={{ fill: palette.tooltipCursor }}
      content={({ active, payload, label }) => (
        <ChartTooltip
          active={active}
          payload={payload as never}
          label={typeof label === "string" ? formatWeekTick(label, locale) : undefined}
        />
      )}
    />
  );

  return (
    <div style={{ width: "100%", fontFamily: chartFont }}>
      {legend}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {useBars && !allLine ? (
            <BarChart data={data} barSize={28} barCategoryGap="30%" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              {xAxis}
              {yAxis}
              {tooltip}
              {series.map((s, i) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  stackId={stacked ? "a" : undefined}
                  fill={s.color ?? seriesColors[i % seriesColors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : allLine ? (
            <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              {xAxis}
              {yAxis}
              {tooltip}
              {series.map((s, i) => (
                <Line
                  key={s.dataKey}
                  type="linear"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color ?? seriesColors[i % seriesColors.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              {xAxis}
              {yAxis}
              {tooltip}
              {series.map((s, i) => (
                <Area
                  key={s.dataKey}
                  type="linear"
                  dataKey={s.dataKey}
                  name={s.name}
                  stackId={stacked ? "1" : undefined}
                  stroke={s.color ?? seriesColors[i % seriesColors.length]}
                  fill={s.color ?? seriesColors[i % seriesColors.length]}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
