// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Share URL helpers shared by ShareButton and ShareCard. */

export async function copyShareUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}

export function openWhatsAppShare(message: string, url: string): void {
  const text = `${message} ${url}`.trim();
  openWhatsAppText(text);
}

/** Open WhatsApp with a fully formed message (link already included). */
export function openWhatsAppText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function openTelegramShare(message: string, url: string): void {
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function openEmailShare(subject: string, message: string, url: string): void {
  const body = `${message} ${url}`.trim();
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShareText(opts: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share(opts);
    return true;
  } catch {
    return false;
  }
}

export async function shareOrDownloadPng(opts: {
  pngUrl: string;
  filename: string;
  text: string;
  title: string;
}): Promise<"shared" | "downloaded"> {
  const res = await fetch(opts.pngUrl);
  const blob = await res.blob();
  const file = new File([blob], opts.filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], text: opts.text, title: opts.title });
      return "shared";
    } catch {
      // fall through to download
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
  return "downloaded";
}

export function downloadPng(pngUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

/** Bump when card PNG layout/branding changes so browsers skip stale cached images. */
const CARD_IMAGE_VERSION = "v5";

export function cardImageUrl(token: string, format: "square" | "story" | "og" = "square"): string {
  return `/s/${encodeURIComponent(token)}/card.png?format=${format}&v=${CARD_IMAGE_VERSION}`;
}

export function shareTeaserUrl(token: string): string {
  if (typeof window === "undefined") return `/s/${token}`;
  return `${window.location.origin}/s/${token}`;
}
