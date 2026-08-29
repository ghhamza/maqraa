// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, Plus, Radio, Repeat, type LucideIcon } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { InstantHalaqahPickerModal } from "./InstantHalaqahPickerModal";
import { SessionFormModal } from "./SessionFormModal";
import { useRoomsList } from "../../data/rooms";
import { useCreateInstantSession } from "../../data/sessions";
import { cn } from "@/lib/utils";

export interface NewSessionMenuProps {
  /** Button visual style. */
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Optional room preselected in the later/recurring form. */
  defaultRoomId?: string;
  /** Override the trigger label (defaults to newSession.button). */
  label?: string;
  /** Controlled open state for the modal (e.g. checklist / cockpit). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function IntentCard({
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-xl border border-[#E5E7EB] bg-white p-5 text-start transition hover:shadow-sm",
        "hover:border-[#1B5E20] hover:bg-[rgba(27,94,32,0.05)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E20]",
      )}
    >
      <Icon
        size={32}
        className="shrink-0 text-[#6B7280] transition group-hover:text-[#D4A843]"
        aria-hidden
      />
      <h2 className="mt-3 text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
    </button>
  );
}

export function NewSessionMenu({
  variant = "primary",
  size = "default",
  className,
  defaultRoomId,
  label,
  open: openProp,
  onOpenChange,
}: NewSessionMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultRepeat, setDefaultRepeat] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const roomsQuery = useRoomsList("new-session-menu", { active: true }, { staleTime: 60_000 });
  const rooms = roomsQuery.data ?? [];

  const instantMutation = useCreateInstantSession(
    (data) => {
      setPickerOpen(false);
      setInstantError(null);
      void navigate(`/sessions/${data.session_id}/live`);
    },
    (message, code) => {
      if (code === "room_required") {
        setPickerOpen(true);
        return;
      }
      setInstantError(message);
    },
  );

  function startInstant(roomId: string | null, createNew = false) {
    setInstantError(null);
    instantMutation.mutate({ room_id: roomId, create_new: createNew });
  }

  function handleInstantClick() {
    setOpen(false);
    setInstantError(null);
    if (rooms.length >= 2) {
      setPickerOpen(true);
      return;
    }
    startInstant(rooms.length === 1 ? rooms[0]!.id : null);
  }

  function openLater(repeat: boolean) {
    setOpen(false);
    setDefaultRepeat(repeat);
    setFormOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={instantMutation.isPending}
        className={cn(
          variant === "primary" && "shadow-md shadow-[var(--color-primary)]/25",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {label ?? t("newSession.button")}
        </span>
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("newSession.button")}
        contentClassName="max-w-md sm:max-w-md"
      >
        <div className="grid grid-cols-1 gap-4">
          <IntentCard
            icon={Radio}
            title={t("newSession.now")}
            description={t("newSession.nowDesc")}
            onSelect={handleInstantClick}
          />
          <IntentCard
            icon={CalendarClock}
            title={t("newSession.later")}
            description={t("newSession.laterDesc")}
            onSelect={() => openLater(false)}
          />
          <IntentCard
            icon={Repeat}
            title={t("newSession.recurring")}
            description={t("newSession.recurringDesc")}
            onSelect={() => openLater(true)}
          />
        </div>
        {instantError ? (
          <p className="mt-4 text-center text-sm text-red-600" role="alert">
            {instantError}
          </p>
        ) : null}
      </Modal>

      <InstantHalaqahPickerModal
        open={pickerOpen}
        rooms={rooms}
        loading={instantMutation.isPending}
        onClose={() => setPickerOpen(false)}
        onPick={(roomId) => startInstant(roomId)}
        onNewHalaqah={() => startInstant(null, true)}
      />

      <SessionFormModal
        open={formOpen}
        mode="create"
        session={null}
        defaultRoomId={defaultRoomId}
        defaultRepeat={defaultRepeat}
        onClose={() => setFormOpen(false)}
        onSaved={() => setFormOpen(false)}
      />
    </>
  );
}
