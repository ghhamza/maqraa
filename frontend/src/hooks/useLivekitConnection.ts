import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  PublishTrackError,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { api } from "@/lib/api";

export type MicError = "browser_denied" | "publish_denied" | "device_error";

function isMicPublished(room: Room): boolean {
  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  return !!(pub?.track && !pub.isMuted);
}

function hasLivekitPublishPermission(room: Room): boolean {
  return room.localParticipant.permissions?.canPublish === true;
}

function classifyMicError(err: unknown): MicError {
  if (err instanceof PublishTrackError) {
    return "publish_denied";
  }
  if (err instanceof Error) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "browser_denied";
    }
    const msg = err.message.toLowerCase();
    if (msg.includes("permission") || msg.includes("not allowed")) {
      return "browser_denied";
    }
    if (msg.includes("insufficient permissions")) {
      return "publish_denied";
    }
  }
  return "device_error";
}

async function resetLocalMic(room: Room): Promise<void> {
  try {
    await room.localParticipant.setMicrophoneEnabled(false);
  } catch {
    // ignore cleanup failures
  }
}

export type LivekitConnectionStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseLivekitConnectionOptions {
  sessionId: string;
  canPublish?: boolean;
  autoConnect?: boolean;
}

export type LivekitAccessBlock = "forbidden" | "not_live";

export interface UseLivekitConnectionResult {
  status: LivekitConnectionStatus;
  error: string | null;
  accessBlock: LivekitAccessBlock | null;
  room: Room | null;
  hasRemoteAudio: boolean;
  audioPlaybackBlocked: boolean;
  startAudio: () => Promise<void>;
  /** True only when the microphone track is published and unmuted in LiveKit. */
  isMicEnabled: boolean;
  micError: MicError | null;
  clearMicError: () => void;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  reconnect: () => Promise<void>;
}

interface TokenResponse {
  token: string;
  ws_url: string;
  room: string;
  identity: string;
}

/**
 * Manages a single LiveKit `Room` instance per session, with safe reconnect.
 *
 * # The generation-counter pattern
 *
 * Every time we kick off a new connect attempt we bump `generationRef.current`
 * and capture the new value as `myGen`. Every async step inside the connect
 * flow checks `if (generationRef.current !== myGen) return;` before touching
 * state — this lets a *stale* attempt (e.g. one that started, then was
 * superseded by a re-connect during the intervening await) bail out instead
 * of stomping on the current attempt's room/state.
 *
 * The cleanup function also bumps the generation, so any resolution that
 * arrives after unmount is automatically considered stale and discarded.
 *
 * Why this is needed: LiveKit `Room.connect()` is async and there is no
 * cancellation API. Without the generation guard, a slow connect kicked off
 * before a re-connect could resolve *after* the new connect resolved and
 * either (a) overwrite the new room ref or (b) emit events that look like
 * they came from the current room. Both bugs have happened before in this
 * file — do not remove the guards.
 *
 * # Auto-mic-permission sync
 *
 * The server may flip `canPublish` mid-session (teacher hands the mic over).
 * The participant-permissions-changed handler watches for this and toggles
 * the local mic publication so the user does not have to click anything.
 *
 * # Reconnect backoff
 *
 * Driven by `reconnectTrigger` state which the disconnect handler bumps.
 * Backoff is exponential (1s..30s). The cleanup-on-unmount path is distinct
 * from the reconnect path so unmount does not trigger a reconnect.
 */
export function useLivekitConnection(
  options: UseLivekitConnectionOptions,
): UseLivekitConnectionResult {
  const { sessionId, canPublish = false, autoConnect = true } = options;

  const [status, setStatus] = useState<LivekitConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [accessBlock, setAccessBlock] = useState<LivekitAccessBlock | null>(null);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [micError, setMicError] = useState<MicError | null>(null);

  // The one and only live Room instance. Null when disconnected or between attempts.
  const roomRef = useRef<Room | null>(null);
  const attachedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Generation counter. Every fresh connect attempt captures this value; any
  // async step that resumes with a stale generation must bail out.
  // Incrementing this is how "cancel in flight" is signalled.
  const generationRef = useRef(0);

  // Trigger used by `reconnect()` to force a fresh attempt. Incrementing it
  // re-runs the connect effect. Separate from generationRef because
  // generationRef is bumped from cleanup too (not just manual reconnect).
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // We keep a ref mirror of canPublish so the connect effect doesn't need it
  // in its deps - avoids full reconnect when canPublish flips mid-session.
  // Permission updates flow server-side via the backend reciter-turn hook;
  // we just need to enable/disable the mic locally in response.
  const canPublishRef = useRef(canPublish);
  const prevCanPublishRef = useRef(canPublish);
  useEffect(() => {
    canPublishRef.current = canPublish;
  }, [canPublish]);

  /**
   * Tear down the current Room if any. Safe to call any number of times.
   * This is NOT awaited during StrictMode cleanup - React 18/19 doesn't
   * support async cleanup - but the generation bump ensures any stale
   * async step that resumes afterwards will abort.
   */
  const syncMicFromRoom = useCallback((room: Room) => {
    setIsMicEnabled(isMicPublished(room));
  }, []);

  const attemptEnableMic = useCallback(
    async (room: Room, myGen: number) => {
      if (!hasLivekitPublishPermission(room)) {
        return;
      }
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (generationRef.current !== myGen) return;
        syncMicFromRoom(room);
        if (isMicPublished(room)) {
          setMicError(null);
        } else {
          setMicError("publish_denied");
        }
      } catch (err) {
        if (generationRef.current !== myGen) return;
        await resetLocalMic(room);
        syncMicFromRoom(room);
        setMicError(classifyMicError(err));
      }
    },
    [syncMicFromRoom],
  );

  const teardownCurrentRoom = useCallback(async () => {
    for (const [, audioEl] of attachedAudioElementsRef.current) {
      if (audioEl.parentElement) {
        audioEl.parentElement.removeChild(audioEl);
      }
    }
    attachedAudioElementsRef.current.clear();

    const r = roomRef.current;
    if (!r) return;
    roomRef.current = null;
    try {
      await r.disconnect(true);
    } catch {
      // ignore
    }
  }, []);

  // The connect effect. Runs on mount, on sessionId change, on reconnect.
  useEffect(() => {
    if (!autoConnect || !sessionId) {
      return;
    }

    // Bump generation so any in-flight attempt becomes stale. See header doc.
    generationRef.current += 1;
    const myGen = generationRef.current;

    // AbortController for the token fetch specifically - lets us cancel
    // the HTTP request immediately on cleanup rather than waiting for it
    // to resolve just so the resolution handler can notice it's stale.
    const tokenAbort = new AbortController();

    const run = async () => {
      try {
        setStatus("requesting_token");
        setError(null);
        setAccessBlock(null);

        const { data } = await api.post<TokenResponse>(
          "/livekit/token",
          { session_id: sessionId },
          { signal: tokenAbort.signal },
        );

        // Stale attempt? Bail.
        if (generationRef.current !== myGen) return;

        setStatus("connecting");

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        // Wire event handlers BEFORE awaiting connect, so we don't miss
        // any early events (e.g. Connected fires before our await resolves
        // in some SDK versions).
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            void participant;
            if (pub.kind === Track.Kind.Audio) {
              const trackSid = track.sid;
              if (!trackSid) return;
              const existing = attachedAudioElementsRef.current.get(trackSid);
              if (existing?.parentElement) {
                existing.parentElement.removeChild(existing);
              }

              const audioEl = track.attach() as HTMLAudioElement;
              document.body.appendChild(audioEl);
              attachedAudioElementsRef.current.set(trackSid, audioEl);
              setHasRemoteAudio(true);
            }
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
          const audioEl = attachedAudioElementsRef.current.get(pub.trackSid);
          if (audioEl) {
            track.detach(audioEl);
            if (audioEl.parentElement) {
              audioEl.parentElement.removeChild(audioEl);
            }
            attachedAudioElementsRef.current.delete(pub.trackSid);
          }

          const audioStillThere = Array.from(room.remoteParticipants.values()).some(
            (participant) =>
              Array.from(participant.trackPublications.values()).some(
                (pub) => pub.kind === Track.Kind.Audio && pub.isSubscribed,
              ),
          );
          setHasRemoteAudio(audioStillThere);
        });

        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          // Ignore events from stale rooms.
          if (generationRef.current !== myGen) return;
          if (state === ConnectionState.Connected) {
            setStatus("connected");
          } else if (state === ConnectionState.Disconnected) {
            setStatus("disconnected");
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (generationRef.current !== myGen) return;
          setStatus("disconnected");
        });

        room.on(RoomEvent.LocalTrackPublished, () => {
          if (generationRef.current !== myGen) return;
          syncMicFromRoom(room);
          if (isMicPublished(room)) {
            setMicError(null);
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          if (generationRef.current !== myGen) return;
          syncMicFromRoom(room);
        });

        room.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
          if (generationRef.current !== myGen) return;

          // Only act on our own permission changes.
          if (participant.identity !== room.localParticipant.identity) return;

          const perm = room.localParticipant.permissions;
          const nowCanPublish = perm?.canPublish === true;

          if (nowCanPublish && !isMicPublished(room)) {
            // Enable mic now that LiveKit has accepted our new publish permission.
            void attemptEnableMic(room, myGen);
          } else if (!nowCanPublish && room.localParticipant.isMicrophoneEnabled) {
            // Teacher revoked publish rights - disable mic and unpublish.
            room.localParticipant
              .setMicrophoneEnabled(false)
              .then(() => {
                if (generationRef.current === myGen) {
                  syncMicFromRoom(room);
                  setMicError(null);
                }
              })
              .catch((err) => console.warn("auto-disable mic after permission revoke failed:", err));
          }
        });

        // Connect. If a stale attempt reaches this point AND the room has
        // already been torn down by a newer attempt, `room.connect` will
        // throw - which is caught below and swallowed because we only
        // surface errors for the *current* generation.
        await room.connect(data.ws_url, data.token);

        // Double-check after connect: if a newer attempt has taken over,
        // clean up this now-stale room and bail.
        if (generationRef.current !== myGen) {
          try {
            await room.disconnect(true);
          } catch {
            // ignore
          }
          return;
        }

        // We are now the live room. Claim the ref.
        roomRef.current = room;
        setStatus("connected");
        setAudioPlaybackBlocked(!room.canPlaybackAudio);
        syncMicFromRoom(room);

        // Auto-enable mic for publishers once LiveKit grants publish permission.
        if (canPublishRef.current) {
          await attemptEnableMic(room, myGen);
        }
      } catch (connectErr) {
        // Only surface errors for the CURRENT attempt. Stale attempts that
        // fail because the room was torn down are expected and silent.
        if (generationRef.current !== myGen) return;
        if (tokenAbort.signal.aborted) return;

        if (axios.isAxiosError(connectErr)) {
          const httpStatus = connectErr.response?.status;
          if (httpStatus === 403) {
            setAccessBlock("forbidden");
            setError(null);
            setStatus("error");
            return;
          }
          if (httpStatus === 404) {
            setAccessBlock("not_live");
            setError(null);
            setStatus("error");
            return;
          }
        }

        console.error("LiveKit connection failed:", connectErr);
        setError(connectErr instanceof Error ? connectErr.message : String(connectErr));
        setStatus("error");
      }
    };

    void run();

    return () => {
      // Cleanup: bump generation to invalidate any in-flight attempt, abort
      // the token fetch, and tear down the live room (if any) without
      // blocking React. Because React can't await cleanup, we rely on the
      // generation check in the in-flight attempt to prevent it from
      // claiming the (now null) roomRef.
      // Bump generation in cleanup so async results that arrive post-unmount bail.
      generationRef.current += 1;
      tokenAbort.abort();
      void teardownCurrentRoom();
    };
    // sessionId and autoConnect drive full reconnects.
    // reconnectTrigger lets the reconnect() API force a fresh attempt.
    // canPublish is NOT in deps (see canPublishRef above).
  }, [sessionId, autoConnect, reconnectTrigger, teardownCurrentRoom, syncMicFromRoom, attemptEnableMic]);

  // Sync mic state with canPublish changes mid-session. Wait for LiveKit publish
  // permission before enabling; reconnect if the token is still listener-only.
  useEffect(() => {
    if (status !== "connected" || !roomRef.current) return;
    const room = roomRef.current;
    const wasCanPublish = prevCanPublishRef.current;
    prevCanPublishRef.current = canPublish;

    if (!wasCanPublish && canPublish) {
      if (hasLivekitPublishPermission(room)) {
        if (!isMicPublished(room)) {
          void attemptEnableMic(room, generationRef.current);
        }
      } else {
        const timer = window.setTimeout(() => {
          const currentRoom = roomRef.current;
          if (!currentRoom || !canPublishRef.current) return;
          if (hasLivekitPublishPermission(currentRoom)) {
            if (!isMicPublished(currentRoom)) {
              void attemptEnableMic(currentRoom, generationRef.current);
            }
            return;
          }
          setReconnectTrigger((n) => n + 1);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else if (wasCanPublish && !canPublish && isMicPublished(room)) {
      room.localParticipant
        .setMicrophoneEnabled(false)
        .then(() => {
          syncMicFromRoom(room);
          setMicError(null);
        })
        .catch((err) => console.warn("setMicrophoneEnabled(false) failed:", err));
    }
  }, [canPublish, status, attemptEnableMic, syncMicFromRoom]);

  // Clear remote audio and mic state when status transitions away from connected.
  useEffect(() => {
    if (status !== "connected") {
      setHasRemoteAudio(false);
      setAudioPlaybackBlocked(false);
      setIsMicEnabled(false);
      setMicError(null);
    }
  }, [status]);

  // Auto-retry connection after transient signal failures.
  useEffect(() => {
    if (!autoConnect || !sessionId) return;
    if (accessBlock) return;
    if (status !== "error" && status !== "disconnected") return;
    if (reconnectTimerRef.current) return;

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      setReconnectTrigger((n) => n + 1);
    }, 1200);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [status, autoConnect, sessionId, accessBlock]);

  const reconnect = useCallback(async () => {
    // Increment trigger to re-run the connect effect. Its cleanup will
    // tear down the current room first.
    setReconnectTrigger((n) => n + 1);
  }, []);

  const startAudio = useCallback(async () => {
    const r = roomRef.current;
    if (!r) {
      // If user explicitly taps and we don't currently have a room, force a reconnect attempt.
      setReconnectTrigger((n) => n + 1);
      return;
    }
    try {
      await r.startAudio();
      setAudioPlaybackBlocked(!r.canPlaybackAudio);
    } catch (startErr) {
      console.warn("startAudio failed:", startErr);
    }
  }, []);

  const clearMicError = useCallback(() => {
    setMicError(null);
  }, []);

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      const r = roomRef.current;
      if (!r) return;
      setMicError(null);

      if (enabled && !hasLivekitPublishPermission(r)) {
        setMicError("publish_denied");
        return;
      }

      try {
        await r.localParticipant.setMicrophoneEnabled(enabled);
        syncMicFromRoom(r);
        if (enabled && !isMicPublished(r)) {
          setMicError("publish_denied");
        }
      } catch (micErr) {
        if (enabled) {
          await resetLocalMic(r);
          syncMicFromRoom(r);
          setMicError(classifyMicError(micErr));
        } else {
          syncMicFromRoom(r);
        }
        console.warn("setMicrophoneEnabled failed:", micErr);
      }
    },
    [syncMicFromRoom],
  );

  return {
    status,
    error,
    accessBlock,
    room: roomRef.current,
    hasRemoteAudio,
    audioPlaybackBlocked,
    startAudio,
    isMicEnabled,
    micError,
    clearMicError,
    setMicEnabled,
    reconnect,
  };
}
