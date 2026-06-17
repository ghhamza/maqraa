// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import type { UserPublic } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, type TableColumn } from "../../components/ui/Table";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { UserFormModal } from "../../components/users/UserFormModal";
import { DeleteConfirmModal } from "../../components/users/DeleteConfirmModal";
import { roleTranslationKey } from "../../lib/roleLabels";
import { useSendSessionGuide, useUsersList, useUsersStats } from "../../data/users";

type RoleFilter = "" | "student" | "teacher" | "admin";

function badgeVariant(role: UserPublic["role"]): "green" | "blue" | "gold" {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

export function UsersPage() {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserPublic | null>(null);

  const [guideToast, setGuideToast] = useState<"success" | "error" | null>(null);
  const [sendingGuideId, setSendingGuideId] = useState<string | null>(null);
  const [guideCooldown, setGuideCooldown] = useState<Set<string>>(() => new Set());

  const sendGuideMutation = useSendSessionGuide(
    () => setGuideToast("success"),
    () => setGuideToast("error"),
  );

  useEffect(() => {
    if (!guideToast) return;
    const tm = window.setTimeout(() => setGuideToast(null), 5000);
    return () => clearTimeout(tm);
  }, [guideToast]);

  const handleSendSessionGuide = useCallback(
    (teacherId: string) => {
      if (sendingGuideId || guideCooldown.has(teacherId)) return;
      setSendingGuideId(teacherId);
      sendGuideMutation.mutate(teacherId, {
        onSuccess: () => {
          setGuideCooldown((prev) => new Set(prev).add(teacherId));
          window.setTimeout(() => {
            setGuideCooldown((prev) => {
              const next = new Set(prev);
              next.delete(teacherId);
              return next;
            });
          }, 30_000);
        },
        onSettled: () => setSendingGuideId(null),
      });
    },
    [sendGuideMutation, sendingGuideId, guideCooldown],
  );

  const usersQuery = useUsersList(debouncedSearch, roleFilter);
  const statsQuery = useUsersStats();

  const users = usersQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const loading = usersQuery.isPending && !usersQuery.isPlaceholderData;

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingUser(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((u: UserPublic) => {
    setFormMode("edit");
    setEditingUser(u);
    setFormOpen(true);
  }, []);

  const openDelete = useCallback((u: UserPublic) => {
    setDeleteTarget(u);
    setDeleteOpen(true);
  }, []);

  const hasFilters = useMemo(
    () => debouncedSearch.trim() !== "" || roleFilter !== "",
    [debouncedSearch, roleFilter],
  );

  const clearUserFilters = useCallback(() => {
    setSearch("");
    setRoleFilter("");
  }, []);

  const columns: TableColumn<UserPublic>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("users.name"),
        render: (row) => (
          <Link to={`/users/${row.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            {row.name}
          </Link>
        ),
      },
      { key: "email", header: t("users.email"), render: (row) => row.email },
      {
        key: "role",
        header: t("users.role"),
        render: (row) => (
          <Badge variant={badgeVariant(row.role)}>{t(roleTranslationKey(row.role))}</Badge>
        ),
      },
      {
        key: "created_at",
        header: t("users.registrationDate"),
        render: (row) => mediumTime(row.created_at),
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {row.role === "teacher" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#D4A843] hover:bg-[#D4A843]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t("users.sessionGuide.button")}
                    disabled={
                      sendingGuideId === row.id ||
                      guideCooldown.has(row.id) ||
                      sendGuideMutation.isPending
                    }
                    onClick={() => handleSendSessionGuide(row.id)}
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="max-w-xs text-start">
                  {t("users.sessionGuide.description")}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
              aria-label={t("common.edit")}
              onClick={() => openEdit(row)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
              aria-label={t("common.delete")}
              onClick={() => openDelete(row)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [
      t,
      mediumTime,
      openEdit,
      openDelete,
      handleSendSessionGuide,
      sendingGuideId,
      guideCooldown,
      sendGuideMutation.isPending,
    ],
  );

  const statsRow = stats ? (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[
        { label: t("home.totalUsers"), value: stats.total },
        { label: t("home.students"), value: stats.students },
        { label: t("home.teachers"), value: stats.teachers },
        { label: t("home.admins"), value: stats.admins },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm"
        >
          <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <PageShell
      stats={statsRow}
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("users.title") },
      ]}
      title={t("users.title")}
      actions={
        <Button type="button" variant="primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("users.addUser")}
          </span>
        </Button>
      }
    >
      <PageCard>
        <Input
          label={t("common.search")}
          name="search"
          placeholder={t("users.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {(
            [
              ["", t("users.tabsAll")],
              ["student", t("users.tabsStudents")],
              ["teacher", t("users.tabsTeachers")],
              ["admin", t("users.tabsAdmins")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setRoleFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                roleFilter === value
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-[var(--color-text-muted)] hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PageCard>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : users.length === 0 && !hasFilters ? (
        <EmptyState
          icon={<Users className="h-14 w-14" />}
          title={t("users.emptyTitle")}
          description={t("users.emptyDescription")}
        />
      ) : users.length === 0 && hasFilters ? (
        <EmptyState
          icon={<Users className="h-14 w-14" />}
          title={t("users.noMatchesTitle")}
          description={t("users.noMatchesDescription")}
          primaryAction={{ label: t("rooms.clearFilters"), onClick: clearUserFilters }}
        />
      ) : (
        <Table columns={columns} data={users} rowKey={(r) => r.id} emptyMessage="" />
      )}

      <UserFormModal
        open={formOpen}
        mode={formMode}
        user={editingUser}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          // No-op: UserFormModal's mutation invalidates userKeys.lists() / .stats()
          // Keep the prop for now; remove from the modal's API in a later cleanup.
        }}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        userId={deleteTarget?.id ?? null}
        userName={deleteTarget?.name ?? ""}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onDeleted={() => {
          // No-op: DeleteConfirmModal's mutation invalidates userKeys.lists() / .stats()
        }}
      />

      {guideToast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border-2 p-4 shadow-lg md:left-auto md:right-6 md:top-24 ${
            guideToast === "success"
              ? "border-[var(--color-primary)]/40 bg-[#E8F5E9] text-[var(--color-primary)]"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-semibold">
            {guideToast === "success"
              ? t("users.sessionGuide.success")
              : t("users.sessionGuide.error")}
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}
