// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChartCard } from "../../components/admin/ChartCard";
import { KpiCard } from "../../components/admin/KpiCard";
import { Bars, Donut, Trend, formatLatinNumber, gradeColors, palette, severityColors } from "../../components/admin/charts";
import { PageShell } from "../../components/layout/PageShell";
import { PageCard } from "../../components/layout/PageCard";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  useAdminDashboard,
  type DashboardRangeDays,
} from "../../data/admin";
import { getCountryName } from "../../data/countries";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { getSurahName } from "../../lib/quranService";

function flagEmoji(code: string): string {
  if (!code || code === "unknown" || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 127397 + c.charCodeAt(0)));
}

const genderColorMap: Record<string, string> = {
  male: palette.primary,
  female: palette.gold,
  unknown: palette.muted,
};

const loginColorMap: Record<string, string> = {
  password: palette.primary,
  google: palette.gold,
  both: palette.primaryLight,
};

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<DashboardRangeDays>(90);
  const locale = intlLocaleForAppLanguage(i18n.language);
  const isRtl = i18n.dir() === "rtl";
  const query = useAdminDashboard(days);
  const data = query.data;
  const loading = query.isPending && !data;

  const updatedAt = useMemo(() => {
    if (!data?.generated_at) return null;
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.generated_at));
    } catch {
      return data.generated_at;
    }
  }, [data?.generated_at, locale]);

  const genderDonut = useMemo(() => {
    if (!data) return [];
    return data.demographics.gender.map((g) => ({
      key: g.gender,
      name: t(`admin.dashboard.demo.${g.gender}`),
      value: g.students + g.teachers,
    }));
  }, [data, t]);

  const genderChips = useMemo(() => {
    if (!data) return [];
    const order = ["male", "female", "unknown"] as const;
    const map = new Map(data.demographics.gender.map((g) => [g.gender, g]));
    return order.map((key) => {
      const row = map.get(key);
      const n = (row?.students ?? 0) + (row?.teachers ?? 0);
      return { key, label: t(`admin.dashboard.demo.${key}`), n };
    });
  }, [data, t]);

  const ageBars = useMemo(() => {
    if (!data) return [];
    const order = [
      "under_12",
      "12_17",
      "18_24",
      "25_34",
      "35_44",
      "45_54",
      "55_plus",
      "unknown",
    ];
    const map = new Map(data.demographics.age_buckets.map((b) => [b.bucket, b]));
    return order.map((bucket) => {
      const row = map.get(bucket);
      return {
        bucket: t(`admin.dashboard.demo.age.${bucket}`),
        students: row?.students ?? 0,
        teachers: row?.teachers ?? 0,
      };
    });
  }, [data, t]);

  const countryDonut = useMemo(() => {
    if (!data) return [];
    return data.demographics.countries.map((c) => {
      const name =
        c.country_code === "unknown"
          ? t("admin.dashboard.demo.unknown")
          : `${flagEmoji(c.country_code)} ${getCountryName(c.country_code, locale)}`.trim();
      return { key: c.country_code, name, value: c.users };
    });
  }, [data, locale, t]);

  const loginDonut = useMemo(() => {
    if (!data) return [];
    return data.demographics.login_method.map((m) => ({
      key: m.method,
      name: t(`admin.dashboard.demo.method.${m.method}`),
      value: m.count,
    }));
  }, [data, t]);

  const typeDonut = useMemo(() => {
    if (!data) return [];
    return data.halaqat.by_type.map((r) => ({
      key: r.halaqah_type,
      name: t(
        `rooms.halaqah${r.halaqah_type.charAt(0).toUpperCase()}${r.halaqah_type.slice(1)}`,
      ),
      value: r.count,
    }));
  }, [data, t]);

  const riwayaDonut = useMemo(() => {
    if (!data) return [];
    return data.halaqat.by_riwaya.map((r) => ({
      key: r.riwaya,
      name: t(`mushaf.${r.riwaya}`, { defaultValue: r.riwaya }),
      value: r.count,
    }));
  }, [data, t]);

  const enrollmentDonut = useMemo(() => {
    if (!data) return [];
    return data.halaqat.by_enrollment_mode.map((r) => ({
      key: r.mode,
      name: t(`admin.dashboard.halaqat.enrollment.${r.mode}`, { defaultValue: r.mode }),
      value: r.count,
    }));
  }, [data, t]);

  const gradeBars = useMemo(() => {
    if (!data) return [];
    return data.teaching.grade_distribution.map((g) => ({
      grade: t(`sessions.grade_${g.grade}`),
      count: g.count,
      color: gradeColors[g.grade] ?? palette.muted,
    }));
  }, [data, t]);

  const turnBars = useMemo(() => {
    if (!data) return [];
    return data.teaching.turn_type.map((r) => ({
      turn: t(`sessions.tab_${r.turn_type}`),
      count: r.count,
    }));
  }, [data, t]);

  const errorBars = useMemo(() => {
    if (!data) return [];
    return data.teaching.annotation_categories.map((r) => {
      const full = `${t(`error.${r.category}`, { defaultValue: r.category })} (${t(`annotation.severity.${r.severity}`)})`;
      return {
        label: full,
        count: r.count,
        color: severityColors[r.severity] ?? palette.muted,
      };
    });
  }, [data, t]);

  const surahBars = useMemo(() => {
    if (!data) return [];
    return data.teaching.top_surahs.map((r) => ({
      label: getSurahName(r.surah, i18n.language),
      count: r.count,
    }));
  }, [data, i18n.language]);

  const fillRows = data?.halaqat.fill_rate.slice(0, 6) ?? [];

  if (query.isError) {
    return (
      <PageShell
        breadcrumb={[
          { label: t("nav.home"), to: "/" },
          { label: t("admin.dashboard.title") },
        ]}
        title={t("admin.dashboard.title")}
      >
        <PageCard className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[var(--color-text-muted)]">{t("admin.dashboard.error")}</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            {t("admin.dashboard.retry")}
          </Button>
        </PageCard>
      </PageShell>
    );
  }

  const totals = data?.totals;
  const activity = data?.activity;
  const newUsers30 = activity?.new_users_30d ?? 0;

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("admin.dashboard.title") },
      ]}
      title={t("admin.dashboard.title")}
      description={
        updatedAt ? `${t("admin.dashboard.updated_at")}: ${updatedAt}` : undefined
      }
      actions={
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as DashboardRangeDays)}>
          <TabsList className="w-auto min-w-[14rem]">
            <TabsTrigger value="30">{t("admin.dashboard.range.30")}</TabsTrigger>
            <TabsTrigger value="90">{t("admin.dashboard.range.90")}</TabsTrigger>
            <TabsTrigger value="365">{t("admin.dashboard.range.365")}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      contentClassName="flex flex-col gap-6"
    >
      {/* Two rows of KPI cards, then chart sections */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[5.5rem] w-full rounded-2xl" />
          ))}
        </div>
      ) : totals && activity ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label={t("admin.dashboard.kpi.users")}
            value={formatLatinNumber(totals.users, 0)}
            delta={
              newUsers30 > 0
                ? `+${formatLatinNumber(newUsers30, 0)} · ${t("admin.dashboard.kpi.delta_30d")}`
                : `0 · ${t("admin.dashboard.kpi.delta_30d")}`
            }
            deltaPositive={newUsers30 > 0}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.students")}
            value={formatLatinNumber(totals.students, 0)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.teachers")}
            value={formatLatinNumber(totals.teachers, 0)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.rooms_active")}
            value={formatLatinNumber(totals.rooms_active, 0)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.sessions_completed")}
            value={formatLatinNumber(totals.sessions_completed, 0)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.recitations")}
            value={formatLatinNumber(totals.recitations, 0)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.pages")}
            value={formatLatinNumber(totals.pages_recited, 1)}
          />
          <KpiCard
            label={t("admin.dashboard.kpi.annotations_open")}
            value={formatLatinNumber(totals.annotations_open, 0)}
          />
        </div>
      ) : null}

      {/* Demographics — 2×2 chart cards, no tabs */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {t("admin.dashboard.demo.title")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard title={t("admin.dashboard.tabs.gender")} loading={loading}>
            <div className="space-y-3">
              <Donut data={genderDonut} height={180} colorMap={genderColorMap} />
              <div className="flex flex-wrap gap-2">
                {genderChips.map((c) => (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#F3F4F6] bg-[#FAFAF5] px-3 py-1 text-xs text-[var(--color-text)]"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: genderColorMap[c.key] ?? palette.muted }}
                      aria-hidden
                    />
                    {c.label}{" "}
                    <span className="tabular-nums font-semibold">{formatLatinNumber(c.n, 0)}</span>
                  </span>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.age")} loading={loading}>
            <Bars
              data={ageBars}
              categoryKey="bucket"
              series={[
                { dataKey: "students", name: t("admin.dashboard.kpi.students"), color: palette.primary },
                { dataKey: "teachers", name: t("admin.dashboard.kpi.teachers"), color: palette.gold },
              ]}
              isRtl={isRtl}
            />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.countries")} loading={loading}>
            <Donut data={countryDonut} height={180} />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.login")} loading={loading}>
            <Donut data={loginDonut} height={180} colorMap={loginColorMap} />
          </ChartCard>
        </div>
      </section>

      {/* Halaqat — 2×2 chart cards */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {t("admin.dashboard.halaqat.title")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard title={t("admin.dashboard.halaqat.fill_rate")} loading={loading}>
            {fillRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t("admin.dashboard.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {fillRows.map((row) => {
                  const pct =
                    row.max_students > 0
                      ? Math.min(100, Math.round((row.enrolled / row.max_students) * 100))
                      : 0;
                  return (
                    <div key={row.room_id}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-[var(--color-text)]">{row.name}</span>
                        <span className="text-[var(--color-text-muted)]">
                          {row.teacher_name} · {row.enrolled}/{row.max_students}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: palette.primary }}
                        />
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/rooms"
                  className="inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {t("admin.dashboard.view_all")}
                </Link>
              </div>
            )}
          </ChartCard>

          <ChartCard title={t("admin.dashboard.halaqat.by_type")} loading={loading}>
            <Donut data={typeDonut} height={180} />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.halaqat.by_riwaya")} loading={loading}>
            <Donut data={riwayaDonut} height={180} />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.halaqat.by_enrollment")} loading={loading}>
            <Donut data={enrollmentDonut} height={180} />
          </ChartCard>
        </div>
      </section>

      {/* Teaching — 2×2 chart cards, no tabs */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {t("admin.dashboard.teaching.title")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard title={t("admin.dashboard.tabs.grades")} loading={loading}>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
                  {t("admin.dashboard.teaching.grades")}
                </p>
                <Bars
                  data={gradeBars}
                  categoryKey="grade"
                  series={[{ dataKey: "count", name: t("admin.dashboard.kpi.recitations") }]}
                  cellColors={gradeBars.map((g) => g.color)}
                  isRtl={isRtl}
                  height={200}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
                  {t("admin.dashboard.teaching.turn_type")}
                </p>
                <Bars
                  data={turnBars}
                  categoryKey="turn"
                  series={[
                    {
                      dataKey: "count",
                      name: t("admin.dashboard.kpi.recitations"),
                      color: palette.primary,
                    },
                  ]}
                  isRtl={isRtl}
                  height={160}
                />
              </div>
            </div>
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.errors")} loading={loading}>
            <Bars
              data={errorBars}
              categoryKey="label"
              layout="horizontal"
              series={[{ dataKey: "count", name: t("admin.dashboard.tabs.errors") }]}
              cellColors={errorBars.map((e) => e.color)}
              isRtl={isRtl}
            />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.surahs")} loading={loading}>
            <Bars
              data={surahBars}
              categoryKey="label"
              layout="horizontal"
              series={[
                {
                  dataKey: "count",
                  name: t("admin.dashboard.kpi.recitations"),
                  color: palette.gold,
                },
              ]}
              isRtl={isRtl}
            />
          </ChartCard>

          <ChartCard title={t("admin.dashboard.tabs.teachers")} loading={loading}>
            {(data?.teaching.top_teachers.length ?? 0) === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                {t("admin.dashboard.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F4F6] text-start text-[var(--color-text-muted)]">
                      <th className="py-2 pe-3 font-medium">{t("users.name")}</th>
                      <th className="py-2 pe-3 font-medium">
                        {t("admin.dashboard.teachers.sessions")}
                      </th>
                      <th className="py-2 pe-3 font-medium">
                        {t("admin.dashboard.kpi.recitations")}
                      </th>
                      <th className="py-2 font-medium">{t("admin.dashboard.kpi.students")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.teaching.top_teachers ?? []).map((row) => (
                      <tr key={row.teacher_id} className="border-b border-[#F3F4F6]/60">
                        <td className="py-2.5 pe-3">
                          <div className="font-medium text-[var(--color-text)]">{row.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{row.email}</div>
                        </td>
                        <td className="py-2.5 pe-3 tabular-nums">{row.sessions}</td>
                        <td className="py-2.5 pe-3 tabular-nums">{row.recitations}</td>
                        <td className="py-2.5 tabular-nums">{row.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      </section>

      {/* Trends — 2×2 chart cards, no tabs */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {t("admin.dashboard.series.title")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard
            title={t("admin.dashboard.tabs.signups")}
            loading={loading}
            emptyHeight={220}
          >
            <Trend
              data={data?.timeseries.signups ?? []}
              locale={locale}
              isRtl={isRtl}
              height={220}
              series={[
                {
                  dataKey: "students",
                  name: t("admin.dashboard.kpi.students"),
                  color: palette.primary,
                },
                {
                  dataKey: "teachers",
                  name: t("admin.dashboard.kpi.teachers"),
                  color: palette.gold,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={t("admin.dashboard.tabs.sessions")}
            loading={loading}
            emptyHeight={220}
          >
            <Trend
              data={data?.timeseries.sessions ?? []}
              locale={locale}
              isRtl={isRtl}
              height={220}
              series={[
                {
                  dataKey: "completed",
                  name: t("admin.dashboard.kpi.sessions_completed"),
                  color: palette.primary,
                },
                {
                  dataKey: "cancelled",
                  name: t("sessions.cancelled"),
                  color: severityColors.jali,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={t("admin.dashboard.tabs.recitations")}
            loading={loading}
            emptyHeight={220}
          >
            <Trend
              data={data?.timeseries.recitations ?? []}
              locale={locale}
              isRtl={isRtl}
              height={220}
              stacked={false}
              series={[
                {
                  dataKey: "count",
                  name: t("admin.dashboard.kpi.recitations"),
                  color: palette.primary,
                  lineOnly: true,
                },
                {
                  dataKey: "pages",
                  name: t("admin.dashboard.kpi.pages"),
                  color: palette.gold,
                  lineOnly: true,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={t("admin.dashboard.tabs.annotations")}
            loading={loading}
            emptyHeight={220}
          >
            <Trend
              data={data?.timeseries.annotations ?? []}
              locale={locale}
              isRtl={isRtl}
              height={220}
              series={[
                {
                  dataKey: "count",
                  name: t("admin.dashboard.tabs.annotations"),
                  color: palette.primary,
                },
              ]}
            />
          </ChartCard>
        </div>
      </section>
    </PageShell>
  );
}
