// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { PageCard } from "../layout/PageCard";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import {
  getShareLinkStatus,
  useRevokeShareLink,
  useShareLinks,
  type ShareLinkItem,
  type ShareTargetType,
} from "../../data/share";

interface ShareLinkListProps {
  targetType: ShareTargetType;
  targetId: string;
}

function statusBadgeClass(status: ReturnType<typeof getShareLinkStatus>): string {
  switch (status) {
    case "active":
      return "border-[#1B5E20]/30 bg-[#E8F5E9] text-[#1B5E20]";
    case "expired":
    case "limit":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "revoked":
      return "border-gray-200 bg-gray-50 text-[#6B7280]";
  }
}

function ShareLinkRow({
  link,
  onRevoke,
  revoking,
}: {
  link: ShareLinkItem;
  onRevoke: (link: ShareLinkItem) => void;
  revoking: boolean;
}) {
  const { t } = useTranslation();
  const { medium, mediumTime } = useLocaleDate();
  const status = getShareLinkStatus(link);
  const usesLeft =
    link.max_uses != null ? Math.max(0, link.max_uses - link.use_count) : null;

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-3 pe-3 text-sm text-[#1A1A1A]">{mediumTime(link.created_at)}</td>
      <td className="py-3 pe-3 text-sm text-[#6B7280]">{link.target_type}</td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.use_count}</td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.join_count}</td>
      <td className="py-3 pe-3">
        <Badge variant="outline" className={statusBadgeClass(status)}>
          {t(`share.status.${status}`)}
        </Badge>
        {usesLeft != null && status === "active" ? (
          <p className="mt-1 text-xs text-[#6B7280]">
            {usesLeft} / {link.max_uses}
          </p>
        ) : null}
        {link.expires_at ? (
          <p className="mt-1 text-xs text-[#6B7280]">{medium(link.expires_at)}</p>
        ) : null}
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

export function ShareLinkList({ targetType, targetId }: ShareLinkListProps) {
  const { t } = useTranslation();
  const linksQuery = useShareLinks(targetType, targetId);
  const revokeMutation = useRevokeShareLink(targetType, targetId);
  const [revokeTarget, setRevokeTarget] = useState<ShareLinkItem | null>(null);

  const links = linksQuery.data ?? [];

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeMutation.mutate(revokeTarget.id, {
      onSuccess: () => setRevokeTarget(null),
    });
  }

  return (
    <>
      <PageCard>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t("share.share")}</h2>
        {linksQuery.isPending ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
          </div>
        ) : links.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280]">{t("share.noLinks")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-start">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#6B7280]">
                  <th className="pb-2 pe-3 font-medium">{t("share.createdAt")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("share.linkType")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("share.opens")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("share.joins")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("rooms.status")}</th>
                  <th className="pb-2 text-end font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <ShareLinkRow
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
    </>
  );
}
