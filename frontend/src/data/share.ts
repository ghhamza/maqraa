// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { shareKeys } from "../lib/queryKeys";
import { useApiMutation } from "../lib/useApiMutation";

export type ShareTargetType = "halaqah" | "session" | "invite" | "instance";

function shareListTargetId(targetType: ShareTargetType, targetId?: string): string {
  return targetType === "instance" ? "" : (targetId ?? "");
}

function shareListEnabled(targetType: ShareTargetType, targetId?: string, enabled = true): boolean {
  if (!enabled) return false;
  return targetType === "instance" || !!targetId;
}

export interface ShareLinkItem {
  id: string;
  token: string;
  share_url: string;
  target_type: string;
  target_id: string | null;
  use_count: number;
  join_count: number;
  revoked_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  email_bound: string | null;
  auto_approve: boolean;
  created_at: string;
}

export type ShareLinkStatus = "active" | "expired" | "revoked" | "limit";

export type InviteLinkStatus = "active" | "joined" | "revoked" | "expired";

export function getShareLinkStatus(link: ShareLinkItem): ShareLinkStatus {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.max_uses != null && link.use_count >= link.max_uses) return "limit";
  return "active";
}

export function getInviteLinkStatus(link: ShareLinkItem): InviteLinkStatus {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.join_count > 0 || (link.max_uses != null && link.use_count >= link.max_uses)) {
    return "joined";
  }
  return "active";
}

export function findActiveShareLink(links: ShareLinkItem[] | undefined): ShareLinkItem | null {
  if (!links?.length) return null;
  return links.find((l) => getShareLinkStatus(l) === "active") ?? null;
}

/** Prefer the default reusable link (no expiry / max uses) for the share popover. */
export function findPrimaryShareLink(links: ShareLinkItem[] | undefined): ShareLinkItem | null {
  if (!links?.length) return null;
  const active = links.filter((l) => getShareLinkStatus(l) === "active");
  const simple = active.find((l) => !l.expires_at && l.max_uses == null);
  return simple ?? active[0] ?? null;
}

interface CreateShareLinkInput {
  target_type: ShareTargetType;
  target_id?: string;
  expires_at?: string;
  max_uses?: number;
}

export interface InviteStudentsInput {
  emails: string[];
  auto_approve?: boolean;
  locale?: string;
}

export interface InviteResultItem {
  id: string;
  email: string;
  share_url: string;
  status: "created" | "already_invited";
}

export function useShareLinks(targetType: ShareTargetType, targetId?: string, enabled = true) {
  const listTargetId = shareListTargetId(targetType, targetId);
  return useQuery({
    queryKey: shareKeys.list(targetType, listTargetId),
    queryFn: async ({ signal }) => {
      const params: Record<string, string> = { target_type: targetType };
      if (targetType !== "instance" && targetId) {
        params.target_id = targetId;
      }
      const { data } = await api.get<ShareLinkItem[]>("share-links", {
        signal,
        params,
      });
      return data;
    },
    enabled: shareListEnabled(targetType, targetId, enabled),
  });
}

export function useInstanceLinks() {
  return useShareLinks("instance");
}

export function useCreateShareLink(targetType: ShareTargetType, targetId?: string) {
  const listTargetId = shareListTargetId(targetType, targetId);
  return useApiMutation({
    mutationFn: async (input: Omit<CreateShareLinkInput, "target_type" | "target_id">) => {
      const body: CreateShareLinkInput = { target_type: targetType, ...input };
      if (targetType !== "instance" && targetId) {
        body.target_id = targetId;
      }
      const { data } = await api.post<ShareLinkItem>("share-links", body);
      return data;
    },
    invalidates: [shareKeys.list(targetType, listTargetId)],
  });
}

export function useRevokeShareLink(targetType: ShareTargetType, targetId?: string) {
  const listTargetId = shareListTargetId(targetType, targetId);
  return useApiMutation({
    mutationFn: (linkId: string) => api.delete(`share-links/${linkId}`),
    invalidates: [shareKeys.list(targetType, listTargetId)],
  });
}

export function useInviteStudents(roomId: string) {
  return useApiMutation<InviteResultItem[], InviteStudentsInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<InviteResultItem[]>(`rooms/${roomId}/invites`, input);
      return data;
    },
    invalidates: [shareKeys.list("invite", roomId)],
  });
}

export function useResendInvite(roomId: string) {
  return useApiMutation({
    mutationFn: (linkId: string) => api.post(`share-links/${linkId}/resend`),
    invalidates: [shareKeys.list("invite", roomId)],
  });
}

/** Parse comma- or newline-separated emails; returns valid unique addresses (lowercased). */
export function parseEmailInput(raw: string): { valid: string[]; invalidCount: number } {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalidCount = 0;

  for (const email of parts) {
    if (seen.has(email)) continue;
    seen.add(email);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valid.push(email);
    } else {
      invalidCount += 1;
    }
  }

  return { valid, invalidCount };
}
