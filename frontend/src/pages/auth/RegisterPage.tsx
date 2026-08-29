// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { finishAuthNavigation, resolveShareTokenForRegister, stashShareNext } from "../../lib/safeNext";
import { useAuthStore } from "../../stores/authStore";
import type { AuthResponse } from "../../types";
import { RoleChoiceCards } from "../../components/auth/RoleChoiceCards";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { AuthOrDivider, GoogleAuthSection } from "../../components/auth/GoogleAuthSection";
import { AuthBrandHeader } from "../../components/auth/AuthBrandHeader";
import {
  DemographicsFields,
  demographicsPayload,
  emptyDemographics,
  type DemographicsValue,
} from "../../components/users/DemographicsFields";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import { detectBrowserTimezone } from "../../lib/sessionTime";

type RegisterLocationState = {
  googleCredential?: string;
};

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const pendingGoogleCredential =
    (location.state as RegisterLocationState | null)?.googleCredential ?? null;
  const fromGoogleRolePrompt = searchParams.get("google") === "1" && Boolean(pendingGoogleCredential);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | null>(
    fromGoogleRolePrompt ? null : "student",
  );
  const [demographics, setDemographics] = useState<DemographicsValue>(emptyDemographics);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleSignupStarted = useRef(false);

  useEffect(() => {
    stashShareNext(searchParams.get("next"));
  }, [searchParams]);

  const shareToken = useMemo(
    () => resolveShareTokenForRegister(searchParams.get("next")),
    [searchParams],
  );

  async function completeGoogleSignup() {
    if (!fromGoogleRolePrompt || !pendingGoogleCredential || !role || loading) return;
    if (googleSignupStarted.current) return;
    googleSignupStarted.current = true;
    setGoogleError(null);
    setLoading(true);
    try {
      const data = await loginWithGoogle(
        pendingGoogleCredential,
        role,
        demographicsPayload(demographics, { omitEmpty: true }),
      );
      navigate(location.pathname, { replace: true, state: {} });
      finishAuthNavigation(navigate, data.user);
    } catch {
      googleSignupStarted.current = false;
      setGoogleError(t("auth.errors.invalidGoogleToken"));
    } finally {
      setLoading(false);
    }
  }

  function validate(): string | null {
    if (!role) return t("auth.chooseRoleFirst");
    if (!name.trim() || !email.trim() || !password || !confirm) {
      return t("auth.fillAll");
    }
    if (password.length < 8) {
      return t("auth.passwordMin");
    }
    if (password !== confirm) {
      return t("auth.passwordMismatch");
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    if (!role) return;
    setFormError(null);
    setLoading(true);
    try {
      const { data } = await api.request<AuthResponse>({
        method: "post",
        url: "auth/register",
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          locale: (i18n.language || "ar").split("-")[0],
          timezone: detectBrowserTimezone(),
          ...(shareToken ? { share_token: shareToken } : {}),
          ...demographicsPayload(demographics, { omitEmpty: true }),
        },
      });
      login(data.token, data.user);
      finishAuthNavigation(navigate, data.user);
    } catch {
      setFormError(t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div
        className="relative w-full max-w-[480px] rounded-2xl bg-[var(--color-surface)] p-8 shadow-md"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="absolute end-4 top-4">
          <LanguageSwitcher compact />
        </div>
        <AuthBrandHeader subtitle={t("auth.newAccountSubtitle")} />

        {fromGoogleRolePrompt ? (
          <p
            className="mt-4 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-3 py-2 text-sm text-[var(--color-text)]"
            role="status"
          >
            {t("auth.googleChooseRole")}
          </p>
        ) : null}

        <fieldset className="mt-6 space-y-2">
          <legend
            id="register-account-type-legend"
            className="mb-2 text-sm font-medium text-[var(--color-text)]"
          >
            {t("auth.accountType")}
          </legend>
          <RoleChoiceCards
            selected={role}
            onSelect={setRole}
            legendId="register-account-type-legend"
          />
        </fieldset>

        {googleError ? (
          <p className="mt-3 text-center text-sm text-red-600" role="alert">
            {googleError}
          </p>
        ) : null}

        {fromGoogleRolePrompt ? (
          <div className="mt-5 space-y-5">
            <DemographicsFields value={demographics} onChange={setDemographics} />
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={!role}
              onClick={() => void completeGoogleSignup()}
            >
              {t("auth.createAccount")}
            </Button>
          </div>
        ) : (
          <>
            <GoogleAuthSection>
              <div className="mt-6 space-y-3">
                <GoogleSignInButton role={role ?? undefined} roleReady={role != null} />
                <AuthOrDivider />
              </div>
            </GoogleAuthSection>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <Input
                label={t("auth.name")}
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label={t("auth.email")}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label={t("auth.password")}
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                label={t("auth.confirmPassword")}
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />

              <DemographicsFields value={demographics} onChange={setDemographics} />

              {formError ? (
                <p className="text-center text-sm text-red-600" role="alert">
                  {formError}
                </p>
              ) : null}

              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                {t("auth.createAccount")}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            {t("auth.login.label")}
          </Link>
        </p>
      </div>
    </div>
  );
}
