// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { PageShell } from "../../components/layout/PageShell";
import { PageCard } from "../../components/layout/PageCard";
import { CreateHalaqaWizard } from "../../components/rooms/CreateHalaqaWizard";

export function CreateHalaqaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "teacher" && user.role !== "admin") {
      navigate("/rooms", { replace: true });
    }
  }, [user, navigate]);

  return (
    <PageShell
      title={t("wizard.createHalaqaTitle")}
      backTo={{ to: "/rooms", label: t("rooms.title") }}
      breadcrumb={[
        { label: t("rooms.title"), to: "/rooms" },
        { label: t("wizard.createHalaqaTitle") },
      ]}
      contentClassName="mx-auto max-w-2xl"
    >
      <PageCard>
        <CreateHalaqaWizard />
      </PageCard>
    </PageShell>
  );
}
