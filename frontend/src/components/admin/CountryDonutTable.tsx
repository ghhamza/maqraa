// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Table, type TableColumn } from "../ui/Table";
import { Donut, type DonutSlice } from "./charts/Donut";
import { colorForKey, formatLatinNumber } from "./charts/chartTheme";

interface CountryDonutTableProps {
  data: DonutSlice[];
  loading?: boolean;
}

type CountryRow = DonutSlice & { color: string; pct: number };

/** Interactive countries breakdown: donut + compact table side by side. */
export function CountryDonutTable({ data }: CountryDonutTableProps) {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const highlightKey = pinnedKey ?? activeKey;

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const colorByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      m.set(d.key, colorForKey(d.key, i));
    }
    return m;
  }, [data]);

  const rows = useMemo<CountryRow[]>(() => {
    return [...data]
      .map((d) => ({
        ...d,
        color: colorByKey.get(d.key) ?? colorForKey(d.key, 0),
        pct: total > 0 ? Math.round((d.value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [colorByKey, data, total]);

  const columns = useMemo<TableColumn<CountryRow>[]>(
    () => [
      {
        key: "country",
        header: t("admin.dashboard.tabs.countries"),
        render: (row) => (
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: row.color }}
              aria-hidden
            />
            <span className="truncate font-medium">{row.name}</span>
          </span>
        ),
      },
      {
        key: "users",
        header: t("admin.dashboard.kpi.users"),
        className: "w-16 text-end tabular-nums",
        render: (row) => formatLatinNumber(row.value, 0),
      },
      {
        key: "pct",
        header: "%",
        className: "w-14 text-end tabular-nums text-[var(--color-text-muted)]",
        render: (row) => `${row.pct}%`,
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
      <div className="flex shrink-0 items-center justify-center sm:w-[11.5rem]">
        <Donut
          data={data}
          height={180}
          showLegend={false}
          activeKey={highlightKey}
          onActiveKeyChange={(key) => {
            if (pinnedKey != null) return;
            setActiveKey(key);
          }}
          onSliceClick={(key) => {
            setPinnedKey((prev) => (prev === key ? null : key));
            setActiveKey(key);
          }}
        />
      </div>
      <Table
        variant="plain"
        className="min-h-0 max-h-[14rem] flex-1 overflow-y-auto"
        columns={columns}
        data={rows}
        rowKey={(r) => r.key}
        emptyMessage={t("admin.dashboard.empty")}
        onRowMouseEnter={(row) => {
          if (pinnedKey == null) setActiveKey(row.key);
        }}
        onRowMouseLeave={() => {
          if (pinnedKey == null) setActiveKey(null);
        }}
        onRowClick={(row) => {
          setPinnedKey((prev) => (prev === row.key ? null : row.key));
          setActiveKey(row.key);
        }}
        getRowClassName={(row) =>
          highlightKey === row.key
            ? "bg-[var(--color-primary)]/8 ring-1 ring-inset ring-[var(--color-primary)]/20"
            : highlightKey != null
              ? "opacity-45"
              : undefined
        }
      />
    </div>
  );
}
