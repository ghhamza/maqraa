// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Trash2 } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { PageCard } from "../../components/layout/PageCard";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ShareButton } from "../../components/share/ShareButton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import {
  getShareLinkStatus,
  useCreateShareLink,
  useInstanceLinks,
  useRevokeShareLink,
  type ShareLinkItem,
  type ShareLinkStatus,
} from "../../data/share";

function statusBadgeClass(status: ShareLinkStatus): string {
  switch (status) {
    case "active":
      return "border-[#1B5E20]/30 bg-[#E8F5E9] text-[#1B5E20]";
    case "revoked":
      return "border-gray-200 bg-gray-50 text-[#6B7280]";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "limit":
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

function statusLabel(status: ShareLinkStatus, t: (key: string) => string): string {
  if (status === "active") return t("share.status.active");
  if (status === "revoked") return t("share.status.revoked");
  if (status === "expired") return t("share.status.expired");
  return t("share.status.limit");
}

function InstanceLinkRow({
  link,
  onRevoke,
  revoking,
}: {
  link: ShareLinkItem;
  onRevoke: (link: ShareLinkItem) => void;
  revoking: boolean;
}) {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();
  const status = getShareLinkStatus(link);

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="max-w-[12rem] truncate py-3 pe-3 font-mono text-xs text-[#1A1A1A] sm:max-w-xs">
        {link.share_url}
      </td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.use_count}</td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.join_count}</td>
      <td className="py-3 pe-3">
        <Badge variant="outline" className={statusBadgeClass(status)}>
          {statusLabel(status, t)}
        </Badge>
        <p className="mt-1 text-xs text-[#6B7280]">{mediumTime(link.created_at)}</p>
      </td>
      <td className="py-3 text-end">
        {status === "active" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            loading={revoking}
            aria-label={t("share.revoke")}
            onClick={() => onRevoke(link)}
          >
            <Trash2 className="h-4 w-4 text-red-700" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function InstanceInvitesPage() {
  const { t } = useTranslation();
  const linksQuery = useInstanceLinks();
  const createMutation = useCreateShareLink("instance");
  const revokeMutation = useRevokeShareLink("instance");
  const [revokeTarget, setRevokeTarget] = useState<ShareLinkItem | null>(null);

  const links = linksQuery.data ?? [];

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeMutation.mutate(revokeTarget.id, {
      onSuccess: () => setRevokeTarget(null),
    });
  }

  return (
    <PageShell title={t("instanceInvite.title")} description={t("instanceInvite.subtitle")}>
      <PageCard className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            loading={createMutation.isPending}
            onClick={() => void createMutation.mutateAsync({})}
          >
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t("instanceInvite.generate")}
            </span>
          </Button>
          <ShareButton
            targetType="instance"
            displayName={t("common.appName")}
            existingOnly
          />
        </div>
      </PageCard>

      <PageCard>
        {linksQuery.isPending ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-full w-full" />}
            title={t("instanceInvite.noLinks")}
            description={t("instanceInvite.subtitle")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-start">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#6B7280]">
                  <th className="pb-2 pe-3 font-medium">{t("share.copy")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("instanceInvite.opens")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("instanceInvite.joins")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("rooms.status")}</th>
                  <th className="pb-2 text-end font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <InstanceLinkRow
                    key={link.id}
                    link={link}
                    revoking={revokeMutation.isPending && revokeTarget?.id === link.id}
                    onRevoke={setRevokeTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("share.revoke")}</AlertDialogTitle>
            <AlertDialogDescription>{t("share.revokeConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRevokeTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={revokeMutation.isPending}
              onClick={() => confirmRevoke()}
            >
              {t("share.revoke")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
