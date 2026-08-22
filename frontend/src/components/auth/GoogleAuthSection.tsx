// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isGoogleLoginEnabled } from "../../lib/googleAuth";

/** Renders children (divider + Google button) only when Google login is configured. */
export function GoogleAuthSection({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isGoogleLoginEnabled().then((ok) => {
      if (!cancelled) setEnabled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;
  return <>{children}</>;
}

export function AuthOrDivider() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3" style={{ fontFamily: "var(--font-ui)" }}>
      <div className="h-px flex-1 bg-[#6B7280]/30" />
      <span className="text-sm text-[#6B7280]">{t("auth.or")}</span>
      <div className="h-px flex-1 bg-[#6B7280]/30" />
    </div>
  );
}
