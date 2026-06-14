// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Link as LinkIcon, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/Badge";
import { roleTranslationKey } from "../../lib/roleLabels";
import { cn } from "@/lib/utils";
import type { User as AppUser } from "../../types";

function nameToInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  const w = parts[0] ?? trimmed;
  if (w.length <= 2) return w.toUpperCase();
  return w.slice(0, 2).toUpperCase();
}

function roleBadgeVariant(role: string): "green" | "blue" | "gold" {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

interface ProfileMenuProps {
  user: AppUser | null;
  showPendingDot: boolean;
  onLogout: () => void;
}

/** Inline profile menu — avoids portaled popper bugs with the sticky header on scroll. */
export function ProfileMenu({ user, showPendingDot, onLogout }: ProfileMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  function handleLogout() {
    setOpen(false);
    onLogout();
    navigate("/login", { replace: true });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative rounded-full outline-none ring-offset-background transition-opacity hover:opacity-95",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label={
          showPendingDot
            ? `${user?.name ?? t("common.appName")}. ${t("nav.pendingIndicator")}`
            : (user?.name ?? t("common.appName"))
        }
      >
        {showPendingDot ? (
          <span
            className="absolute end-0 top-0 z-10 size-2.5 rounded-full bg-destructive ring-2 ring-[var(--color-surface)]"
            aria-hidden
          />
        ) : null}
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {user?.name ? nameToInitials(user.name) : "?"}
          </AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-[200] mt-1.5 min-w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="px-1.5 py-2">
            <div className="flex flex-col gap-1.5 py-0.5">
              <span className="text-sm font-semibold text-foreground">{user?.name}</span>
              {user ? (
                <Badge variant={roleBadgeVariant(user.role)} className="w-fit">
                  {t(roleTranslationKey(user.role))}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          {showPendingDot ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => go("/rooms?pending=1")}
              >
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                {t("nav.pendingRequests")}
              </button>
              <div className="-mx-1 my-1 h-px bg-border" />
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => go("/profile")}
          >
            <User className="h-4 w-4 shrink-0" />
            {t("nav.profile")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => go("/settings")}
          >
            <LinkIcon className="h-4 w-4 shrink-0" />
            {t("settings.qf.title")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start text-sm text-destructive outline-none hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t("auth.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
