// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import type { UserPublic } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { UserFormModal } from "../../components/users/UserFormModal";
import { DeleteConfirmModal } from "../../components/users/DeleteConfirmModal";
import { UserCommunicationSection } from "../../components/users/UserCommunicationSection";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { ProfileDetailsSummary } from "../../components/profile/ProfileDetailsSummary";
import { roleTranslationKey } from "../../lib/roleLabels";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { useUser } from "../../data/users";

type RoleBadge = "green" | "blue" | "gold";

function badgeVariant(role: UserPublic["role"]): RoleBadge {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

export function UserDetailPage() {
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const userQuery = useUser(id);

  const user = userQuery.data ?? null;
  const loading = userQuery.isPending;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <PageShell title={t("users.userNotFound")}>
        <PageCard className="text-center">
          <p className="text-[var(--color-text-muted)]">{t("users.userNotFound")}</p>
          <Link to="/users" className="mt-4 inline-block text-[var(--color-primary)]">
            {t("users.backToList")}
          </Link>
        </PageCard>
      </PageShell>
    );
  }

  return (
    <PageShell
      backTo={{ to: "/users", label: t("users.backToList") }}
      breadcrumb={[
        { label: t("users.title"), to: "/users" },
        { label: user.name },
      ]}
      title={user.name}
      description={user.email}
      titleAside={<Badge variant={badgeVariant(user.role)}>{t(roleTranslationKey(user.role))}</Badge>}
      meta={`${t("users.registrationDate")}: ${full(user.created_at)}`}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </span>
          </Button>
          <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
            <span className="inline-flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </span>
          </Button>
        </>
      }
    >
      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("users.personalDetails")}</h2>
        <ProfileDetailsSummary user={user} />
      </PageCard>

      {user.role === "teacher" ? <UserCommunicationSection userId={user.id} /> : null}

      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("users.integrations")}</h2>
        <dl className="space-y-3">
          <div className="grid gap-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-[var(--color-text-muted)]">{t("settings.qf.title")}</dt>
            <dd className="text-sm text-[var(--color-text)]">
              {user.qf_linked ? (
                <span>
                  {t("users.qfLinked")}
                  {user.qf_email ? (
                    <span className="mt-0.5 block text-[var(--color-text-muted)]">{user.qf_email}</span>
                  ) : null}
                </span>
              ) : (
                t("users.qfNotLinked")
              )}
            </dd>
          </div>
        </dl>
      </PageCard>

      <UserFormModal
        open={formOpen}
        mode="edit"
        user={user}
        onClose={() => setFormOpen(false)}
        onSaved={() => void userQuery.refetch()}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        userId={user.id}
        userName={user.name}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/users", { replace: true })}
      />
    </PageShell>
  );
}
