// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, ChevronsUpDown, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import { roleTranslationKey } from "../../lib/roleLabels";
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

/** shadcn-style user block for `SidebarFooter`. */
export function ProfileMenu({ user, showPendingDot, onLogout }: ProfileMenuProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const isRtl = (i18n.language || "ar").split("-")[0] === "ar";

  function go(path: string) {
    if (isMobile) setOpenMobile(false);
    navigate(path);
  }

  function handleLogout() {
    if (isMobile) setOpenMobile(false);
    onLogout();
    navigate("/login", { replace: true });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user?.name ?? t("nav.profile")}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              aria-label={
                showPendingDot
                  ? `${user?.name ?? t("common.appName")}. ${t("nav.pendingIndicator")}`
                  : (user?.name ?? t("common.appName"))
              }
            >
              <span className="relative">
                {showPendingDot ? (
                  <span
                    className="absolute -end-0.5 -top-0.5 z-10 size-2.5 rounded-full bg-destructive ring-2 ring-sidebar"
                    aria-hidden
                  />
                ) : null}
                <Avatar className="size-8 rounded-lg border border-sidebar-border">
                  <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {user?.name ? nameToInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              </span>
              <span className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{user?.name}</span>
                {user ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {t(roleTranslationKey(user.role))}
                  </span>
                ) : null}
              </span>
              {!collapsed ? <ChevronsUpDown className="ms-auto size-4 opacity-60" /> : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 min-w-56 rounded-lg"
            side={isMobile ? "bottom" : isRtl ? "left" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="size-8 rounded-lg border border-border">
                  <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {user?.name ? nameToInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name}</span>
                  {user ? (
                    <Badge variant={roleBadgeVariant(user.role)} className="mt-1 w-fit">
                      {t(roleTranslationKey(user.role))}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {showPendingDot ? (
              <>
                <DropdownMenuItem onClick={() => go("/rooms?pending=1")}>
                  <Bell />
                  {t("nav.pendingRequests")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => go("/profile")}>
              <User />
              {t("nav.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
