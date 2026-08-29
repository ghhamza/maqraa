// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormSelect } from "../ui/select";
import { formatDatetimeLocalValue } from "../../lib/calendarUtils";
import { useAuthStore } from "../../stores/authStore";
import { useRoomsList } from "../../data/rooms";
import { useCreateSession, useUpdateSession } from "../../data/sessions";

/** Sentinel: POST sessions with room_id null → backend auto-creates a halaqah. */
export const SESSION_FORM_AUTO_ROOM = "__auto__";

export interface SessionFormProps {
  mode: "create" | "edit";
  session: SessionPublic | null;
  defaultRoomId?: string;
  lockedRoomId?: string;
  /** Display name when {@link lockedRoomId} is set (wizard after room create). */
  lockedRoomName?: string;
  /** Override create-mode title (defaults to lockedRoomName). */
  defaultTitle?: string;
  defaultDatetime?: Date | null;
  presetMorningStart?: boolean;
  /** When true, open the create form with repeat toggled on. */
  defaultRepeat?: boolean;
  editScope?: "this" | "this_and_future" | "all";
  active: boolean;
  formId?: string;
  showFooter?: boolean;
  onCancel?: () => void;
  onSuccess: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function SessionForm({
  mode,
  session,
  defaultRoomId,
  lockedRoomId,
  lockedRoomName,
  defaultTitle,
  defaultDatetime,
  presetMorningStart,
  defaultRepeat = false,
  editScope,
  active,
  formId,
  showFooter = true,
  onCancel,
  onSuccess,
  onPendingChange,
}: SessionFormProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [roomId, setRoomId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [title, setTitle] = useState("");
  const [datetimeLocal, setDatetimeLocal] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatEndMode, setRepeatEndMode] = useState<"weeks" | "date">("weeks");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const effectiveDefaultRoomId = lockedRoomId ?? defaultRoomId;

  useEffect(() => {
    if (!active) return;
    setError(null);
    if (mode === "edit" && session) {
      setRoomId(session.room_id);
      setGroupName("");
      setTitle(session.title ?? "");
      setDatetimeLocal(formatDatetimeLocalValue(new Date(session.scheduled_at)));
      setDuration(session.duration_minutes);
      setNotes(session.notes ?? "");
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatWeeks(4);
      setRepeatEndMode("weeks");
      setRepeatEndDate("");
      setCreatedCount(null);
    } else {
      const dt = defaultDatetime ? new Date(defaultDatetime) : new Date();
      if (presetMorningStart) {
        dt.setHours(9, 0, 0, 0);
      } else if (!defaultDatetime) {
        // datetime-local has no seconds — ceil so "now" isn't already in the past on submit.
        dt.setSeconds(0, 0);
        if (dt.getTime() <= Date.now()) {
          dt.setMinutes(dt.getMinutes() + 1);
        }
      }
      setRoomId(effectiveDefaultRoomId ?? "");
      setGroupName("");
      setTitle((defaultTitle ?? lockedRoomName)?.trim() ?? "");
      setDatetimeLocal(formatDatetimeLocalValue(dt));
      setDuration(60);
      setNotes("");
      setRepeatEnabled(defaultRepeat);
      setRepeatDays([]);
      setRepeatWeeks(4);
      setRepeatEndMode("weeks");
      setRepeatEndDate("");
      setCreatedCount(null);
    }
  }, [
    active,
    mode,
    session,
    effectiveDefaultRoomId,
    defaultDatetime,
    presetMorningStart,
    lockedRoomName,
    defaultTitle,
    defaultRepeat,
  ]);

  const roomsQuery = useRoomsList("session-form", { active: true }, {
    enabled: active && !lockedRoomId,
    staleTime: 5 * 60_000,
  });

  const rooms = roomsQuery.data ?? [];
  const loadingRooms = roomsQuery.isPending && active;
  const hideRoomSelect = mode === "create" && !lockedRoomId && !loadingRooms && rooms.length === 0;
  const isAutoRoom = roomId === SESSION_FORM_AUTO_ROOM;
  const showGroupName = mode === "create" && isAutoRoom && repeatEnabled;

  useEffect(() => {
    if (!active || mode === "edit") return;
    if (lockedRoomId) {
      setRoomId(lockedRoomId);
      return;
    }
    if (loadingRooms) return;
    setRoomId((prev) => {
      if (rooms.length === 0) return SESSION_FORM_AUTO_ROOM;
      if (prev === SESSION_FORM_AUTO_ROOM) return prev;
      if (prev && rooms.some((r) => r.id === prev)) return prev;
      if (effectiveDefaultRoomId && rooms.some((r) => r.id === effectiveDefaultRoomId)) {
        return effectiveDefaultRoomId;
      }
      if (rooms.length === 1) return rooms[0]!.id;
      // Several rooms: require an explicit choice (keep empty unless already set).
      return "";
    });
  }, [active, mode, rooms, effectiveDefaultRoomId, lockedRoomId, loadingRooms]);

  useEffect(() => {
    if (!repeatEnabled || !datetimeLocal) return;
    const d = new Date(datetimeLocal);
    const day = d.getDay();
    const mondayBased = day === 0 ? 6 : day - 1;
    setRepeatDays((prev) => (prev.includes(mondayBased) ? prev : [...prev, mondayBased]));
  }, [repeatEnabled, datetimeLocal]);

  type CreatePayload = Record<string, unknown>;
  const createMutation = useCreateSession(
    (data) => {
      if (data.count > 1) {
        setCreatedCount(data.count);
        setTimeout(() => {
          onSuccess();
          setCreatedCount(null);
        }, 1500);
        return;
      }
      onSuccess();
    },
    (message) => setError(message),
  );

  const updateMutation = useUpdateSession(
    () => onSuccess(),
    (message) => setError(message),
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const roomPickerDisabled = mode === "edit" || loadingRooms || Boolean(lockedRoomId);

  useEffect(() => {
    onPendingChange?.(loading);
  }, [loading, onPendingChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const effectiveRoomId = lockedRoomId ?? roomId;
    if (!effectiveRoomId) {
      setError(t("errors.badRequest"));
      return;
    }

    const scheduled = new Date(datetimeLocal);
    if (Number.isNaN(scheduled.getTime())) {
      setError(t("errors.badRequest"));
      return;
    }
    if (duration <= 0) {
      setError(t("errors.badRequest"));
      return;
    }
    const allowPastAnchor = mode === "create" && repeatEnabled && repeatDays.length > 0;
    // Allow ~2 minutes of slack: datetime-local truncates seconds, so "now" can look past.
    const pastGraceMs = 2 * 60 * 1000;
    if (
      mode === "create" &&
      scheduled.getTime() < Date.now() - pastGraceMs &&
      !allowPastAnchor
    ) {
      setError(t("sessions.pastDate"));
      return;
    }
    if (mode === "create" && repeatEnabled && repeatDays.length > 0) {
      if (repeatEndMode === "date" && !repeatEndDate.trim()) {
        setError(t("errors.badRequest"));
        return;
      }
    }

    setError(null);
    setCreatedCount(null);
    const iso = scheduled.toISOString();

    if (mode === "create") {
      const auto = effectiveRoomId === SESSION_FORM_AUTO_ROOM;
      const payload: CreatePayload = {
        room_id: auto ? null : effectiveRoomId,
        title: title.trim() || null,
        scheduled_at: iso,
        duration_minutes: duration,
        notes: notes.trim() || null,
        group_name: auto && repeatEnabled ? groupName.trim() || null : null,
      };

      if (repeatEnabled && repeatDays.length > 0) {
        payload.repeat_days = [...repeatDays].sort((a, b) => a - b);
        if (repeatEndMode === "weeks") {
          payload.repeat_weeks = Math.max(1, Math.min(12, repeatWeeks));
        } else if (repeatEndDate) {
          payload.repeat_end_date = new Date(`${repeatEndDate}T23:59:59`).toISOString();
        }
      }

      createMutation.mutate(payload);
    } else if (session) {
      const bodyBase = {
        title: title.trim() || null,
        duration_minutes: duration,
        notes: notes.trim() || null,
      };
      const gid = session.recurrence_group_id;
      const scope =
        gid && editScope && editScope !== "this" ? editScope : ("this" as const);

      updateMutation.mutate({ session, bodyBase, iso, scope });
    }
  }

  const roomOptions = loadingRooms
    ? [{ value: "", label: t("common.loading") }]
    : [
        { value: SESSION_FORM_AUTO_ROOM, label: t("sessionForm.autoHalaqah") },
        ...rooms.map((r) => ({ value: r.id, label: r.name })),
      ];

  const defaultGroupPlaceholder = t("sessionForm.groupNamePlaceholder", {
    name: user?.name?.trim() || "—",
  });

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {!hideRoomSelect ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-room">
            {t("sessions.room")}
          </label>
          {lockedRoomId ? (
            <p
              id="session-room"
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[var(--color-text)]"
            >
              {lockedRoomName ?? lockedRoomId}
            </p>
          ) : (
            <FormSelect
              id="session-room"
              triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm text-[var(--color-text)]"
              triggerStyle={{ color: "var(--color-text)" }}
              value={roomId}
              onValueChange={setRoomId}
              disabled={roomPickerDisabled}
              required
              options={roomOptions}
            />
          )}
        </div>
      ) : null}
      {showGroupName ? (
        <Input
          label={t("sessionForm.groupName")}
          name="group_name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder={defaultGroupPlaceholder}
        />
      ) : null}
      <Input
        label={t("sessions.sessionTitle")}
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("sessions.sessionTitlePlaceholder")}
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-when">
          {t("sessions.date")} / {t("sessions.time")}
        </label>
        <input
          id="session-when"
          type="datetime-local"
          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base text-[var(--color-text)] md:text-sm"
          value={datetimeLocal}
          onChange={(e) => setDatetimeLocal(e.target.value)}
          required
        />
      </div>
      {mode === "create" ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="switch"
              aria-checked={repeatEnabled}
              tabIndex={0}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                repeatEnabled ? "bg-[var(--color-primary)]" : "bg-gray-300"
              }`}
              onClick={() => setRepeatEnabled(!repeatEnabled)}
              onKeyDown={(e) => e.key === "Enter" && setRepeatEnabled(!repeatEnabled)}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  repeatEnabled
                    ? "ltr:translate-x-5 rtl:-translate-x-5"
                    : "ltr:translate-x-0.5 rtl:-translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm font-medium text-[var(--color-text)]">{t("sessions.repeat")}</span>
          </label>

          {repeatEnabled ? (
            <div className="space-y-3 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4">
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("sessions.repeatOn")}</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const selected = repeatDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setRepeatDays((prev) =>
                            selected ? prev.filter((d) => d !== day) : [...prev, day],
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          selected
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-gray-200 bg-white text-[var(--color-text)]"
                        }`}
                      >
                        {t(`sessions.day${day}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--color-text)]">{t("sessions.repeatEnds")}</p>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="repeat-end"
                      checked={repeatEndMode === "weeks"}
                      onChange={() => setRepeatEndMode("weeks")}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>{t("sessions.afterWeeks")}</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={repeatWeeks}
                      onChange={(e) => setRepeatWeeks(Number(e.target.value) || 4)}
                      disabled={repeatEndMode !== "weeks"}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm"
                    />
                    <span className="text-[var(--color-text-muted)]">{t("sessions.weeksLabel")}</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="repeat-end"
                      checked={repeatEndMode === "date"}
                      onChange={() => setRepeatEndMode("date")}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>{t("sessions.untilDate")}</span>
                    <input
                      type="date"
                      value={repeatEndDate}
                      onChange={(e) => setRepeatEndDate(e.target.value)}
                      disabled={repeatEndMode !== "date"}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Input
        label={t("sessions.duration")}
        name="duration"
        type="number"
        min={1}
        value={String(duration)}
        onChange={(e) => setDuration(Number(e.target.value) || 60)}
        required
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-notes">
          {t("sessions.notes")}
        </label>
        <textarea
          id="session-notes"
          className="min-h-[88px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-base text-[var(--color-text)] md:text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>
      {createdCount ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-[var(--color-primary)]">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {t("sessions.createdCount", { count: createdCount })}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showFooter ? (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            className="sm:w-auto"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            className="sm:w-auto"
            disabled={loading || (!lockedRoomId && !roomId)}
          >
            {loading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
