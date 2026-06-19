// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw, Trash2 } from "lucide-react";
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
  getInviteLinkStatus,
  useResendInvite,
  useRevokeShareLink,
  useShareLinks,
  type InviteLinkStatus,
  type ShareLinkItem,
} from "../../data/share";

interface InviteLinkListProps {
  roomId: string;
}

function inviteStatusBadgeClass(status: InviteLinkStatus): string {
  switch (status) {
    case "active":
      return "border-[#1B5E20]/30 bg-[#E8F5E9] text-[#1B5E20]";
    case "joined":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "revoked":
      return "border-gray-200 bg-gray-50 text-[#6B7280]";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

function inviteStatusLabel(status: InviteLinkStatus, t: (key: string) => string): string {
  if (status === "joined") return t("invite.status.joined");
  if (status === "active") return t("share.status.active");
  if (status === "revoked") return t("share.status.revoked");
  return t("share.status.expired");
}

function InviteRow({
  link,
  onRevoke,
  onResend,
  revoking,
  resending,
}: {
  link: ShareLinkItem;
  onRevoke: (link: ShareLinkItem) => void;
  onResend: (link: ShareLinkItem) => void;
  revoking: boolean;
  resending: boolean;
}) {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();
  const status = getInviteLinkStatus(link);

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-3 pe-3 text-sm text-[#1A1A1A]">{link.email_bound ?? "—"}</td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.use_count}</td>
      <td className="py-3 pe-3 text-sm tabular-nums">{link.join_count}</td>
      <td className="py-3 pe-3">
        <Badge variant="outline" className={inviteStatusBadgeClass(status)}>
          {inviteStatusLabel(status, t)}
        </Badge>
        <p className="mt-1 text-xs text-[#6B7280]">{mediumTime(link.created_at)}</p>
      </td>
      <td className="py-3 text-end">
        <div className="inline-flex items-center gap-1">
          {status === "active" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                loading={resending}
                aria-label={t("invite.resend")}
                onClick={() => onResend(link)}
              >
                <RotateCw className="h-4 w-4 text-[#1B5E20]" />
              </Button>
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
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function InviteLinkList({ roomId }: InviteLinkListProps) {
  const { t } = useTranslation();
  const linksQuery = useShareLinks("invite", roomId);
  const revokeMutation = useRevokeShareLink("invite", roomId);
  const resendMutation = useResendInvite(roomId);
  const [revokeTarget, setRevokeTarget] = useState<ShareLinkItem | null>(null);
  const [resentToast, setResentToast] = useState(false);

  const links = linksQuery.data ?? [];

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeMutation.mutate(revokeTarget.id, {
      onSuccess: () => setRevokeTarget(null),
    });
  }

  function handleResend(link: ShareLinkItem) {
    resendMutation.mutate(link.id, {
      onSuccess: () => {
        setResentToast(true);
        window.setTimeout(() => setResentToast(false), 2600);
      },
    });
  }

  return (
    <>
      <PageCard>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t("invite.invite")}</h2>
        {resentToast ? (
          <p className="mt-2 text-sm text-[#1B5E20]" role="status">
            {t("invite.resent")}
          </p>
        ) : null}
        {linksQuery.isPending ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
          </div>
        ) : links.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280]">{t("invite.noInvites")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-start">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#6B7280]">
                  <th className="pb-2 pe-3 font-medium">{t("auth.email")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("share.opens")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("share.joins")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("rooms.status")}</th>
                  <th className="pb-2 text-end font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <InviteRow
                    key={link.id}
                    link={link}
                    revoking={revokeMutation.isPending && revokeTarget?.id === link.id}
                    resending={resendMutation.isPending}
                    onRevoke={setRevokeTarget}
                    onResend={handleResend}
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
