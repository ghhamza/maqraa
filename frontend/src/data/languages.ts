// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

export const SPOKEN_LANGUAGE_CODES = ["ar", "en", "fr", "id", "ru"] as const;

export type SpokenLanguageCode = (typeof SPOKEN_LANGUAGE_CODES)[number];
