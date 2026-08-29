// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useRef, useState } from "react";
import { syncdbg } from "../lib/syncdbg";
import { getSessionWebSocketUrl } from "../lib/wsUrl";
import type { ErrorAnnotation } from "../types";

export interface ParticipantInfo {
  user_id: string;
  name: string;
  role: string;
  is_muted: boolean;
  joined_at: string;
}

export type ContentMode = "mushaf" | "board";

export interface RoomStateMessage {
  type: "room-state";
  participants: ParticipantInfo[];
  active_reciter_id: string | null;
  current_ayah: { surah: number; ayah: number } | null;
  /** Teacher-led mushaf page; absent or null means clients default to 1 until set. */
  current_page?: number | null;
  /** Live content surface; defaults to mushaf when absent (older servers). */
  content_mode?: ContentMode;
  /** Student ids with hand raised (raise-time order). */
  raised_hands?: string[];
  session_id: string;
  room_id: string;
}

export type PlanStatusWire = "planned" | "in_progress" | "paused" | "completed" | "skipped";

/** Server → client: plan row lifecycle update (snake_case on wire). */
export interface PlanStatusChangedMessage {
  type: "plan-status-changed";
  recitation_id: string;
  plan_status: PlanStatusWire;
  active_reciter_id: string | null;
}

/** Persisted freehand stroke (`session_strokes` row). */
export interface SessionStroke {
  id: string;
  session_id: string;
  /** `null` = board surface. */
  page: number | null;
  points: number[][];
  color: string;
  width: number;
  created_by: string;
  created_at: string;
}

export interface UseSessionWebSocketOptions {
  sessionId: string;
  token: string;
  enabled?: boolean;
  onRoomState?: (state: RoomStateMessage) => void;
  onUserJoined?: (user: ParticipantInfo) => void;
  onUserLeft?: (userId: string) => void;
  onReciterChanged?: (userId: string | null) => void;
  onMuteChanged?: (userId: string, muted: boolean) => void;
  onCurrentAyah?: (surah: number, ayah: number) => void;
  onAyahCleared?: () => void;
  onCurrentPage?: (page: number) => void;
  onContentModeChanged?: (mode: ContentMode) => void;
  onStrokeAdded?: (stroke: SessionStroke) => void;
  onStrokeRemoved?: (strokeId: string) => void;
  onStrokesCleared?: (page: number | null) => void;
  onHandChanged?: (userId: string, raised: boolean) => void;
  onSessionEnded?: () => void;
  /** Student: private grade push from teacher */
  onGradeNotification?: (grade: string, notes?: string) => void;
  /** An annotation was added (by the teacher, on any recitation in this session). */
  onAnnotationAdded?: (annotation: ErrorAnnotation) => void;
  /** An annotation was removed (by the teacher). */
  onAnnotationRemoved?: (annotationId: string) => void;
  /** Session plan row status changed (broadcast to room). */
  onPlanStatusChanged?: (evt: PlanStatusChangedMessage) => void;
  onError?: (message: string) => void;
  /** Server closed this socket because the same user joined elsewhere — do not reconnect. */
  onAnotherTab?: () => void;
  /** Join rejected (e.g. room full) — do not reconnect. */
  onJoinRejected?: (message: string) => void;
  /** WebSocket recovered after reconnecting (for toast). */
  onReconnected?: () => void;
  /** JWT expired — reconnect loop stopped; show a blocking dead-end state. */
  onAuthExpired?: () => void;
}

export type SessionWsStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface UseSessionWebSocketReturn {
  status: SessionWsStatus;
  sendMute: (muted: boolean) => void;
  sendSetReciter: (userId: string) => void;
  sendClearReciter: () => void;
  sendCurrentAyah: (surah: number, ayah: number) => void;
  sendClearAyah: () => void;
  sendCurrentPage: (page: number) => void;
  sendSetContentMode: (mode: ContentMode) => void;
  sendStrokeAdd: (payload: {
    page: number | null;
    points: number[][];
    color: string;
    width: number;
  }) => void;
  sendStrokeUndo: (page: number | null) => void;
  sendStrokesClear: (page: number | null) => void;
  sendRaiseHand: () => void;
  sendLowerHand: () => void;
  sendPing: () => void;
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

function mapStroke(raw: Record<string, unknown>): SessionStroke | null {
  const id = raw.id as string | undefined;
  if (!id) return null;
  let points: number[][] = [];
  const rawPoints = raw.points;
  if (Array.isArray(rawPoints)) {
    points = rawPoints as number[][];
  } else if (typeof rawPoints === "string") {
    try {
      const parsed = JSON.parse(rawPoints) as unknown;
      if (Array.isArray(parsed)) points = parsed as number[][];
    } catch {
      points = [];
    }
  }
  const pageNum = raw.page == null ? null : Number(raw.page);
  return {
    id,
    session_id: String(raw.session_id ?? ""),
    page: pageNum != null && Number.isFinite(pageNum) ? pageNum : null,
    points,
    color: String(raw.color ?? "#EF5350"),
    width: typeof raw.width === "number" ? raw.width : Number(raw.width) || 0.012,
    created_by: String(raw.created_by ?? ""),
    created_at: String(raw.created_at ?? ""),
  };
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
/** Client ping interval (must stay in sync with the stale threshold below). */
const PING_INTERVAL_MS = 30_000;
/** Half-dead socket: no inbound traffic for 2.5× ping interval. */
const INBOUND_STALE_MS = 75_000;

function parseServerMessage(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when the JWT `exp` claim is present and already in the past. */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/**
 * Long-lived WebSocket connection to the session signaling server.
 *
 * # Reconnect lifecycle
 *
 * - `wsRef` holds the current socket (if any).
 * - `reconnectAttempt.current` indexes into a fixed backoff array
 *   `[1s, 2s, 4s, 8s, 16s, 30s]` — capped, never grows.
 * - `intentionalClose.current` distinguishes a user-initiated `disconnect()`
 *   from a network drop. Only the latter triggers a reconnect.
 * - `mounted.current` is flipped to `false` in the cleanup function and
 *   guards every `setState` from firing after unmount. This is the
 *   counterpart to `useLivekitConnection.ts`'s generation guard — same
 *   problem (stale async resolution), simpler shape (one boolean instead
 *   of a counter, because we only have one socket at a time).
 *
 * # `optsRef` indirection
 *
 * `optsRef.current = options` runs every render so the connect effect can
 * read the *latest* callbacks without including them in its dep array.
 * Including them would re-create the socket on every parent re-render.
 *
 * # Server-driven session-end
 *
 * If the server closes the socket because the same user joined elsewhere
 * (`SAME_USER_JOINED_ELSEWHERE`) or because of a hard rejection (room full,
 * etc.), we set the matching state and *do not* reconnect.
 *
 * If you change the close-code handling, update the matching state
 * transitions in `useSessionState.ts`.
 */
export function useSessionWebSocket(options: UseSessionWebSocketOptions): UseSessionWebSocketReturn {
  const { sessionId, token, enabled = true } = options;

  const [status, setStatus] = useState<SessionWsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalClose = useRef(false);
  const mounted = useRef(true);
  const prevStatus = useRef<SessionWsStatus | null>(null);
  const lastInboundAt = useRef(0);
  const statusRef = useRef<SessionWsStatus>(status);
  statusRef.current = status;

  const optsRef = useRef(options);
  optsRef.current = options;

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const clearPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  const outboundQueueRef = useRef<object[]>([]);

  const flushOutboundQueue = useCallback(() => {
    const sock = wsRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    const queued = outboundQueueRef.current;
    if (queued.length === 0) return;
    outboundQueueRef.current = [];
    for (const obj of queued) {
      sock.send(JSON.stringify(obj));
    }
  }, []);

  const sendRaw = useCallback((obj: object) => {
    const sock = wsRef.current;
    const type = (obj as { type?: string }).type;
    syncdbg(`sendRaw type=${type ?? "?"} readyState=${sock?.readyState ?? "null"}`);
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(obj));
      return;
    }
    // Pings are ephemeral — never queue.
    if (type === "ping") return;
    // Latest page / content-mode wins if several queued while connecting.
    if (type === "current-page" || type === "set-content-mode") {
      outboundQueueRef.current = outboundQueueRef.current.filter(
        (m) => (m as { type?: string }).type !== type,
      );
    }
    outboundQueueRef.current.push(obj);
    if (outboundQueueRef.current.length > 80) {
      outboundQueueRef.current = outboundQueueRef.current.slice(-80);
    }
    if (import.meta.env.DEV) {
      console.warn(
        `[session ws] queued ${type ?? "message"} (socket not open; readyState=${sock?.readyState ?? "null"})`,
      );
    }
  }, []);

  const sendMute = useCallback((muted: boolean) => {
    sendRaw({ type: "mute", muted });
  }, [sendRaw]);

  const sendSetReciter = useCallback(
    (userId: string) => {
      sendRaw({ type: "set-reciter", user_id: userId });
    },
    [sendRaw],
  );

  const sendClearReciter = useCallback(() => {
    sendRaw({ type: "clear-reciter" });
  }, [sendRaw]);

  const sendCurrentAyah = useCallback(
    (surah: number, ayah: number) => {
      sendRaw({ type: "current-ayah", surah, ayah });
    },
    [sendRaw],
  );

  const sendClearAyah = useCallback(() => {
    sendRaw({ type: "clear-ayah" });
  }, [sendRaw]);

  const sendCurrentPage = useCallback(
    (page: number) => {
      sendRaw({ type: "current-page", page });
    },
    [sendRaw],
  );

  const sendSetContentMode = useCallback(
    (mode: ContentMode) => {
      sendRaw({ type: "set-content-mode", mode });
    },
    [sendRaw],
  );

  const sendStrokeAdd = useCallback(
    (payload: { page: number | null; points: number[][]; color: string; width: number }) => {
      sendRaw({ type: "stroke-add", ...payload });
    },
    [sendRaw],
  );

  const sendStrokeUndo = useCallback(
    (page: number | null) => {
      sendRaw({ type: "stroke-undo", page });
    },
    [sendRaw],
  );

  const sendStrokesClear = useCallback(
    (page: number | null) => {
      sendRaw({ type: "strokes-clear", page });
    },
    [sendRaw],
  );

  const sendRaiseHand = useCallback(() => {
    sendRaw({ type: "raise-hand" });
  }, [sendRaw]);

  const sendLowerHand = useCallback(() => {
    sendRaw({ type: "lower-hand" });
  }, [sendRaw]);

  const sendPing = useCallback(() => {
    sendRaw({ type: "ping" });
  }, [sendRaw]);

  const sendGradeNotification = useCallback(
    (studentId: string, grade: string, notes?: string) => {
      sendRaw({ type: "grade-notification", student_id: studentId, grade, notes: notes ?? null });
    },
    [sendRaw],
  );

  const sendCreateAnnotation: UseSessionWebSocketReturn["sendCreateAnnotation"] = useCallback(
    (payload) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "create-annotation",
            ...payload,
          }),
        );
      } else {
        console.warn(
          "[session ws] sendCreateAnnotation skipped: socket not open (readyState=%s)",
          ws?.readyState ?? "no socket",
        );
      }
    },
    [],
  );

  const sendRemoveAnnotation: UseSessionWebSocketReturn["sendRemoveAnnotation"] = useCallback(
    (annotationId) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "remove-annotation",
            annotation_id: annotationId,
          }),
        );
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    // Mark this close as intentional so the close handler does not reconnect.
    intentionalClose.current = true;
    clearReconnect();
    clearPing();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [clearPing, clearReconnect]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // Block any pending setState from firing after unmount. See header doc.
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const prev = prevStatus.current;
    if (prev === "reconnecting" && status === "connected") {
      optsRef.current.onReconnected?.();
    }
    prevStatus.current = status;
  }, [status]);

  useEffect(() => {
    if (!enabled || !sessionId || !token) {
      intentionalClose.current = true;
      clearReconnect();
      clearPing();
      outboundQueueRef.current = [];
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("disconnected");
      return;
    }

    intentionalClose.current = false;

    const failAuthExpired = () => {
      intentionalClose.current = true;
      clearReconnect();
      clearPing();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mounted.current) setStatus("error");
      optsRef.current.onAuthExpired?.();
    };

    const connect = () => {
      if (!mounted.current) return;
      if (intentionalClose.current) return;

      if (isJwtExpired(token)) {
        failAuthExpired();
        return;
      }

      clearReconnect();
      setStatus((s) => (s === "reconnecting" ? "reconnecting" : "connecting"));

      const url = getSessionWebSocketUrl(sessionId, token);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        if (mounted.current) setStatus("error");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted.current) return;
        lastInboundAt.current = Date.now();
        reconnectAttempt.current = 0;
        setStatus("connected");
        flushOutboundQueue();
        clearPing();
        pingTimer.current = setInterval(() => {
          const sock = wsRef.current;
          if (!sock || sock.readyState !== WebSocket.OPEN) return;
          if (Date.now() - lastInboundAt.current > INBOUND_STALE_MS) {
            // Half-dead: force close so onclose → backoff reconnect (not intentional).
            sock.close();
            return;
          }
          sock.send(JSON.stringify({ type: "ping" }));
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (ev) => {
        const msg = parseServerMessage(String(ev.data));
        if (!msg || typeof msg.type !== "string") return;
        syncdbg(`inbound type=${msg.type}`);
        lastInboundAt.current = Date.now();
        const o = optsRef.current;
        switch (msg.type) {
          case "pong":
            break;
          case "room-state":
            o.onRoomState?.(msg as unknown as RoomStateMessage);
            break;
          case "user-joined": {
            const user = msg.user as ParticipantInfo | undefined;
            if (user) o.onUserJoined?.(user);
            break;
          }
          case "user-left": {
            const uid = msg.user_id as string | undefined;
            if (uid) o.onUserLeft?.(uid);
            break;
          }
          case "reciter-changed": {
            const uid = msg.user_id as string | null | undefined;
            o.onReciterChanged?.(uid ?? null);
            break;
          }
          case "mute-changed": {
            const uid = msg.user_id as string | undefined;
            const muted = msg.muted as boolean | undefined;
            if (uid !== undefined && typeof muted === "boolean") o.onMuteChanged?.(uid, muted);
            break;
          }
          case "current-ayah": {
            const surah = msg.surah as number | undefined;
            const ayah = msg.ayah as number | undefined;
            if (surah !== undefined && ayah !== undefined) o.onCurrentAyah?.(surah, ayah);
            break;
          }
          case "ayah-cleared":
            o.onAyahCleared?.();
            break;
          case "current-page": {
            const pg = msg.page as number | undefined;
            if (pg !== undefined && Number.isFinite(pg)) o.onCurrentPage?.(Math.floor(pg));
            break;
          }
          case "content-mode-changed": {
            const mode = msg.mode as string | undefined;
            if (mode === "mushaf" || mode === "board") o.onContentModeChanged?.(mode);
            break;
          }
          case "stroke-added": {
            const strokeRaw = msg.stroke as Record<string, unknown> | undefined;
            if (strokeRaw) {
              const stroke = mapStroke(strokeRaw);
              if (stroke) o.onStrokeAdded?.(stroke);
            }
            break;
          }
          case "stroke-removed": {
            const strokeId = msg.stroke_id as string | undefined;
            if (strokeId) o.onStrokeRemoved?.(strokeId);
            break;
          }
          case "strokes-cleared": {
            const page =
              msg.page === undefined || msg.page === null ? null : Number(msg.page);
            if (page !== null && !Number.isFinite(page)) break;
            o.onStrokesCleared?.(page);
            break;
          }
          case "hand-changed": {
            const uid = msg.user_id as string | undefined;
            const raised = msg.raised as boolean | undefined;
            if (uid && typeof raised === "boolean") o.onHandChanged?.(uid, raised);
            break;
          }
          case "session-ended": {
            intentionalClose.current = true;
            clearPing();
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            setStatus("disconnected");
            o.onSessionEnded?.();
            break;
          }
          case "grade-notification": {
            const grade = msg.grade as string | undefined;
            const notes = msg.notes as string | null | undefined;
            if (grade) o.onGradeNotification?.(grade, notes ?? undefined);
            break;
          }
          case "annotation-added": {
            const annotation = msg.annotation as ErrorAnnotation | undefined;
            if (annotation && o.onAnnotationAdded) {
              o.onAnnotationAdded(annotation);
            }
            break;
          }
          case "annotation-removed": {
            const annotationId = msg.annotation_id as string | undefined;
            if (annotationId && o.onAnnotationRemoved) {
              o.onAnnotationRemoved(annotationId);
            }
            break;
          }
          case "plan-status-changed": {
            const recitation_id = msg.recitation_id as string | undefined;
            const plan_status = msg.plan_status as PlanStatusWire | undefined;
            if (recitation_id && plan_status && o.onPlanStatusChanged) {
              const active_reciter_id =
                msg.active_reciter_id === undefined || msg.active_reciter_id === null
                  ? null
                  : (msg.active_reciter_id as string);
              o.onPlanStatusChanged({
                type: "plan-status-changed",
                recitation_id,
                plan_status,
                active_reciter_id,
              });
            }
            break;
          }
          case "error": {
            const m = msg.message as string | undefined;
            if (!m) break;
            if (m === "Connected from another tab") {
              intentionalClose.current = true;
              clearPing();
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
              setStatus("disconnected");
              o.onAnotherTab?.();
              o.onError?.(m);
              break;
            }
            if (m === "Room is full") {
              intentionalClose.current = true;
              clearPing();
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
              setStatus("error");
              o.onJoinRejected?.(m);
              o.onError?.(m);
              break;
            }
            o.onError?.(m);
            break;
          }
          default:
            break;
        }
      };

      ws.onerror = () => {
        if (mounted.current) setStatus("error");
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;
        if (!mounted.current) return;
        if (intentionalClose.current) {
          setStatus("disconnected");
          return;
        }
        setStatus("reconnecting");
        const attempt = reconnectAttempt.current;
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        reconnectAttempt.current = attempt + 1;
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    const onOnline = () => {
      if (!mounted.current || intentionalClose.current) return;
      if (statusRef.current !== "reconnecting") return;
      clearReconnect();
      reconnectAttempt.current = 0;
      connect();
    };

    const onVisibilityChange = () => {
      if (!mounted.current || intentionalClose.current) return;
      if (document.visibilityState !== "visible") return;

      if (statusRef.current === "reconnecting") {
        clearReconnect();
        reconnectAttempt.current = 0;
        connect();
        return;
      }

      if (statusRef.current === "connected") {
        const sock = wsRef.current;
        if (sock?.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: "ping" }));
        }
        if (Date.now() - lastInboundAt.current > INBOUND_STALE_MS) {
          sock?.close();
        }
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    connect();

    return () => {
      intentionalClose.current = true;
      clearReconnect();
      clearPing();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mounted.current) setStatus("disconnected");
    };
  }, [enabled, sessionId, token, clearPing, clearReconnect, flushOutboundQueue]);

  return {
    status,
    sendMute,
    sendSetReciter,
    sendClearReciter,
    sendCurrentAyah,
    sendClearAyah,
    sendCurrentPage,
    sendSetContentMode,
    sendStrokeAdd,
    sendStrokeUndo,
    sendStrokesClear,
    sendRaiseHand,
    sendLowerHand,
    sendPing,
    sendGradeNotification,
    sendCreateAnnotation,
    sendRemoveAnnotation,
    disconnect,
  };
}
