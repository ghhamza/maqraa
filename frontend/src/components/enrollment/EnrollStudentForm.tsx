// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudentOption } from "../../types";
import { Input } from "../ui/Input";
import { useAvailableStudentsForRoom, useEnrollStudent } from "../../data/rooms";

export interface EnrollStudentFormProps {
  roomId: string;
  maxStudents: number;
  currentCount: number;
  active: boolean;
  resetKey?: number;
  onEnrolled: () => void;
}

export function EnrollStudentForm({
  roomId,
  maxStudents,
  currentCount,
  active,
  resetKey = 0,
  onEnrolled,
}: EnrollStudentFormProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const full = currentCount >= maxStudents;

  useEffect(() => {
    if (active) {
      setSearch("");
      setError(null);
    }
  }, [active, resetKey]);

  const studentsQuery = useAvailableStudentsForRoom(roomId, active);

  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isPending && active;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  const enrollMutation = useEnrollStudent(
    roomId,
    () => {
      onEnrolled();
    },
    (message) => setError(message),
  );

  const submitting = enrollMutation.isPending;

  function enroll(s: StudentOption) {
    if (full || submitting) return;
    setError(null);
    enrollMutation.mutate(s, {
      onSuccess: () => {
        setSearch("");
      },
    });
  }

  return (
    <div className="space-y-4">
      {full ? (
        <p className="text-center text-red-600" role="alert">
          {t("enrollment.roomFull")}
        </p>
      ) : null}

      <Input
        label={t("enrollment.availableStudents")}
        name="search"
        placeholder={t("enrollment.searchStudents")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
        {loading ? (
          <p className="p-4 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-[var(--color-text-muted)]">
            {t("enrollment.noAvailableStudents")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={full || submitting}
                  className="w-full px-4 py-3 text-right transition hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => void enroll(s)}
                >
                  <span className="font-medium text-[var(--color-text)]">{s.name}</span>
                  <span className="mt-0.5 block text-sm text-[var(--color-text-muted)]">{s.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
