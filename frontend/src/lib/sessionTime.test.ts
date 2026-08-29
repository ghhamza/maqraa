// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { describe, expect, it } from "vitest";
import { formatSessionTime, zonedWallTimeToUtc } from "./sessionTime";

describe("formatSessionTime", () => {
  it("returns secondary time when room and user timezones differ", () => {
    // 2026-08-30 20:00 Africa/Algiers = 19:00 UTC (Algiers is UTC+1 in summer? actually Algeria is UTC+1 year-round)
    const utc = zonedWallTimeToUtc(2026, 8, 30, 20, 0, "Africa/Algiers").toISOString();
    const f = formatSessionTime(utc, "Africa/Algiers", "Europe/Paris", "ar");
    expect(f.sameZone).toBe(false);
    expect(f.city).toBe("الجزائر");
    expect(f.secondaryTime).toBeTruthy();
    expect(f.primary).toBeTruthy();
  });

  it("omits secondary when timezones match", () => {
    const utc = zonedWallTimeToUtc(2026, 8, 30, 20, 0, "Europe/Paris").toISOString();
    const f = formatSessionTime(utc, "Europe/Paris", "Europe/Paris", "en");
    expect(f.sameZone).toBe(true);
    expect(f.secondaryTime).toBeNull();
  });
});
