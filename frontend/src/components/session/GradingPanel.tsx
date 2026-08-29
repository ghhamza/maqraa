// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { RecitationGrade, RecitationPublic } from "../../types";
import type { SessionParticipant } from "../../hooks/useSessionState";
import {
  getAllSurahs,
  getSurahAyahCount,
  getSurahNameWithArabic,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { cn } from "@/lib/utils";
import { FormSelect } from "@/components/ui/select";
import { GradeBadge } from "../recitations/GradeBadge";
import {
  useCompletePlanRecitation,
  useCreateAndGradeRecitation,
  useCreatePlannedTarget,
  useRecitationsFeed,
} from "../../data/recitations";

const GRADE_ORDER: RecitationGrade[] = ["excellent", "good", "needs_work", "weak"];
const GRADE_COLORS: Record<RecitationGrade, string> = {
  excellent: "#1B5E20",
  good: "#4CAF50",
  needs_work: "#F57F17",
  weak: "#EF5350",
};

export interface GradingPanelProps {
  activeReciter: SessionParticipant | null;
  currentAyah: { surah: number; ayah: number } | null;
  highlightRange: { surah: number; ayahStart: number; ayahEnd: number } | null;
  sessionId: string;
  roomId: string;
  riwaya: string;
  locale: string;
  onGradeSubmitted: (studentId: string, grade: string, notes?: string) => void;
  /** Fires after POST /recitations succeeds — use for linking error annotations to a recitation row. */
  onRecitationCreated?: (rec: RecitationPublic) => void;
  /** When set with `gradingMode: "completePlan"`, submit uses POST /recitations/:id/complete. */
  gradingMode?: "create" | "completePlan";
  planToComplete?: RecitationPublic | null;
  onPlanCompleted?: (rec: RecitationPublic) => void;
  /** When the title is shown elsewhere (e.g. Dialog header). */
  hideTitle?: boolean;
  /** Floating dock chrome (Prompt 4). */
  variant?: "inline" | "dock";
  /** Open annotations on the current recitation (homework note). */
  openAnnotationsCount?: number;
  onDismiss?: () => void;
  className?: string;
}

export function GradingPanel({
  activeReciter,
  currentAyah,
  highlightRange,
  sessionId,
  roomId,
  riwaya,
  locale,
  onGradeSubmitted,
  onRecitationCreated,
  gradingMode = "create",
  planToComplete = null,
  onPlanCompleted,
  hideTitle = false,
  variant = "inline",
  openAnnotationsCount = 0,
  onDismiss,
  className,
}: GradingPanelProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const riwayaTyped = riwaya as Riwaya;
  const [surah, setSurah] = useState(() => {
    if (highlightRange) return highlightRange.surah;
    if (currentAyah) return currentAyah.surah;
    return 1;
  });
  const [ayahStart, setAyahStart] = useState(() => {
    if (highlightRange) return highlightRange.ayahStart;
    if (currentAyah) return currentAyah.ayah;
    return 1;
  });
  const [ayahEnd, setAyahEnd] = useState(() => {
    if (highlightRange) return highlightRange.ayahEnd;
    if (currentAyah) return currentAyah.ayah;
    return 1;
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetSurah, setTargetSurah] = useState(1);
  const [targetAyahStart, setTargetAyahStart] = useState(1);
  const [targetAyahEnd, setTargetAyahEnd] = useState(1);
  const [targetOk, setTargetOk] = useState(false);
  const [lastGradedStudentId, setLastGradedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (gradingMode === "completePlan" && planToComplete) {
      setSurah(planToComplete.surah);
      setAyahStart(planToComplete.ayah_start);
      setAyahEnd(planToComplete.ayah_end);
      return;
    }
    if (highlightRange) {
      setSurah(highlightRange.surah);
      setAyahStart(highlightRange.ayahStart);
      setAyahEnd(highlightRange.ayahEnd);
    } else if (currentAyah) {
      setSurah(currentAyah.surah);
      setAyahStart(currentAyah.ayah);
      setAyahEnd(currentAyah.ayah);
    }
  }, [
    gradingMode,
    planToComplete?.surah,
    planToComplete?.ayah_start,
    planToComplete?.ayah_end,
    highlightRange?.surah,
    highlightRange?.ayahStart,
    highlightRange?.ayahEnd,
    currentAyah?.surah,
    currentAyah?.ayah,
  ]);

  const listQuery = useRecitationsFeed("grading-panel", { sessionId, limit: 50, enabled: true });
  const list = listQuery.data ?? [];
  const loading = listQuery.isPending;

  const loadList = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);
  void loadList;

  const surahSelectOptions = useMemo(
    () =>
      getAllSurahs().map((s) => ({
        value: String(s.number),
        label: `${s.number}. ${getSurahNameWithArabic(s.number, locale)}`,
      })),
    [locale],
  );

  /** Same box model as native inputs so the surah select lines up in the grid. */
  const rangeFieldClass =
    "box-border h-9 w-full min-h-9 rounded-lg border border-input bg-background px-2 text-xs leading-none text-foreground shadow-none outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-xs sm:leading-none";
  const surahSelectTriggerClass = rangeFieldClass;
  const surahSelectStyle = { fontFamily: "var(--font-ui)", color: "var(--color-text)" } as const;

  const isCompletePlan = gradingMode === "completePlan" && planToComplete != null;

  const completePlanMutation = useCompletePlanRecitation(
    sessionId,
    async (data) => {
      setNotes("");
      setOkFlash(true);
      window.setTimeout(() => setOkFlash(false), 1800);
      onPlanCompleted?.(data);
      const sid = planToComplete?.student_id ?? activeReciter?.userId;
      if (sid) {
        setLastGradedStudentId(sid);
        onGradeSubmitted(sid, data.grade ?? "good", notes.trim() || undefined);
      }
      // Prefill next target after the graded range.
      const nextStart = Math.min(data.ayah_end + 1, getSurahAyahCount(data.surah, riwayaTyped));
      setTargetSurah(data.surah);
      setTargetAyahStart(nextStart);
      setTargetAyahEnd(nextStart);
      setTargetOpen(false);
      setTargetOk(false);
    },
    (message) => setError(message),
  );

  const createAndGradeMutation = useCreateAndGradeRecitation(
    sessionId,
    async (data) => {
      setNotes("");
      setOkFlash(true);
      window.setTimeout(() => setOkFlash(false), 1800);
      onRecitationCreated?.(data);
      if (data.student_id) {
        setLastGradedStudentId(data.student_id);
        onGradeSubmitted(data.student_id, data.grade ?? "good", notes.trim() || undefined);
      }
      const nextStart = Math.min(data.ayah_end + 1, getSurahAyahCount(data.surah, riwayaTyped));
      setTargetSurah(data.surah);
      setTargetAyahStart(nextStart);
      setTargetAyahEnd(nextStart);
      setTargetOpen(false);
      setTargetOk(false);
    },
    (message) => setError(message),
  );

  const createTargetMutation = useCreatePlannedTarget(
    sessionId,
    () => {
      setTargetOk(true);
      setTargetOpen(false);
      window.setTimeout(() => setTargetOk(false), 2000);
    },
    (message) => setError(message),
  );

  const submitting = completePlanMutation.isPending || createAndGradeMutation.isPending;

  const submitGrade = (grade: RecitationGrade) => {
    if (isCompletePlan) {
      if (!planToComplete) return;
      setError(null);
      completePlanMutation.mutate({
        planId: planToComplete.id,
        grade,
        notes,
      });
      return;
    }

    if (!activeReciter) return;
    setError(null);
    createAndGradeMutation.mutate({
      student_id: activeReciter.userId,
      room_id: roomId,
      session_id: sessionId,
      surah,
      ayah_start: ayahStart,
      ayah_end: Math.max(ayahStart, ayahEnd),
      grade,
      teacher_notes: notes.trim() || undefined,
      riwaya: riwayaTyped,
    });
  };

  const disabled = isCompletePlan ? !planToComplete : !activeReciter;
  const isDock = variant === "dock";

  return (
    <div
      className={cn(
        isDock
          ? "rounded-[18px] border border-[rgba(15,23,42,0.10)] bg-white px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
          : "border-t border-gray-100 bg-muted/20 px-4 py-4",
        className,
      )}
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {isDock || !hideTitle ? (
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            {t("liveSession.gradeRecitation")}
          </h3>
          {isDock && onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6B7280] hover:bg-[#f1f3ee] hover:text-[#1A1A1A]"
              aria-label={t("common.close")}
            >
              <X className="size-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {disabled ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("liveSession.setReciterFirst")}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--color-text)]">
            <span className="text-[var(--color-text-muted)]">{t("liveSession.reciter")}:</span>{" "}
            {activeReciter?.name ?? planToComplete?.student_name ?? "—"}
          </p>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(surah, locale)} · {t("liveSession.ayahRange")}: {ayahStart}–{ayahEnd}
          </p>
          {openAnnotationsCount > 0 ? (
            <p className="mb-3 rounded-lg bg-[rgba(212,168,67,0.12)] px-2.5 py-1.5 text-xs font-medium text-[#9a7616]">
              {t("liveSession.grading.openAnnotationsNote", { count: openAnnotationsCount })}
            </p>
          ) : null}
          {!isCompletePlan ? (
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs items-end">
              <label className="col-span-1 flex min-w-0 flex-col gap-1.5">
                <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.surah")}</span>
                <FormSelect
                  value={String(surah)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (n < 1 || n > 114) return;
                    setSurah(n);
                    const max = getSurahAyahCount(n, riwayaTyped);
                    const clamp = (x: number) => Math.max(1, Math.min(x, max));
                    setAyahStart((a) => clamp(a));
                    setAyahEnd((a) => clamp(a));
                  }}
                  dir={isRtl ? "rtl" : "ltr"}
                  aria-label={t("recitations.selectSurah")}
                  triggerClassName={surahSelectTriggerClass}
                  triggerStyle={surahSelectStyle}
                  contentClassName="max-h-[min(22rem,70vh)]"
                  options={surahSelectOptions}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.ayahStart")}</span>
                <input
                  type="number"
                  min={1}
                  className={cn(rangeFieldClass, "tabular-nums")}
                  value={ayahStart}
                  onChange={(e) => setAyahStart(Number(e.target.value))}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.ayahEnd")}</span>
                <input
                  type="number"
                  min={1}
                  className={cn(rangeFieldClass, "tabular-nums")}
                  value={ayahEnd}
                  onChange={(e) => setAyahEnd(Number(e.target.value))}
                />
              </label>
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            {GRADE_ORDER.map((g) => {
              const color = GRADE_COLORS[g];
              return (
                <button
                  key={g}
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitGrade(g)}
                  className="rounded-lg border-2 bg-[rgba(255,255,255,0.9)] px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-50"
                  style={{
                    borderColor: color,
                    color,
                    backgroundColor: `${color}18`,
                  }}
                >
                  {t(`recitations.${g === "needs_work" ? "needsWork" : g}`)}
                </button>
              );
            })}
          </div>

          {okFlash ? (
            <p className="mb-2 flex items-center gap-1 text-sm text-[#1B5E20]">
              <Check className="size-4" aria-hidden />
              {t("liveSession.gradeSubmitted")}
            </p>
          ) : null}
          {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

          {(okFlash || lastGradedStudentId) && (activeReciter || planToComplete) ? (
            <div className="mb-3 rounded-lg border border-dashed border-[rgba(212,168,67,0.45)] bg-[rgba(212,168,67,0.06)] px-2.5 py-2">
              {!targetOpen ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#9a7616] hover:underline"
                  onClick={() => setTargetOpen(true)}
                >
                  {t("memory.setTarget")}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#9a7616]">{t("memory.setTarget")}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs items-end">
                    <label className="col-span-1 flex min-w-0 flex-col gap-1">
                      <span className="text-[var(--color-text-muted)]">{t("recitations.surah")}</span>
                      <FormSelect
                        value={String(targetSurah)}
                        onValueChange={(v) => {
                          const n = Number(v);
                          if (n < 1 || n > 114) return;
                          setTargetSurah(n);
                          const max = getSurahAyahCount(n, riwayaTyped);
                          const clamp = (x: number) => Math.max(1, Math.min(x, max));
                          setTargetAyahStart((a) => clamp(a));
                          setTargetAyahEnd((a) => clamp(a));
                        }}
                        dir={isRtl ? "rtl" : "ltr"}
                        triggerClassName={surahSelectTriggerClass}
                        triggerStyle={surahSelectStyle}
                        contentClassName="max-h-[min(22rem,70vh)]"
                        options={surahSelectOptions}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[var(--color-text-muted)]">{t("recitations.ayahStart")}</span>
                      <input
                        type="number"
                        min={1}
                        className={cn(rangeFieldClass, "tabular-nums")}
                        value={targetAyahStart}
                        onChange={(e) => setTargetAyahStart(Number(e.target.value))}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[var(--color-text-muted)]">{t("recitations.ayahEnd")}</span>
                      <input
                        type="number"
                        min={1}
                        className={cn(rangeFieldClass, "tabular-nums")}
                        value={targetAyahEnd}
                        onChange={(e) => setTargetAyahEnd(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={createTargetMutation.isPending}
                      className="rounded-lg bg-[#D4A843] px-3 py-1.5 text-xs font-semibold text-[#3a2c00] disabled:opacity-50"
                      onClick={() => {
                        const sid =
                          lastGradedStudentId ??
                          activeReciter?.userId ??
                          planToComplete?.student_id ??
                          null;
                        if (!sid) return;
                        createTargetMutation.mutate({
                          student_id: sid,
                          room_id: roomId,
                          session_id: sessionId,
                          surah: targetSurah,
                          ayah_start: targetAyahStart,
                          ayah_end: Math.max(targetAyahStart, targetAyahEnd),
                          riwaya: riwayaTyped,
                        });
                      }}
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[var(--color-text-muted)] hover:underline"
                      onClick={() => setTargetOpen(false)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
              {targetOk ? (
                <p className="mt-1 text-xs text-[#1B5E20]">{t("liveSession.gradeSubmitted")}</p>
              ) : null}
            </div>
          ) : null}

          <label className="mb-4 block">
            <span className="sr-only">{t("liveSession.gradeNotes")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("liveSession.gradeNotes")}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </>
      )}

      {!isDock ? (
        <>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">{t("liveSession.sessionRecitations")}</p>
          {loading ? (
            <p className="text-xs text-[var(--color-text-muted)]">{t("common.loading")}</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">—</p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-[var(--color-surface)] px-2 py-1.5">
                  <span className="min-w-0 truncate" style={{ fontFamily: "var(--font-quran)" }}>
                    {r.student_name ?? "—"} — {getSurahNameWithArabic(r.surah, locale)} {r.ayah_start}:{r.ayah_end}
                  </span>
                  <GradeBadge grade={r.grade} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
