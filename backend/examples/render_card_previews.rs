// SPDX-License-Identifier: AGPL-3.0-or-later
//! One-shot: render example card PNGs into `assets/card/preview-*.png`.
//!
//! ```bash
//! cargo run --example render_card_previews
//! ```

use chrono::{Duration, Utc};
use maqraa::api::handlers::share_card::{render_card_png, CardFormat, PublicHalaqah};
use uuid::Uuid;

fn sample() -> PublicHalaqah {
    PublicHalaqah {
        token: "abcd1234efgh5678ijkl9012".into(),
        room_id: Uuid::nil(),
        name: "حلقة النور".into(),
        teacher_name: "أحمد".into(),
        riwaya: "hafs".into(),
        halaqah_type: "hifz".into(),
        max_students: 20,
        enrolled_count: 3,
        description: None,
        created_at: Utc::now(),
        first_session_at: Some(Utc::now() + Duration::days(5)),
        schedule_days: vec![6, 1, 3], // Sun, Tue, Thu (Mon=0)
        timezone: "Asia/Riyadh".into(),
    }
}

fn main() {
    let h = sample();
    let base = "https://app.maqraa.org";
    let out_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/assets/card");

    for (fmt, name) in [
        (CardFormat::Square, "preview-square.png"),
        (CardFormat::Story, "preview-story.png"),
        (CardFormat::Og, "preview-og.png"),
    ] {
        let png = render_card_png(&h, fmt, base).expect("render");
        let path = format!("{out_dir}/{name}");
        std::fs::write(&path, &png).expect("write");
        println!("wrote {path} ({} bytes)", png.len());
    }
}
