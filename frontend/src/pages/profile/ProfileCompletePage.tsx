// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";
import { Button } from "../../components/ui/Button";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import {
  ProfileDetailsForm,
  useProfileDetailsState,
  useProfileDetailsValidation,
} from "../../components/profile/ProfileDetailsForm";
import { normalizeUserFromApi, profileDetailsPayload } from "../../lib/profileDetails";

export function ProfileCompletePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [values, setValues] = useProfileDetailsState(user);
  const { validate, isTeacher } = useProfileDetailsValidation(user, values);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!user) {
    return null;
  }

  if (!user.profile_completion_pending) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setError(null);
    setLoading(true);
    try {
      const { data } = await api.request<User>({
        method: "put",
        url: "profile",
        data: profileDetailsPayload(values, isTeacher),
      });
      setUser(normalizeUserFromApi(data));
      navigate("/", { replace: true });
    } catch (err) {
      setError(userFacingApiError(err, "profile.errRequired"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[var(--color-surface)] p-6 shadow-md sm:p-8"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="absolute end-4 top-4">
          <LanguageSwitcher compact />
        </div>

        <h1
          className="text-center text-2xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-quran)" }}
        >
          {t("profile.completeTitle")}
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
          {t("profile.completeSubtitle")}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
          <ProfileDetailsForm
            user={user}
            fieldErrors={fieldErrors}
            values={values}
            onChange={setValues}
          />

          {error ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {t("profile.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
