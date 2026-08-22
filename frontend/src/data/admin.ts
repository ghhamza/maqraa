// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { adminKeys } from "../lib/queryKeys";

export type DashboardRangeDays = 30 | 90 | 365;

export interface AdminDashboard {
  generated_at: string;
  range_days: number;
  totals: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    rooms: number;
    rooms_active: number;
    rooms_archived: number;
    sessions: number;
    sessions_completed: number;
    sessions_scheduled: number;
    sessions_in_progress: number;
    sessions_cancelled: number;
    enrollments_approved: number;
    enrollments_pending: number;
    recitations: number;
    pages_recited: number;
    annotations: number;
    annotations_open: number;
    share_links: number;
    share_link_joins: number;
  };
  activity: {
    new_users_7d: number;
    new_users_30d: number;
    active_teachers_7d: number;
    active_teachers_30d: number;
    active_students_7d: number;
    active_students_30d: number;
    sessions_7d: number;
    sessions_30d: number;
    avg_star_rating: number | null;
    avg_session_duration_minutes: number | null;
  };
  demographics: {
    gender: { gender: string; students: number; teachers: number }[];
    age_buckets: { bucket: string; students: number; teachers: number }[];
    countries: { country_code: string; users: number; students: number; teachers: number }[];
    login_method: { method: string; count: number }[];
  };
  halaqat: {
    by_type: { halaqah_type: string; count: number }[];
    by_riwaya: { riwaya: string; count: number }[];
    by_enrollment_mode: { mode: string; count: number }[];
    fill_rate: {
      room_id: string;
      name: string;
      teacher_name: string;
      enrolled: number;
      max_students: number;
    }[];
    avg_students_per_room: number | null;
  };
  teaching: {
    grade_distribution: { grade: string; count: number }[];
    turn_type: { turn_type: string; count: number }[];
    annotation_categories: { category: string; severity: string; count: number }[];
    annotation_kind: { kind: string; count: number }[];
    top_surahs: { surah: number; count: number }[];
    top_teachers: {
      teacher_id: string;
      name: string;
      email: string;
      sessions: number;
      recitations: number;
      students: number;
    }[];
  };
  timeseries: {
    signups: { week: string; students: number; teachers: number }[];
    sessions: { week: string; completed: number; cancelled: number }[];
    recitations: { week: string; count: number; pages: number }[];
    annotations: { week: string; count: number }[];
  };
}

export function useAdminDashboard(days: DashboardRangeDays) {
  return useQuery({
    queryKey: adminKeys.dashboard(days),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<AdminDashboard>("admin/dashboard", {
        signal,
        params: { days },
      });
      return data;
    },
    staleTime: 60_000,
  });
}
