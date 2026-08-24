// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorAnnotation } from "../types";
import type {
  ContentMode,
  ParticipantInfo,
  PlanStatusChangedMessage,
  RoomStateMessage,
  SessionStroke,
} from "./useSessionWebSocket";
import { useSessionWebSocket } from "./useSessionWebSocket";

export type { ContentMode, SessionStroke };

export interface SessionParticipant {
  userId: string;
  name: string;
  role: "teacher" | "student";
  isMuted: boolean;
  joinedAt: string;
}

export interface SessionState {
  participants: SessionParticipant[];
  activeReciterId: string | null;
  currentAyah: { surah: number; ayah: number } | null;
  /** Teacher-led mushaf page; null until teacher sets or room-state omits it. */
  currentPage: number | null;
  /** Live content surface synchronized by the teacher. */
  contentMode: ContentMode;
  sessionId: string;
  roomId: string;
}

const emptyState = (sessionId: string, roomId: string): SessionState => ({
  participants: [],
  activeReciterId: null,
  currentAyah: null,
  currentPage: null,
  contentMode: "mushaf",
  sessionId,
  roomId,
});

function mapParticipant(p: RoomStateMessage["participants"][0]): SessionParticipant {
  return {
    userId: p.user_id,
    name: p.name,
    role: p.role === "teacher" ? "teacher" : "student",
    isMuted: p.is_muted,
    joinedAt: p.joined_at,
  };
}

export interface UseSessionStateOptions {
  sessionId: string;
  token: string;
  myUserId: string;
  /** Room teacher — used until `room-state` lists participants. */
  teacherId: string;
  enabled: boolean;
  onSessionEnded?: () => void;
  onGradeNotification?: (grade: string, notes?: string) => void;
  onAnnotationAdded?: (annotation: ErrorAnnotation) => void;
  onAnnotationRemoved?: (annotationId: string) => void;
  onAnotherTab?: () => void;
  onJoinRejected?: (message: string) => void;
  onReconnected?: () => void;
  onAuthExpired?: () => void;
  /** After state merge — for a11y announcements */
  onParticipantJoined?: (user: ParticipantInfo) => void;
  onParticipantLeft?: (userId: string, name: string | undefined) => void;
  onPlanStatusChanged?: (evt: PlanStatusChangedMessage) => void;
}

export interface UseSessionStateReturn {
  state: SessionState;
  wsStatus: import("./useSessionWebSocket").SessionWsStatus;
  /** True after the first `room-state` — content mode is server-authoritative until then. */
  hasRoomState: boolean;
  myRole: "teacher" | "student";
  isTeacher: boolean;
  isActiveReciter: boolean;
  isMuted: boolean;
  setReciter: (userId: string) => void;
  clearReciter: () => void;
  toggleMute: () => void;
  setCurrentAyah: (surah: number, ayah: number) => void;
  clearCurrentAyah: () => void;
  /** Teacher only: broadcast mushaf page so students follow. */
  setCurrentPage: (page: number) => void;
  /** Teacher only: switch mushaf ↔ board for everyone. */
  setContentMode: (mode: ContentMode) => void;
  strokes: SessionStroke[];
  /** Replace/merge strokes for one surface (REST seed / reconnect). */
  replaceSurfaceStrokes: (page: number | null, strokes: SessionStroke[]) => void;
  /** Optimistic local stroke before `stroke-added` ack. */
  addLocalStroke: (stroke: SessionStroke) => void;
  sendStrokeAdd: (payload: {
    page: number | null;
    points: number[][];
    color: string;
    width: number;
  }) => void;
  sendStrokeUndo: (page: number | null) => void;
  sendStrokesClear: (page: number | null) => void;
  raisedHands: string[];
  raiseHand: () => void;
  lowerHand: () => void;
  /** Teacher only: notify a student of a grade (forwarded by server). */
  sendGradeNotification: (studentId: string, grade: string, notes?: string) => void;
  sendCreateAnnotation: (payload: {
    recitation_id: string;
    surah: number;
    ayah: number;
    word_position: number | null;
    error_severity: string;
    error_category: string;
    teacher_comment: string | null;
    annotation_kind: string;
  }) => void;
  sendRemoveAnnotation: (annotationId: string) => void;
  disconnect: () => void;
}

/**
 * Orchestrates `useLivekitConnection` (audio/video transport) and
 * `useSessionWebSocket` (session signaling) for a single live session.
 *
 * Treat the two hooks as independent: each manages its own retry/reconnect
 * lifecycle. This hook combines their *outputs* into one cohesive state for
 * the page (participants, reciter, current ayah/page, grading callbacks)
 * and sends user actions to whichever channel handles them.
 *
 * If you find yourself adding logic that conditionally reads from one hook
 * based on the other's status, prefer pushing that into the lower-level
 * hook (or accept it here, but document the coupling).
 */
export function useSessionState(options: UseSessionStateOptions): UseSessionStateReturn {
  const {
    sessionId,
    token,
    myUserId,
    teacherId,
    enabled,
    onSessionEnded,
    onGradeNotification,
    onAnnotationAdded,
    onAnnotationRemoved,
    onAnotherTab,
    onJoinRejected,
    onReconnected,
    onAuthExpired,
    onParticipantJoined,
    onParticipantLeft,
    onPlanStatusChanged,
  } = options;

  const [state, setState] = useState<SessionState>(() => emptyState(sessionId, ""));
  const [hasRoomState, setHasRoomState] = useState(false);
  const [strokes, setStrokes] = useState<SessionStroke[]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  /** Raise-time ordered student ids. */
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  /** After undoing an unacked `local:` stroke, ignore the matching `stroke-added` ack. */
  const ignoreStrokeAddBySurface = useRef<Map<string, number>>(new Map());

  const surfaceKey = (page: number | null) => (page == null ? "board" : `p:${page}`);

  useEffect(() => {
    setState(emptyState(sessionId, ""));
    setHasRoomState(false);
    setStrokes([]);
    setRaisedHands([]);
    ignoreStrokeAddBySurface.current.clear();
  }, [sessionId]);

  const applyRoomState = useCallback(
    (msg: RoomStateMessage) => {
      const mode = msg.content_mode === "board" ? "board" : "mushaf";
      setState({
        participants: msg.participants.map(mapParticipant),
        activeReciterId: msg.active_reciter_id,
        currentAyah: msg.current_ayah,
        currentPage: msg.current_page ?? null,
        contentMode: mode,
        sessionId: msg.session_id,
        roomId: msg.room_id,
      });
      setRaisedHands(Array.isArray(msg.raised_hands) ? msg.raised_hands : []);
      setHasRoomState(true);
    },
    [],
  );

  const ws = useSessionWebSocket({
    sessionId,
    token,
    enabled,
    onRoomState: applyRoomState,
    onUserJoined: (user) => {
      setState((prev) => {
        const next = [
          ...prev.participants.filter((x) => x.userId !== user.user_id),
          mapParticipant(user),
        ];
        next.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
        return { ...prev, participants: next };
      });
      onParticipantJoined?.(user);
    },
    onUserLeft: (userId) => {
      setState((prev) => {
        const left = prev.participants.find((p) => p.userId === userId);
        onParticipantLeft?.(userId, left?.name);
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.userId !== userId),
          activeReciterId: prev.activeReciterId === userId ? null : prev.activeReciterId,
        };
      });
      setRaisedHands((prev) => prev.filter((id) => id !== userId));
    },
    onReciterChanged: (userId) => {
      setState((prev) => ({ ...prev, activeReciterId: userId }));
    },
    onMuteChanged: (userId, muted) => {
      setState((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.userId === userId ? { ...p, isMuted: muted } : p,
        ),
      }));
    },
    onCurrentAyah: (surah, ayah) => {
      setState((prev) => ({ ...prev, currentAyah: { surah, ayah } }));
    },
    onAyahCleared: () => {
      setState((prev) => ({ ...prev, currentAyah: null }));
    },
    onCurrentPage: (page) => {
      setState((prev) => ({ ...prev, currentPage: page }));
    },
    onContentModeChanged: (mode) => {
      setState((prev) => ({ ...prev, contentMode: mode }));
    },
    onStrokeAdded: (stroke) => {
      const key = surfaceKey(stroke.page);
      const ignore = ignoreStrokeAddBySurface.current.get(key) ?? 0;
      if (ignore > 0) {
        ignoreStrokeAddBySurface.current.set(key, ignore - 1);
        // Drop one optimistic local on this surface if still present (race).
        setStrokes((prev) => {
          let droppedLocal = false;
          return prev.filter((s) => {
            if (droppedLocal) return true;
            const sameSurface =
              stroke.page == null ? s.page == null : s.page === stroke.page;
            if (sameSurface && s.id.startsWith("local:")) {
              droppedLocal = true;
              return false;
            }
            return true;
          });
        });
        return;
      }
      setStrokes((prev) => {
        if (prev.some((s) => s.id === stroke.id)) return prev;
        // Drop one optimistic local stroke on the same surface (FIFO).
        let droppedLocal = false;
        const withoutLocal = prev.filter((s) => {
          if (droppedLocal) return true;
          const sameSurface =
            stroke.page == null ? s.page == null : s.page === stroke.page;
          if (sameSurface && s.id.startsWith("local:")) {
            droppedLocal = true;
            return false;
          }
          return true;
        });
        return [...withoutLocal, stroke];
      });
    },
    onStrokeRemoved: (strokeId) => {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    },
    onStrokesCleared: (page) => {
      setStrokes((prev) =>
        page == null ? prev.filter((s) => s.page != null) : prev.filter((s) => s.page !== page),
      );
    },
    onHandChanged: (userId, raised) => {
      setRaisedHands((prev) => {
        if (raised) {
          if (prev.includes(userId)) return prev;
          return [...prev, userId];
        }
        return prev.filter((id) => id !== userId);
      });
    },
    onSessionEnded,
    onGradeNotification,
    onAnnotationAdded,
    onAnnotationRemoved,
    onAnotherTab,
    onJoinRejected,
    onReconnected,
    onAuthExpired,
    onPlanStatusChanged,
  });

  const me = state.participants.find((p) => p.userId === myUserId);
  const myRole: "teacher" | "student" =
    me?.role ?? (myUserId === teacherId ? "teacher" : "student");
  const isTeacher = myRole === "teacher";
  const isActiveReciter = state.activeReciterId === myUserId;
  const isMuted = me?.isMuted ?? true;

  const setReciter = useCallback(
    (userId: string) => {
      ws.sendSetReciter(userId);
    },
    [ws],
  );

  const clearReciter = useCallback(() => {
    ws.sendClearReciter();
  }, [ws]);

  const toggleMute = useCallback(() => {
    ws.sendMute(!isMuted);
  }, [ws, isMuted]);

  const setCurrentAyah = useCallback(
    (surah: number, ayah: number) => {
      ws.sendCurrentAyah(surah, ayah);
    },
    [ws],
  );

  const clearCurrentAyah = useCallback(() => {
    ws.sendClearAyah();
  }, [ws]);

  const setCurrentPage = useCallback(
    (page: number) => {
      ws.sendCurrentPage(page);
    },
    [ws],
  );

  const setContentMode = useCallback(
    (mode: ContentMode) => {
      // Optimistic — otherwise mushaf flashes then room-state/board wins the race visually,
      // and a slow/missed `content-mode-changed` feels like the toggle "doesn't work".
      setState((prev) => (prev.contentMode === mode ? prev : { ...prev, contentMode: mode }));
      ws.sendSetContentMode(mode);
    },
    [ws],
  );

  const replaceSurfaceStrokes = useCallback((page: number | null, next: SessionStroke[]) => {
    setStrokes((prev) => {
      const onSurface = (s: SessionStroke) =>
        page == null ? s.page == null : s.page === page;
      const other = prev.filter((s) => !onSurface(s));
      const byId = new Map<string, SessionStroke>();
      for (const s of next) byId.set(s.id, s);
      // Keep WS/optimistic strokes the REST snapshot hasn't caught up with yet.
      for (const s of prev) {
        if (onSurface(s) && !byId.has(s.id)) byId.set(s.id, s);
      }
      const merged = Array.from(byId.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      return [...other, ...merged];
    });
  }, []);

  const addLocalStroke = useCallback((stroke: SessionStroke) => {
    setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
  }, []);

  const sendStrokeAdd = useCallback(
    (payload: { page: number | null; points: number[][]; color: string; width: number }) => {
      ws.sendStrokeAdd(payload);
    },
    [ws],
  );

  const sendStrokeUndo = useCallback(
    (page: number | null) => {
      const onSurface = (s: SessionStroke) =>
        page == null ? s.page == null : s.page === page;
      const prev = strokesRef.current;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (onSurface(prev[i])) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx < 0) return;
      const last = prev[lastIdx];
      setStrokes(prev.filter((_, i) => i !== lastIdx));
      if (last.id.startsWith("local:")) {
        const key = surfaceKey(page);
        ignoreStrokeAddBySurface.current.set(
          key,
          (ignoreStrokeAddBySurface.current.get(key) ?? 0) + 1,
        );
        return;
      }
      ws.sendStrokeUndo(page);
    },
    [ws],
  );

  const sendStrokesClear = useCallback(
    (page: number | null) => {
      // Optimistic — clear confirm previously threw on a removed setter and never reached WS.
      setStrokes((prev) =>
        page == null ? prev.filter((s) => s.page != null) : prev.filter((s) => s.page !== page),
      );
      ws.sendStrokesClear(page);
    },
    [ws],
  );

  const raiseHand = useCallback(() => {
    ws.sendRaiseHand();
  }, [ws]);

  const lowerHand = useCallback(() => {
    ws.sendLowerHand();
  }, [ws]);

  const sendGradeNotification = useCallback(
    (studentId: string, grade: string, notes?: string) => {
      ws.sendGradeNotification(studentId, grade, notes);
    },
    [ws],
  );

  const sendCreateAnnotation = useCallback(
    (payload: Parameters<UseSessionStateReturn["sendCreateAnnotation"]>[0]) => {
      ws.sendCreateAnnotation(payload);
    },
    [ws],
  );

  const sendRemoveAnnotation = useCallback(
    (annotationId: string) => {
      ws.sendRemoveAnnotation(annotationId);
    },
    [ws],
  );

  const derived = useMemo(
    () => ({
      state,
      wsStatus: ws.status,
      hasRoomState,
      myRole,
      isTeacher,
      isActiveReciter,
      isMuted,
      setReciter,
      clearReciter,
      toggleMute,
      setCurrentAyah,
      clearCurrentAyah,
      setCurrentPage,
      setContentMode,
      strokes,
      replaceSurfaceStrokes,
      addLocalStroke,
      sendStrokeAdd,
      sendStrokeUndo,
      sendStrokesClear,
      raisedHands,
      raiseHand,
      lowerHand,
      sendGradeNotification,
      sendCreateAnnotation,
      sendRemoveAnnotation,
      disconnect: ws.disconnect,
    }),
    [
      state,
      ws.status,
      hasRoomState,
      myRole,
      isTeacher,
      isActiveReciter,
      isMuted,
      setReciter,
      clearReciter,
      toggleMute,
      setCurrentAyah,
      clearCurrentAyah,
      setCurrentPage,
      setContentMode,
      strokes,
      replaceSurfaceStrokes,
      addLocalStroke,
      sendStrokeAdd,
      sendStrokeUndo,
      sendStrokesClear,
      raisedHands,
      raiseHand,
      lowerHand,
      sendGradeNotification,
      sendCreateAnnotation,
      sendRemoveAnnotation,
      ws.disconnect,
    ],
  );

  return derived;
}
