// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useCancellableEffect } from "./useCancellableEffect";
import { api } from "../lib/api";

export interface ChapterAudio {
  /** verse_key ("1:1") -> full audio URL */
  audioFiles: Record<string, string>;
  recitationId: number;
}

const cache = new Map<string, ChapterAudio>();
const inflight = new Map<string, Promise<ChapterAudio>>();
const AUDIO_CACHE_VERSION = "v2";

function cacheKey(chapter: number, recitationId: number) {
  return `${AUDIO_CACHE_VERSION}:${recitationId}:${chapter}`;
}

async function fetchChapterAudio(
  chapter: number,
  recitationId: number,
  signal?: AbortSignal,
): Promise<ChapterAudio> {
  const key = cacheKey(chapter, recitationId);
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const candidateReciters = recitationId === 1 ? [1, 6, 7] : [recitationId];
    let lastError: unknown = null;

    for (const rid of candidateReciters) {
      try {
        const res = await api.get<{ audio_files: Record<string, string> }>(
          `quran/recitations/${rid}/by_chapter/${chapter}`,
          signal ? { signal } : {},
        );
        const result: ChapterAudio = { audioFiles: res.data.audio_files, recitationId: rid };
        cache.set(key, result);
        return result;
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error("Failed to fetch chapter audio");
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export function useChapterAudio(chapter: number | null, recitationId = 1) {
  const [data, setData] = useState<ChapterAudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useCancellableEffect(
    async (signal) => {
      if (chapter == null) return;
      setLoading(true);
      setError(null);
      try {
        const d = await fetchChapterAudio(chapter, recitationId, signal);
        if (signal.aborted) return;
        setData(d);
      } catch (e) {
        if (signal.aborted) return;
        setError(e);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [chapter, recitationId],
  );

  return { data, loading, error };
}

export function prefetchChapterAudio(chapter: number, recitationId = 1) {
  void fetchChapterAudio(chapter, recitationId).catch(() => {});
}
