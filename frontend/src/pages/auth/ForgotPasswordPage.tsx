// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (loading || submitted) return;
    setLoading(true);
    try {
      await api.post("auth/password/forgot", {
        email: email.trim(),
        locale: (i18n.language || "ar").split("-")[0],
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
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
          {t("auth.forgotPassword.title")}
        </h1>

        {submitted ? (
          <p className="mt-8 text-center text-[var(--color-text-muted)]" role="status">
            {t("auth.forgotPassword.success")}
          </p>
        ) : (
          <div className="mt-8 space-y-5">
            <Input
              label={t("auth.forgotPassword.emailLabel")}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="button" variant="primary" fullWidth loading={loading} onClick={() => void handleSubmit()}>
              {t("auth.forgotPassword.submit")}
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
