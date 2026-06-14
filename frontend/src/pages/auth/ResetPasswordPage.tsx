// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token: pathToken } = useParams<{ token?: string }>();
  const [search] = useSearchParams();
  const token = (pathToken ?? search.get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const invalidToken = !token.trim();

  async function handleSubmit() {
    if (loading || invalidToken) return;
    if (password.length < 8) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post("auth/password/reset", { token, new_password: password });
      setSuccess(true);
      window.setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      const msg = userFacingApiError(err, "auth.resetPassword.invalidToken");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-8 shadow-md"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="absolute end-4 top-4">
          <LanguageSwitcher compact />
        </div>
        <h1
          className="text-center text-3xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-quran)" }}
        >
          {t("auth.resetPassword.title")}
        </h1>

        {invalidToken ? (
          <p className="mt-8 text-center text-sm text-red-600" role="alert">
            {t("auth.resetPassword.invalidToken")}
          </p>
        ) : success ? (
          <p className="mt-8 text-center text-[var(--color-primary)]" role="status">
            {t("auth.resetPassword.success")}
          </p>
        ) : (
          <div className="mt-8 space-y-5">
            <Input
              label={t("auth.resetPassword.newPassword")}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label={t("auth.resetPassword.confirmPassword")}
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {error ? (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="button" variant="primary" fullWidth loading={loading} onClick={() => void handleSubmit()}>
              {t("auth.resetPassword.submit")}
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            {t("auth.login.label")}
          </Link>
        </p>
      </div>
    </div>
  );
}
