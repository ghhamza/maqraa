-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

ALTER TABLE rooms ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh';
ALTER TABLE users ADD COLUMN timezone TEXT;
