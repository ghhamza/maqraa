// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";

type AcceptShareResponse = {
  target_type: string;
  target_id: string | null;
  route: string;
  enrollment_status?: string;
  joined: boolean;
};

export function ShareAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [errorKind, setErrorKind] = useState<"invalid" | "wrongAccount" | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      setErrorKind("invalid");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data } = await api.post<AcceptShareResponse>(
          `share-links/${encodeURIComponent(token.trim())}/accept`,
        );
        if (cancelled) return;
        navigate(data.route, { replace: true });
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err)) {
          const code = (err.response?.data as { code?: string } | undefined)?.code;
          if (code === "wrong_account") {
            setErrorKind("wrongAccount");
            return;
          }
        }
        setErrorKind("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (errorKind) {
    const message =
      errorKind === "wrongAccount" ? t("share.wrongAccount") : t("share.invalid");
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF5] px-4 py-10">
        <div
          className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <p className="text-lg text-[#1A1A1A]" role="alert">
            {message}
          </p>
          <Button asChild variant="primary" fullWidth className="mt-6">
            <Link to="/">{t("share.goHome")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF5] px-4 py-10">
      <div
        className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]"
          role="status"
          aria-label={t("share.joining")}
        />
        <p className="text-[#6B7280]">{t("share.joining")}</p>
      </div>
    </div>
  );
}
