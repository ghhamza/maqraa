// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { loadPublicConfig } from "./publicConfig";

const GSI_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi load failed")));
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi load failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function gsiLocale(appLocale: string): string {
  const base = (appLocale || "en").split("-")[0] ?? "en";
  if (base === "ar" || base === "fr" || base === "en") return base;
  return "en";
}

export interface RenderGoogleButtonOptions {
  onCredential: (credential: string) => void;
  locale: string;
  /** Pixel width; GIS accepts number. */
  width?: number;
}

/** Renders the native GIS button into `el`. No-op (resolves false) if Google login is disabled. */
export async function renderGoogleButton(
  el: HTMLElement,
  options: RenderGoogleButtonOptions,
): Promise<boolean> {
  const { google_client_id } = await loadPublicConfig();
  if (!google_client_id) return false;

  await loadGsiScript();
  if (!window.google?.accounts?.id) return false;

  el.innerHTML = "";
  window.google.accounts.id.initialize({
    client_id: google_client_id,
    callback: (response) => {
      if (response.credential) options.onCredential(response.credential);
    },
    ux_mode: "popup",
  });
  window.google.accounts.id.renderButton(el, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    width: options.width ?? Math.min(el.clientWidth || 320, 400),
    locale: gsiLocale(options.locale),
  });
  return true;
}

export async function isGoogleLoginEnabled(): Promise<boolean> {
  const { google_client_id } = await loadPublicConfig();
  return Boolean(google_client_id);
}
