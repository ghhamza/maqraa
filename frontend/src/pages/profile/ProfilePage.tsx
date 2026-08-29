// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useUpdatePassword } from "../../data/users";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import {
  ProfileDetailsForm,
  useProfileDetailsState,
  useProfileDetailsValidation,
} from "../../components/profile/ProfileDetailsForm";
import { normalizeUserFromApi, profileDetailsPayload } from "../../lib/profileDetails";
import { TimezoneSelect } from "../../components/time/TimezoneSelect";
import { detectBrowserTimezone } from "../../lib/sessionTime";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState(() => user?.timezone ?? detectBrowserTimezone());
  const [showDetectedHint] = useState(() => user?.timezone == null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [detailsFieldErrors, setDetailsFieldErrors] = useState<Record<string, string>>({});

  const [detailsValues, setDetailsValues] = useProfileDetailsState(user);
  const { validate: validateDetails, isTeacher } = useProfileDetailsValidation(user, detailsValues);

  const updatePasswordMutation = useUpdatePassword(
    () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      window.setTimeout(() => setPasswordSuccess(false), 4000);
      if (user && !user.has_password) {
        setUser({ ...user, has_password: true });
      }
    },
    (message) => setPasswordError(message),
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setTimezone(user.timezone ?? detectBrowserTimezone());
    }
  }, [user]);

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || profileLoading) return;
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      const { data } = await api.request<User>({
        method: "put",
        url: "auth/me",
        data: {
          name: name.trim(),
          email: email.trim(),
          timezone,
        },
      });
      setUser(normalizeUserFromApi(data));
      setProfileSuccess(true);
      window.setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setProfileError(userFacingApiError(err));
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!user || detailsLoading) return;
    const nextErrors = validateDetails();
    setDetailsFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setDetailsError(null);
    setDetailsSuccess(false);
    setDetailsLoading(true);
    try {
      const { data } = await api.request<User>({
        method: "put",
        url: "profile",
        data: profileDetailsPayload(detailsValues, isTeacher),
      });
      setUser(normalizeUserFromApi(data));
      setDetailsSuccess(true);
      window.setTimeout(() => setDetailsSuccess(false), 4000);
    } catch (err) {
      setDetailsError(userFacingApiError(err, "profile.errRequired"));
    } finally {
      setDetailsLoading(false);
    }
  }

  function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user || passwordLoading) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("auth.passwordMin"));
      return;
    }
    if (user.has_password && !currentPassword) {
      setPasswordError(t("errors.wrong_password"));
      return;
    }
    setPasswordLoading(true);
    updatePasswordMutation
      .mutateAsync({
        ...(user.has_password ? { current_password: currentPassword } : {}),
        new_password: newPassword,
      })
      .catch(() => {})
      .finally(() => setPasswordLoading(false));
  }

  if (!user) {
    return null;
  }

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("profile.title") },
      ]}
      title={t("profile.title")}
      description={t("profile.subtitle")}
      contentClassName="space-y-10"
    >
      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("profile.accountSection")}</h2>
        <form onSubmit={handleProfile} className="space-y-4">
          <Input
            label={t("auth.name")}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <Input
            label={t("auth.email")}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <TimezoneSelect
            value={timezone}
            onChange={setTimezone}
            showDetectedHint={showDetectedHint}
          />
          {profileError ? (
            <p className="text-sm text-red-600" role="alert">
              {profileError}
            </p>
          ) : null}
          {profileSuccess ? (
            <p className="text-sm text-[var(--color-primary)]" role="status">
              {t("profile.profileSaved")}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={profileLoading}>
            {profileLoading ? t("common.loading") : t("profile.saveProfile")}
          </Button>
        </form>
      </PageCard>

      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("profile.detailsSection")}</h2>
        <form onSubmit={(e) => void handleDetails(e)} className="space-y-4">
          <ProfileDetailsForm
            user={user}
            fieldErrors={detailsFieldErrors}
            values={detailsValues}
            onChange={setDetailsValues}
          />
          {detailsError ? (
            <p className="text-sm text-red-600" role="alert">
              {detailsError}
            </p>
          ) : null}
          {detailsSuccess ? (
            <p className="text-sm text-[var(--color-primary)]" role="status">
              {t("profile.detailsSaved")}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={detailsLoading}>
            {detailsLoading ? t("common.loading") : t("profile.saveDetails")}
          </Button>
        </form>
      </PageCard>

      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          {user.has_password ? t("profile.passwordSection") : t("settings.setPassword")}
        </h2>
        {!user.has_password ? (
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("settings.setPasswordHint")}</p>
        ) : null}
        <form onSubmit={handlePassword} className="space-y-4">
          {user.has_password ? (
            <Input
              label={t("profile.currentPassword")}
              name="current_password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          ) : null}
          <Input
            label={t("profile.newPassword")}
            name="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label={t("profile.confirmPassword")}
            name="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {passwordError ? (
            <p className="text-sm text-red-600" role="alert">
              {passwordError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="text-sm text-[var(--color-primary)]" role="status">
              {t("profile.passwordChanged")}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            disabled={passwordLoading || (user.has_password && !currentPassword) || !newPassword}
          >
            {passwordLoading
              ? t("common.loading")
              : user.has_password
                ? t("profile.changePassword")
                : t("settings.setPassword")}
          </Button>
        </form>
      </PageCard>
    </PageShell>
  );
}
