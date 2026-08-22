// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { create } from "zustand";
import axios from "axios";
import { api, getApiBaseUrl } from "../lib/api";
import type { AuthResponse, Entitlements, User } from "../types";
import { normalizeUserFromApi } from "../lib/profileDetails";

interface AuthState {
  user: User | null;
  token: string | null;
  entitlements: Entitlements | null;
  /** True until initial session check finishes */
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
  /** Update cached user (e.g. after profile save). */
  setUser: (user: User) => void;
  loginWithGoogle: (
    credential: string,
    role?: "student" | "teacher",
  ) => Promise<AuthResponse>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  entitlements: null,
  isLoading: true,
  login: (token, user) => {
    localStorage.setItem("miqraa_token", token);
    set({ token, user: normalizeUserFromApi(user), entitlements: null });
  },
  logout: () => {
    localStorage.removeItem("miqraa_token");
    set({ token: null, user: null, entitlements: null });
  },
  setUser: (user) => set({ user }),
  loginWithGoogle: async (credential, role) => {
    try {
      const { data } = await api.post<AuthResponse>("auth/google", {
        credential,
        ...(role ? { role } : {}),
      });
      if (!data?.token || !data?.user) {
        throw new Error("invalid google auth response");
      }
      localStorage.setItem("miqraa_token", data.token);
      set({
        token: data.token,
        user: normalizeUserFromApi(data.user),
        entitlements: null,
      });
      return data;
    } catch (err) {
      // Avoid the global 401 interceptor wiping state on a failed Google attempt
      // from the login page — axios interceptor already skips /login|/register.
      if (axios.isAxiosError(err)) throw err;
      throw err;
    }
  },
  loadUser: async () => {
    const token = localStorage.getItem("miqraa_token");
    if (!token) {
      set({ user: null, token: null, entitlements: null, isLoading: false });
      return;
    }
    const tokenForThisRequest = token;
    set({ token, isLoading: true });
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenForThisRequest}` },
      });
      if (!res.ok) {
        throw new Error("unauthorized");
      }
      const data = (await res.json()) as User & Partial<Entitlements>;
      const normalized = normalizeUserFromApi(data);
      const entitlements: Entitlements = {
        capabilities: data.capabilities ?? [],
        quotas: data.quotas ?? {},
      };
      // Ignore stale responses if login() replaced the token while this fetch was in flight
      if (localStorage.getItem("miqraa_token") !== tokenForThisRequest) {
        set({ isLoading: false });
        return;
      }
      set({ user: normalized, entitlements, isLoading: false });
    } catch {
      // Do not wipe a successful login that happened while this request was in flight
      if (localStorage.getItem("miqraa_token") !== tokenForThisRequest) {
        set({ isLoading: false });
        return;
      }
      localStorage.removeItem("miqraa_token");
      set({ user: null, token: null, entitlements: null, isLoading: false });
    }
  },
}));

export function selectIsAuthenticated(state: AuthState): boolean {
  return !!(state.user && state.token);
}
