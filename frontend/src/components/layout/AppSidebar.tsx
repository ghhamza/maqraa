// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, type ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  BookOpen,
  Calendar,
  DoorOpen,
  Home,
  Link2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "../ui/sidebar";
import { ProfileMenu } from "./ProfileMenu";
import type { User } from "../../types";

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
};

function NavMenuItems({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            asChild
            isActive={item.active}
            tooltip={item.label}
            className={cn(
              item.active &&
                "bg-primary/25 font-semibold text-primary data-[active=true]:bg-primary/25 data-[active=true]:text-primary",
            )}
          >
            <NavLink to={item.to} end={item.end} onClick={onNavigate}>
              <item.icon className="opacity-80" aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar({
  side,
  dir,
  user,
  showPendingDot,
  onLogout,
}: {
  side: "left" | "right";
  dir?: "ltr" | "rtl";
  user: User | null;
  showPendingDot: boolean;
  onLogout: () => void;
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const isAdmin = user?.role === "admin";
  const localeBase = (i18n.language || "ar").split("-")[0] ?? "ar";
  const logoSrc = localeBase === "ar" ? "/logo-ar.svg" : "/logo.svg";
  const collapsed = state === "collapsed" && !isMobile;
  const markSrc = collapsed ? "/logo-icon.svg" : logoSrc;

  const navActive = useMemo(() => {
    const p = location.pathname;
    return {
      home: p === "/" || p === "",
      users: p.startsWith("/users"),
      analytics: p.startsWith("/admin/dashboard"),
      invites: p.startsWith("/admin/invites"),
      rooms: p.startsWith("/rooms"),
      sessions: p === "/calendar",
      recitations: p === "/recitations",
    };
  }, [location.pathname]);

  const teachingItems: NavItem[] = [
    { to: "/", end: true, label: t("nav.home"), icon: Home, active: navActive.home },
    { to: "/rooms", label: t("nav.rooms"), icon: DoorOpen, active: navActive.rooms },
    {
      to: "/calendar",
      label: t("nav.sessions"),
      icon: Calendar,
      active: navActive.sessions,
    },
    {
      to: "/recitations",
      label: t("nav.recitations"),
      icon: BookOpen,
      active: navActive.recitations,
    },
  ];

  const adminItems: NavItem[] = [
    { to: "/users", label: t("nav.users"), icon: Users, active: navActive.users },
    {
      to: "/admin/dashboard",
      label: t("admin.dashboard.nav"),
      icon: BarChart3,
      active: navActive.analytics,
    },
    {
      to: "/admin/invites",
      label: t("nav.instanceInvites"),
      icon: Link2,
      active: navActive.invites,
    },
  ];

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar side={side} dir={dir} collapsible="icon" variant="sidebar">
      <SidebarHeader className="flex h-14 shrink-0 flex-row items-center px-2 py-0">
        <NavLink
          to="/"
          end
          onClick={closeMobile}
          className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:px-0"
          aria-label={t("common.appName")}
        >
          <img
            src={markSrc}
            alt=""
            decoding="async"
            className={cn(
              "object-contain object-start",
              collapsed ? "size-7" : "h-7 w-auto max-w-[min(100%,11rem)]",
            )}
          />
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavMenuItems items={teachingItems} onNavigate={closeMobile} />
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin ? (
          <SidebarGroup className="border-t border-black/5 pt-0">
            <p
              className={cn(
                "px-3 pt-4 pb-1 text-xs uppercase tracking-wide text-[#6B7280]",
                "group-data-[collapsible=icon]:hidden",
              )}
            >
              {t("nav.groupAdmin")}
            </p>
            <SidebarGroupContent>
              <NavMenuItems items={adminItems} onNavigate={closeMobile} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <ProfileMenu user={user} showPendingDot={showPendingDot} onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
