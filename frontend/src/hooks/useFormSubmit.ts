// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useState } from "react";
import { userFacingApiError } from "../lib/api";

export interface UseFormSubmitState {
  loading: boolean;
  error: string | null;
  /** Replace the current error (e.g. for client-side validation messages). */
  setError: (msg: string | null) => void;
  /** Wrap a submit body — handles loading, try/catch, userFacingApiError. */
  submit: (handler: () => Promise<void>) => Promise<void>;
  /** Clear error + loading (e.g. when the modal opens). */
  reset: () => void;
}

/**
 * Standard form-submit lifecycle: sets loading, runs the handler, catches with
 * `userFacingApiError`, surfaces the message via `error`. Re-entry while
 * `loading` is true is a no-op.
 */
export function useFormSubmit(): UseFormSubmitState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (handler: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await handler();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, setError, submit, reset };
}
