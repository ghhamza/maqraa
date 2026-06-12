// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PreLaunchBanner } from "./PreLaunchBanner";
import {
  PRE_LAUNCH_BANNER_HEIGHT,
  shouldShowPreLaunchBanner,
} from "../../lib/preLaunchBanner";

export function PreLaunchBannerGate() {
  const { pathname } = useLocation();
  const show = shouldShowPreLaunchBanner(pathname);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--pre-launch-banner-height",
      show ? PRE_LAUNCH_BANNER_HEIGHT : "0px",
    );
    return () => {
      document.documentElement.style.removeProperty("--pre-launch-banner-height");
    };
  }, [show]);

  if (!show) return null;
  return <PreLaunchBanner />;
}
