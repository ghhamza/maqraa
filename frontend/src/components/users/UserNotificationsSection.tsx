// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, RotateCcw } from "lucide-react";
import type { NotificationStatus, UserNotificationItem } from "../../types";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { useResendUserNotification, useUserNotifications } from "../../data/users";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageCard } from "../layout/PageCard";
import { Table, type TableColumn } from "../ui/Table";

interface UserNotificationsSectionProps {
  userId: string;
}

function statusBadgeVariant(status: NotificationStatus): "green" | "blue" | "gold" | "gray" {
  switch (status) {
    case "sent":
      return "green";
    case "queued":
    case "sending":
      return "blue";
    case "failed":
      return "gold";
    default:
      return "gray";
  }
}

export function UserNotificationsSection({ userId }: UserNotificationsSectionProps) {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const notificationsQuery = useUserNotifications(userId);
  const resendMutation = useResendUserNotification(userId, (message) => setResendError(message));

  const columns: TableColumn<UserNotificationItem>[] = useMemo(
    () => [
      {
        key: "template",
        header: t("users.notifications.template"),
        render: (row) => (
          <div className="min-w-[10rem]">
            <p className="font-medium text-[var(--color-text)]">
              {t(`users.notifications.templates.${row.template_key}`, {
                defaultValue: row.template_key,
              })}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">{row.subject}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: t("users.notifications.status"),
        render: (row) => (
          <Badge variant={statusBadgeVariant(row.status)}>
            {t(`users.notifications.statuses.${row.status}`)}
          </Badge>
        ),
      },
      {
        key: "locale",
        header: t("users.notifications.locale"),
        render: (row) => t(`language.${row.locale}`, { defaultValue: row.locale }),
      },
      {
        key: "lastSent",
        header: t("users.notifications.lastSent"),
        render: (row) => (row.sent_at ? mediumTime(row.sent_at) : "—"),
      },
      {
        key: "created",
        header: t("users.notifications.created"),
        render: (row) => mediumTime(row.created_at),
      },
      {
        key: "actions",
        header: t("common.actions"),
        className: "text-end",
        render: (row) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={row.status === "sending" || resendingId === row.id}
              loading={resendingId === row.id}
              title={
                row.status === "sending"
                  ? t("users.notifications.resendSending")
                  : t("users.notifications.resend")
              }
              onClick={() => {
                if (row.status === "sending" || resendingId) return;
                setResendError(null);
                setResendingId(row.id);
                resendMutation.mutate(row.id, {
                  onSettled: () => setResendingId(null),
                });
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("users.notifications.resend")}
              </span>
            </Button>
          </div>
        ),
      },
    ],
    [t, mediumTime, resendingId, resendMutation],
  );

  return (
    <PageCard>
      <h2 className="mb-1 text-lg font-semibold text-[var(--color-text)]">{t("users.notifications.title")}</h2>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("users.notifications.description")}</p>

      {notificationsQuery.isPending ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : notificationsQuery.isError ? (
        <p className="text-sm text-red-600">{t("users.notifications.loadError")}</p>
      ) : (
        <Table
          columns={columns}
          data={notificationsQuery.data ?? []}
          rowKey={(row) => row.id}
          emptyMessage={t("users.notifications.empty")}
          emptyIcon={<Mail className="h-10 w-10" aria-hidden />}
        />
      )}

      {resendError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {resendError}
        </p>
      ) : null}
    </PageCard>
  );
}
