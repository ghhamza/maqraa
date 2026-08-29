// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Sparkles } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import type {
  AnnotationKind,
  ErrorAnnotation,
  ErrorCategory,
  ErrorSeverity,
} from "../../types";
import { MushafReader } from "../../components/mushaf/MushafReader";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import {
  AnnotationToolbar,
  type AnnotationTarget,
} from "../../components/session/AnnotationToolbar";
import {
  SessionToolRail,
  type SessionToolId,
} from "../../components/session/SessionToolRail";
import { WhiteboardLayer, type StrokePoint } from "../../components/session/WhiteboardLayer";
import { SessionBoardSurface } from "../../components/session/SessionBoardSurface";
import { ContentModeToggle } from "../../components/session/ContentModeToggle";
import { ParticipantDrawer } from "../../components/session/ParticipantDrawer";
import { ReciterChip } from "../../components/session/ReciterChip";
import {
  LiveSessionMobileBottomBar,
  LiveSessionOverflowSheet,
} from "../../components/session/LiveSessionMobileChrome";
import { LiveSessionDesktopActionBar } from "../sessions/components/LiveSessionDesktopActionBar";
import {
  useMushafInteraction,
  type MushafWordClickData,
} from "../../hooks/useMushafInteraction";
import type { ContentMode, SessionParticipant, SessionStroke } from "../../hooks/useSessionState";
import { trackDemoEvent } from "../../data/productEvents";
import { markDemoCompletedLocally } from "../../lib/demoPrefs";
import { getTotalPages } from "../../lib/quranService";
import { STROKE_COLORS, STROKE_WIDTH } from "../../lib/strokePath";
import { DemoGuidedTour } from "../../components/demo/DemoGuidedTour";
import { DemoIntroDialog, DemoModeBanner } from "../../components/demo/DemoIntroDialog";
import { Button } from "../../components/ui/Button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type DemoStep = "intro" | "marking" | "student" | "finale";

/** Suggested word on page 1 — الصراط (Al-Fatiha 6). */
const HINT_WORD = { surah: 1, ayah: 6, wordIndex: 2 } as const;
const DEMO_SESSION_ID = "demo-session";
const DEMO_STUDENT_ID = "demo-anas";

function makeAnnotation(partial: {
  surah: number;
  ayah: number;
  word_position: number;
  annotation_kind: AnnotationKind;
  error_severity?: ErrorSeverity;
  error_category?: ErrorCategory;
  teacher_comment?: string | null;
}): ErrorAnnotation {
  return {
    id: crypto.randomUUID(),
    recitation_id: "demo",
    surah: partial.surah,
    ayah: partial.ayah,
    word_position: partial.word_position,
    error_severity: partial.error_severity ?? "khafi",
    error_category: partial.error_category ?? "other",
    teacher_comment: partial.teacher_comment ?? null,
    annotation_kind: partial.annotation_kind,
    status: "open",
    resolved_at: null,
    resolved_by: null,
    created_at: new Date().toISOString(),
  };
}

function wordAnnotationClass(
  annotations: ErrorAnnotation[],
  surah: number,
  ayah: number,
  wordPosition: number,
): string {
  const matches = annotations.filter(
    (a) =>
      a.status === "open" &&
      a.surah === surah &&
      a.ayah === ayah &&
      (a.word_position === wordPosition || a.word_position === null),
  );
  if (matches.length === 0) return "";
  const error = matches.find((m) => m.annotation_kind === "error");
  if (error) {
    return error.error_severity === "jali" ? "mushaf-word--error-jali" : "mushaf-word--error-khafi";
  }
  if (matches.find((m) => m.annotation_kind === "repeat")) return "mushaf-word--repeat";
  if (matches.find((m) => m.annotation_kind === "note")) return "mushaf-word--note";
  if (matches.find((m) => m.annotation_kind === "good")) return "mushaf-word--good";
  return "";
}

function annotationHeadline(a: ErrorAnnotation, t: (k: string) => string): string {
  const kind = t(`annotation.kind.${a.annotation_kind}`);
  if (a.annotation_kind === "error") {
    return `${kind} · ${t(`annotation.severity.${a.error_severity}`)} · ${t(`error.${a.error_category}`)}`;
  }
  return kind;
}

function StudentPanel({
  annotations,
  flashWordKey,
  getWordAnnotationClass,
  page,
  highlightRange,
}: {
  annotations: ErrorAnnotation[];
  flashWordKey: string | null;
  getWordAnnotationClass: (s: number, a: number, w: number) => string;
  page: number;
  highlightRange: { surah: number; ayahStart: number; ayahEnd: number } | null;
}) {
  const { t } = useTranslation();
  const latest = annotations[annotations.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="font-[family-name:var(--font-heading)] text-lg text-[var(--color-text)]">
        {t("demo.studentViewTitle")}
      </h2>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-gray-100 shadow-sm transition-transform duration-500",
          flashWordKey ? "scale-[1.02]" : "scale-100",
        )}
        style={{ background: "var(--mushaf-page-paper, #FDF6E3)" }}
      >
        <div className="pointer-events-none px-2 py-2 [&_.mushaf-word]:cursor-default">
          <MushafCanvas
            page={page}
            riwaya="hafs"
            highlightRange={highlightRange}
            activeWord={null}
            getWordAnnotationClass={getWordAnnotationClass}
          />
        </div>
      </div>
      {latest ? (
        <div
          className="rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100 shadow-lg"
          style={
            flashWordKey
              ? { animation: "miqraa-demo-flash 0.7s ease-out" }
              : undefined
          }
        >
          <p className="font-medium text-white">{annotationHeadline(latest, t)}</p>
          {latest.teacher_comment?.trim() ? (
            <p className="mt-1 text-zinc-300">{latest.teacher_comment}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DemoSessionPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const [page, setPage] = useState(1);
  const [step, setStep] = useState<DemoStep>("intro");
  const [annotations, setAnnotations] = useState<ErrorAnnotation[]>([]);
  const [annotationTarget, setAnnotationTarget] = useState<AnnotationTarget | null>(null);
  const [studentSheetOpen, setStudentSheetOpen] = useState(false);
  const [flashWordKey, setFlashWordKey] = useState<string | null>(null);

  const [activeTool, setActiveTool] = useState<SessionToolId>("annotate");
  const [contentMode, setContentMode] = useState<ContentMode>("mushaf");
  const [strokes, setStrokes] = useState<SessionStroke[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [activeReciterId, setActiveReciterId] = useState<string | null>(DEMO_STUDENT_ID);
  const [tourOpen, setTourOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);

  const isBoardMode = contentMode === "board";
  const annotationMode = activeTool === "annotate" && !isBoardMode;
  const drawingEnabled = activeTool === "pen" || activeTool === "highlighter";
  const drawColor =
    activeTool === "highlighter" ? STROKE_COLORS.highlighter : STROKE_COLORS.pen;
  const drawWidth =
    activeTool === "highlighter" ? STROKE_WIDTH.highlighter : STROKE_WIDTH.pen;
  const strokeSurfacePage = isBoardMode ? null : page;
  const totalPages = getTotalPages("hafs");
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void trackDemoEvent("demo_started");
  }, []);

  useEffect(() => {
    if (step !== "finale" || completedRef.current) return;
    completedRef.current = true;
    void trackDemoEvent("demo_completed");
    markDemoCompletedLocally();
  }, [step]);

  const addAnnotation = useCallback((ann: ErrorAnnotation) => {
    setAnnotations((prev) => {
      const next = [...prev, ann];
      const hasError = next.some((a) => a.annotation_kind === "error");
      const hasGood = next.some((a) => a.annotation_kind === "good");

      const key = `${ann.surah}:${ann.ayah}:${ann.word_position ?? 0}`;
      setFlashWordKey(key);
      window.setTimeout(() => setFlashWordKey((cur) => (cur === key ? null : cur)), 900);

      if (hasError && hasGood) {
        setStep("finale");
        setStudentSheetOpen(false);
      } else if (ann.annotation_kind === "error") {
        setStep("student");
        setStudentSheetOpen(true);
      }
      return next;
    });
  }, []);

  const onWordSelect = useCallback(
    (data: MushafWordClickData) => {
      if (!annotationMode || !data.rect) return;
      setAnnotationTarget({
        surah: data.surah,
        ayah: data.ayah,
        wordIndex: data.wordIndex,
        rect: data.rect,
      });
      setStep((s) => (s === "intro" ? "marking" : s));
    },
    [annotationMode],
  );

  const interaction = useMushafInteraction({
    initialPage: page,
    riwaya: "hafs",
    onPageChange: setPage,
    onWordSelect,
    followHighlightPage: false,
  });

  const getWordAnnotationClass = useCallback(
    (surah: number, ayah: number, wordPosition: number) => {
      let cls = wordAnnotationClass(annotations, surah, ayah, wordPosition);
      const key = `${surah}:${ayah}:${wordPosition}`;
      if (flashWordKey === key) cls = cn(cls, "mushaf-word--demo-flash");
      if (
        step === "intro" &&
        page === 1 &&
        surah === HINT_WORD.surah &&
        ayah === HINT_WORD.ayah &&
        wordPosition === HINT_WORD.wordIndex &&
        !cls
      ) {
        cls = cn(cls, "mushaf-word--demo-hint");
      }
      return cls;
    },
    [annotations, flashWordKey, step, page],
  );

  const closeToolbar = useCallback(() => setAnnotationTarget(null), []);

  const handleMarkError = useCallback(
    (severity: ErrorSeverity, category: ErrorCategory, comment?: string) => {
      if (!annotationTarget) return;
      addAnnotation(
        makeAnnotation({
          surah: annotationTarget.surah,
          ayah: annotationTarget.ayah,
          word_position: annotationTarget.wordIndex,
          annotation_kind: "error",
          error_severity: severity,
          error_category: category,
          teacher_comment: comment ?? null,
        }),
      );
      closeToolbar();
    },
    [annotationTarget, addAnnotation, closeToolbar],
  );

  const handleGood = useCallback(() => {
    if (!annotationTarget) return;
    addAnnotation(
      makeAnnotation({
        surah: annotationTarget.surah,
        ayah: annotationTarget.ayah,
        word_position: annotationTarget.wordIndex,
        annotation_kind: "good",
      }),
    );
    closeToolbar();
  }, [annotationTarget, addAnnotation, closeToolbar]);

  const handleRepeat = useCallback(() => {
    if (!annotationTarget) return;
    addAnnotation(
      makeAnnotation({
        surah: annotationTarget.surah,
        ayah: annotationTarget.ayah,
        word_position: annotationTarget.wordIndex,
        annotation_kind: "repeat",
      }),
    );
    closeToolbar();
  }, [annotationTarget, addAnnotation, closeToolbar]);

  const handleComment = useCallback(
    (comment: string) => {
      if (!annotationTarget) return;
      addAnnotation(
        makeAnnotation({
          surah: annotationTarget.surah,
          ayah: annotationTarget.ayah,
          word_position: annotationTarget.wordIndex,
          annotation_kind: "note",
          teacher_comment: comment,
        }),
      );
      closeToolbar();
    },
    [annotationTarget, addAnnotation, closeToolbar],
  );

  const handleToolChange = useCallback((tool: SessionToolId) => {
    if (tool === "annotate" && contentMode === "board") return;
    setActiveTool(tool);
    if (tool !== "annotate") setAnnotationTarget(null);
  }, [contentMode]);

  const handleContentModeChange = useCallback((mode: ContentMode) => {
    setContentMode(mode);
    if (mode === "board") {
      setActiveTool((prev) => (prev === "annotate" ? "pen" : prev));
      setAnnotationTarget(null);
    } else {
      setActiveTool("annotate");
    }
  }, []);

  const surfaceStrokes = useMemo(
    () =>
      strokes.filter((s) =>
        strokeSurfacePage == null ? s.page == null : s.page === strokeSurfacePage,
      ),
    [strokes, strokeSurfacePage],
  );

  const handleStrokeComplete = useCallback(
    (points: StrokePoint[]) => {
      if (points.length === 0 || !user) return;
      setStrokes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          session_id: DEMO_SESSION_ID,
          page: strokeSurfacePage,
          points,
          color: drawColor,
          width: drawWidth,
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [user, strokeSurfacePage, drawColor, drawWidth],
  );

  const handleUndoStroke = useCallback(() => {
    setStrokes((prev) => {
      const surface = prev.filter((s) =>
        strokeSurfacePage == null ? s.page == null : s.page === strokeSurfacePage,
      );
      const last = surface[surface.length - 1];
      if (!last) return prev;
      return prev.filter((s) => s.id !== last.id);
    });
  }, [strokeSurfacePage]);

  const handleClearStrokes = useCallback(() => {
    setStrokes((prev) =>
      prev.filter((s) =>
        strokeSurfacePage == null ? s.page != null : s.page !== strokeSurfacePage,
      ),
    );
  }, [strokeSurfacePage]);

  const goHome = useCallback(() => {
    void navigate("/");
  }, [navigate]);

  const endTour = useCallback(() => {
    setTourOpen(false);
    setActiveTool("annotate");
    setContentMode("mushaf");
  }, []);

  const startTour = useCallback(() => {
    setIntroOpen(false);
    setTourOpen(true);
    setActiveTool("annotate");
    setContentMode("mushaf");
  }, []);

  const skipToPractice = useCallback(() => {
    setIntroOpen(false);
    setTourOpen(false);
    setActiveTool("annotate");
    setContentMode("mushaf");
  }, []);

  const mockParticipants = useMemo<SessionParticipant[]>(() => {
    if (!user) return [];
    return [
      {
        userId: user.id,
        name: user.name,
        role: "teacher",
        isMuted: !isMicEnabled,
        joinedAt: new Date().toISOString(),
      },
      {
        userId: DEMO_STUDENT_ID,
        name: t("demo.studentName"),
        role: "student",
        isMuted: true,
        joinedAt: new Date().toISOString(),
      },
    ];
  }, [user, isMicEnabled, t]);

  const whiteboardOverlay = (
    <WhiteboardLayer
      strokes={surfaceStrokes}
      drawingEnabled={drawingEnabled}
      color={drawColor}
      width={drawWidth}
      onStrokeComplete={handleStrokeComplete}
    />
  );

  const activeWord =
    interaction.activeWord ??
    (step === "intro" && page === 1 && !isBoardMode ? { ...HINT_WORD } : null);

  const bannerText = useMemo(() => {
    if (step === "intro") return t("demo.step1");
    if (step === "marking") return t("demo.step2");
    if (step === "student") return t("demo.step3");
    return "";
  }, [step, t]);

  const hasError = annotations.some((a) => a.annotation_kind === "error");
  const showStudentChrome = hasError || step === "student" || step === "finale";

  if (!user) return null;
  if (user.role === "student") return <Navigate to="/" replace />;

  const studentPanel = (
    <StudentPanel
      annotations={annotations}
      flashWordKey={flashWordKey}
      getWordAnnotationClass={getWordAnnotationClass}
      page={page}
      highlightRange={interaction.highlightRange}
    />
  );

  const noopAsync = async () => {};

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--mushaf-canvas)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-[var(--color-surface)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-5 shrink-0 text-[var(--color-gold)]" aria-hidden />
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{t("demo.entryTitle")}</p>
        </div>
        <div className="hidden md:block" data-tour="mode">
          <ContentModeToggle mode={contentMode} onChange={handleContentModeChange} />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={goHome}
        >
          <span className="inline-flex items-center gap-1.5">
            <Home className="size-4" aria-hidden />
            {t("demo.backHome")}
          </span>
        </Button>
      </header>

      <DemoModeBanner />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={cn(
            "relative min-h-[48vh] flex-1 overflow-hidden lg:min-h-0",
            "md:px-8 md:pb-[7.5rem] md:pt-4",
          )}
        >
          <div
            data-tour="tools"
            className="pointer-events-auto absolute top-7 z-20 hidden md:block inset-inline-start-[22px]"
          >
            <SessionToolRail
              className="!static !inset-auto !top-auto"
              activeTool={activeTool}
              onToolChange={handleToolChange}
              canAnnotate
              annotateDisabled={isBoardMode}
              annotateDisabledTitle={t("liveSession.board.annotateUnavailable")}
              canDraw
              onUndo={handleUndoStroke}
              onClearAll={handleClearStrokes}
            />
          </div>

          <div className="hidden md:block">
            <ReciterChip
              reciterName={t("demo.studentName")}
              currentAyah={
                interaction.highlightRange
                  ? {
                      surah: interaction.highlightRange.surah,
                      ayah: interaction.highlightRange.ayahStart,
                    }
                  : { surah: 1, ayah: 1 }
              }
              isTeacher
              locale={loc}
              storageKey={`miqraa.demo.reciterChip.${user.id}`}
              onGiveTurn={() => setDrawerOpen(true)}
              onEndRecitation={() => setDrawerOpen(true)}
            />
          </div>

          <div data-tour="mushaf" className="h-full min-h-0">
            {isBoardMode ? (
              <SessionBoardSurface riwaya="hafs" className="h-full min-h-0" overlay={whiteboardOverlay} />
            ) : (
              <MushafReader
                page={page}
                onPageChange={setPage}
                riwaya="hafs"
                canChangePage
                hideNavigation
                omitMenuStrip
                fitStage
                className="h-full min-h-0"
                pageOverlay={whiteboardOverlay}
              >
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <MushafCanvas
                    page={page}
                    riwaya="hafs"
                    highlightRange={interaction.highlightRange}
                    activeWord={activeWord}
                    onWordClick={interaction.handleWordClick}
                    getWordAnnotationClass={getWordAnnotationClass}
                  />
                </div>
              </MushafReader>
            )}
          </div>

          <LiveSessionDesktopActionBar
            data-tour="dock"
            canPublishAudio
            livekitConnected
            isMicEnabled={isMicEnabled}
            page={page}
            totalPages={totalPages}
            canNavigate={!isBoardMode}
            riwaya="hafs"
            showPager={!isBoardMode}
            isTeacher
            onPageChange={setPage}
            onToggleMic={() => setIsMicEnabled((v) => !v)}
            onOpenParticipants={() => setDrawerOpen(true)}
            onOpenNavigator={() => {}}
            onLeave={goHome}
          />
        </div>

        {showStudentChrome ? (
          <aside className="hidden w-full max-w-md shrink-0 flex-col border-s border-black/5 bg-[var(--color-surface)] p-4 lg:flex">
            {studentPanel}
          </aside>
        ) : null}
      </div>

      <LiveSessionMobileBottomBar
        data-tour="dock"
        isTeacher
        canPublishAudio
        livekitConnected
        livekitStatus="connected"
        isMicEnabled={isMicEnabled}
        annotationMode={annotationMode}
        onToggleMic={() => setIsMicEnabled((v) => !v)}
        onToggleAnnotation={() =>
          handleToolChange(annotationMode ? "hand" : "annotate")
        }
        onOpenParticipants={() => setDrawerOpen(true)}
        onOpenMore={() => setOverflowOpen(true)}
        onLeave={goHome}
        onEndSession={goHome}
      />

      {showStudentChrome && step !== "finale" ? (
        <div className="flex shrink-0 justify-center border-t border-black/5 bg-[var(--color-surface)] px-4 py-2 lg:hidden">
          <Button type="button" variant="secondary" size="sm" onClick={() => setStudentSheetOpen(true)}>
            {t("demo.showStudentView")}
          </Button>
        </div>
      ) : null}

      <Sheet open={studentSheetOpen && step !== "finale"} onOpenChange={setStudentSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t("demo.studentViewTitle")}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 pb-6">{studentPanel}</div>
        </SheetContent>
      </Sheet>

      <ParticipantDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        participants={mockParticipants}
        teacherId={user.id}
        myUserId={user.id}
        isTeacher
        activeReciterId={activeReciterId}
        onGiveTurn={(id) => setActiveReciterId(id)}
        offlineStudents={[]}
        sessionId={DEMO_SESSION_ID}
        plans={[]}
        onPlansChange={() => {}}
        onStartPlan={noopAsync}
        onPausePlan={noopAsync}
        onSkipPlan={noopAsync}
        onReopenPlan={async () => {}}
        onAdHocStart={(studentId) => setActiveReciterId(studentId)}
        onEndGradeForPlan={() => {}}
        onPlanTransitionError={() => {}}
      />

      <LiveSessionOverflowSheet
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        connectionStatus="connected"
        participantCount={mockParticipants.length}
        elapsedLabel={t("demo.elapsedLabel")}
        isTeacher
        autoFollow
        onAutoFollowToggle={() => {}}
      />

      {step === "finale" ? (
        <div className="shrink-0 border-t border-black/5 bg-[var(--color-surface)] px-4 py-5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="mx-auto max-w-lg space-y-4 text-center">
            <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-primary)] sm:text-2xl">
              {t("demo.finaleTitle")}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t("demo.finaleSummary")}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="primary" size="lg" onClick={() => void navigate("/rooms/new")}>
                {t("demo.finaleCta")}
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={goHome}>
                {t("demo.backHome")}
              </Button>
            </div>
          </div>
        </div>
      ) : !tourOpen && !introOpen ? (
        <div className="shrink-0 border-t border-black/5 bg-[var(--color-surface)] px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--color-text)]">{bannerText}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={goHome}
            >
              <span className="inline-flex items-center gap-1.5">
                <Home className="size-4" aria-hidden />
                {t("demo.backHome")}
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      <AnnotationToolbar
        key={
          annotationTarget
            ? `${annotationTarget.surah}-${annotationTarget.ayah}-${annotationTarget.wordIndex}`
            : "closed"
        }
        target={annotationTarget}
        onMarkError={handleMarkError}
        onRepeat={handleRepeat}
        onComment={handleComment}
        onGood={handleGood}
        onClose={closeToolbar}
      />

      <DemoIntroDialog
        open={introOpen}
        onStartTour={startTour}
        onSkipToPractice={skipToPractice}
      />
      <DemoGuidedTour open={tourOpen} i18nPrefix="demo.tour" onComplete={endTour} onSkip={endTour} />
    </div>
  );
}
