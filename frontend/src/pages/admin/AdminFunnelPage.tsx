// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  useAdminFunnel,
  type FunnelRangeDays,
  type FunnelStep,
} from "../../data/admin";
import { formatLatinNumber, palette } from "../../components/admin/charts";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";

function FunnelBars({
  steps,
  isRtl,
  t,
}: {
  steps: FunnelStep[];
  isRtl: boolean;
  t: (key: string) => string;
}) {
  const baseline = steps[0]?.count ?? 0;

  return (
    <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
      {steps.map((step) => {
        const pct = baseline > 0 ? Math.round((step.count / baseline) * 100) : 0;
        const widthPct = baseline > 0 ? Math.max((step.count / baseline) * 100, step.count > 0 ? 4 : 0) : 0;
        return (
          <div key={step.step} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[var(--color-text)]">
                {t(`adminFunnel.steps.${step.step}`)}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                {formatLatinNumber(step.count, 0)}
                {baseline > 0 ? ` · ${formatLatinNumber(pct, 0)}%` : ""}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-md bg-[var(--color-bg)]">
              <div
                className="h-full rounded-md bg-[var(--color-primary)] transition-[width]"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminFunnelPage() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<FunnelRangeDays>(30);
  const locale = intlLocaleForAppLanguage(i18n.language);
  const isRtl = i18n.dir() === "rtl";
  const query = useAdminFunnel(days);
  const data = query.data;
  const loading = query.isPending && !data;

  const trendData = useMemo(() => {
    if (!data) return [];
    return data.wath_trend.map((row) => ({
      week: row.week_start,
      count: row.count,
    }));
  }, [data]);

  if (query.isError && !data) {
    return (
      <PageShell
        breadcrumb={[{ label: t("adminFunnel.title") }]}
        title={t("adminFunnel.title")}
      >
        <p className="text-[var(--color-text-muted)]">{t("admin.dashboard.error")}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void query.refetch()}>
          {t("admin.dashboard.retry")}
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumb={[{ label: t("adminFunnel.title") }]}
      title={t("adminFunnel.title")}
      actions={
        <Tabs
          value={String(days)}
          onValueChange={(v) => setDays(Number(v) as FunnelRangeDays)}
        >
          <TabsList>
            <TabsTrigger value="7">{t("adminFunnel.days.7")}</TabsTrigger>
            <TabsTrigger value="30">{t("adminFunnel.days.30")}</TabsTrigger>
            <TabsTrigger value="90">{t("adminFunnel.days.90")}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--color-text-muted)]">{t("adminFunnel.wathTitle")}</p>
            {loading ? (
              <Skeleton className="mt-2 h-12 w-24" />
            ) : (
              <p className="mt-1 font-[family-name:var(--font-heading)] text-5xl font-semibold tabular-nums text-[var(--color-primary)]">
                {formatLatinNumber(data?.weekly_active_teaching_halaqat ?? 0, 0)}
              </p>
            )}
            <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--color-text-muted)]">
              {t("adminFunnel.wathHint")}
            </p>
          </div>
          <div className="h-36 w-full min-w-0 flex-1 lg:max-w-md">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: palette.muted }}
                    tickFormatter={(v: string) => {
                      try {
                        return new Intl.DateTimeFormat(locale, {
                          month: "short",
                          day: "numeric",
                        }).format(new Date(v));
                      } catch {
                        return v;
                      }
                    }}
                    axisLine={false}
                    tickLine={false}
                    reversed={isRtl}
                  />
                  <YAxis
                    width={28}
                    tick={{ fontSize: 10, fill: palette.muted }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    orientation={isRtl ? "right" : "left"}
                  />
                  <Tooltip
                    formatter={(value) => [formatLatinNumber(Number(value ?? 0), 0), t("adminFunnel.wathTitle")]}
                    labelFormatter={(label) => String(label)}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={palette.primary}
                    strokeWidth={2}
                    dot={{ r: 3, fill: palette.gold }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-lg text-[var(--color-text)]">
            {t("adminFunnel.teacherFunnel")}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <FunnelBars steps={data?.teacher_funnel ?? []} isRtl={isRtl} t={t} />
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-lg text-[var(--color-text)]">
            {t("adminFunnel.studentFunnel")}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <FunnelBars steps={data?.student_funnel ?? []} isRtl={isRtl} t={t} />
          )}
        </section>
      </div>
    </PageShell>
  );
}
