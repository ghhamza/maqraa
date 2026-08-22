// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { renderGoogleButton } from "../../lib/googleAuth";
import { finishAuthNavigation } from "../../lib/safeNext";
import { useAuthStore } from "../../stores/authStore";

export interface GoogleSignInButtonProps {
  role?: "student" | "teacher";
  onSuccess?: () => void;
  /** When false, render a hint instead of the GIS button. */
  roleReady?: boolean;
}

function googleErrorCode(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as { error?: string; code?: string } | undefined;
  return data?.error ?? data?.code ?? null;
}

export function GoogleSignInButton({
  role,
  onSuccess,
  roleReady = true,
}: GoogleSignInButtonProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const roleRef = useRef(role);
  roleRef.current = role;
  const onCredentialRef = useRef<(credential: string) => void>(() => {});

  onCredentialRef.current = (credential: string) => {
    void (async () => {
      setError(null);
      try {
        const data = await loginWithGoogle(credential, roleRef.current);
        if (onSuccess) {
          onSuccess();
        } else {
          finishAuthNavigation(navigate, data.user);
        }
      } catch (err) {
        const code = googleErrorCode(err);
        if (code === "role_required") {
          navigate("/register?google=1", {
            replace: true,
            state: { googleCredential: credential },
          });
          return;
        }
        setError(t("auth.errors.invalidGoogleToken"));
      }
    })();
  };

  useEffect(() => {
    if (!roleReady) return;
    const el = containerRef.current;
    if (!el) return;

    const applyWidth = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    applyWidth();

    const ro = new ResizeObserver(() => applyWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [roleReady]);

  useEffect(() => {
    if (!roleReady) {
      setEnabled(true);
      return;
    }
    if (width < 1) return;
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    void (async () => {
      try {
        const ok = await renderGoogleButton(el, {
          locale: i18n.language,
          width,
          onCredential: (credential) => onCredentialRef.current(credential),
        });
        if (!cancelled) setEnabled(ok);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, [i18n.language, roleReady, width]);

  if (enabled === false) return null;

  if (!roleReady) {
    return (
      <p className="text-center text-sm text-[#6B7280]" style={{ fontFamily: "var(--font-ui)" }}>
        {t("auth.chooseRoleFirst")}
      </p>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        aria-label={t("auth.continueWithGoogle")}
      />
      {error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
