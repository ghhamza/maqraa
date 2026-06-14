// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import { useCancellableEffect } from "../../hooks/useCancellableEffect";

type VerifyState = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token: pathToken } = useParams<{ token?: string }>();
  const [search] = useSearchParams();
  const token = (pathToken ?? search.get("token") ?? "").trim();
  const loadUser = useAuthStore((s) => s.loadUser);
  const tokenAuth = useAuthStore((s) => s.token);

  const [state, setState] = useState<VerifyState>(token ? "loading" : "error");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useCancellableEffect(
    async (signal) => {
      if (!token.trim()) {
        setState("error");
        return;
      }
      try {
        await api.post("auth/verify-email", { token }, { signal });
        if (signal.aborted) return;
        setState("success");
        if (tokenAuth) {
          await loadUser();
        }
      } catch {
        if (!signal.aborted) setState("error");
      }
    },
    [token, loadUser, tokenAuth],
  );

  useEffect(() => {
    if (state !== "success") return;
    const id = window.setTimeout(() => {
      navigate(tokenAuth ? "/" : "/login", { replace: true });
    }, 1500);
    return () => window.clearTimeout(id);
  }, [state, navigate, tokenAuth]);

  async function handleResend() {
    if (!tokenAuth || resending) return;
    setResending(true);
    setResendError(null);
    try {
      const { data } = await api.post<{ ok: boolean; queued: boolean }>("auth/resend-verification");
      if (data.queued) {
        setResent(true);
      } else {
        setResendError(t("auth.verifyBanner.rateLimited"));
      }
    } catch (err) {
      setResendError(userFacingApiError(err, "auth.verifyBanner.failed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-8 shadow-md text-center"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="absolute end-4 top-4">
          <LanguageSwitcher compact />
        </div>

        {state === "loading" ? (
          <>
            <div className="mx-auto mt-4 h-9 w-9 animate-spin rounded-full border-4 border-[#1B5E20] border-t-transparent" />
            <p className="mt-6 text-[var(--color-text-muted)]">{t("auth.verifyEmail.verifying")}</p>
          </>
        ) : state === "success" ? (
          <p className="mt-4 text-xl font-semibold text-[var(--color-primary)]">{t("auth.verifyEmail.success")}</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-red-600" role="alert">
              {t("auth.verifyEmail.failed")}
            </p>
            {tokenAuth ? (
              <div className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  loading={resending}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleResend();
                  }}
                >
                  {t("auth.verifyEmail.resend")}
                </Button>
                {resendError ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {resendError}
                  </p>
                ) : null}
                {resent ? (
                  <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t("auth.verifyBanner.resent")}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 text-sm text-[var(--color-text-muted)]">
                <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
                  {t("auth.login.label")}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
