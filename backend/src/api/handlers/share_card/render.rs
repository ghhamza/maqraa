// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::sync::{Arc, OnceLock};

use resvg::tiny_skia;
use resvg::usvg::{Options, Tree};

use super::data::{
    arabic_riwaya_label, arabic_type_label, format_rhythm_ar, format_session_ar, seats_available,
    short_display_url, truncate_chars, PublicHalaqah,
};
use super::qr::qr_svg_path;
use crate::timezone::{default_timezone, tz_city_label};

const FONT_AMIRI_BOLD: &[u8] = include_bytes!("../../../../assets/fonts/Amiri-Bold.ttf");
const FONT_IBM_REGULAR: &[u8] =
    include_bytes!("../../../../assets/fonts/IBMPlexSansArabic-Regular.ttf");
const FONT_IBM_SEMIBOLD: &[u8] =
    include_bytes!("../../../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf");

const SVG_SQUARE: &str = include_str!("../../../../assets/card/card-square.svg");
const SVG_STORY: &str = include_str!("../../../../assets/card/card-story.svg");
const SVG_OG: &str = include_str!("../../../../assets/card/card-og.svg");
const LOGO_AR_SVG: &str = include_str!("../../../../assets/card/logo-ar.svg");

/// Inner markup of the Arabic lockup (paths only), shared across card formats.
fn logo_ar_inner() -> &'static str {
    static INNER: OnceLock<String> = OnceLock::new();
    INNER
        .get_or_init(|| {
            let s = LOGO_AR_SVG;
            let start = s
                .find("<svg")
                .and_then(|i| s[i..].find('>').map(|j| i + j + 1))
                .unwrap_or(0);
            let end = s.rfind("</svg>").unwrap_or(s.len());
            s[start..end].trim().to_string()
        })
        .as_str()
}

fn inject_brand_logo(svg: &str, x: f64, y: f64, w: f64, h: f64) -> String {
    // Nested SVG keeps the lockup's own viewBox; xMaxYMin pins it to the RTL start (right).
    let logo = format!(
        r#"<svg id="logo" x="{x}" y="{y}" width="{w}" height="{h}" viewBox="-24.00 -24.00 1151.42 492.20" preserveAspectRatio="xMaxYMin meet">{inner}</svg>"#,
        inner = logo_ar_inner()
    );
    if let Some(pos) = svg.find(r#"<g id="logo-slot"/>"#) {
        let end = pos + r#"<g id="logo-slot"/>"#.len();
        let mut out = String::with_capacity(svg.len() + logo.len());
        out.push_str(&svg[..pos]);
        out.push_str(&logo);
        out.push_str(&svg[end..]);
        return out;
    }
    svg.to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CardFormat {
    Square,
    Story,
    Og,
}

impl CardFormat {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
            Some("story") => Self::Story,
            Some("og") => Self::Og,
            _ => Self::Square,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Square => "square",
            Self::Story => "story",
            Self::Og => "og",
        }
    }

    fn template(self) -> &'static str {
        match self {
            Self::Square => SVG_SQUARE,
            Self::Story => SVG_STORY,
            Self::Og => SVG_OG,
        }
    }

    fn pixel_size(self) -> (u32, u32) {
        match self {
            Self::Square => (1080, 1080),
            Self::Story => (1080, 1920),
            Self::Og => (1200, 630),
        }
    }

    /// Brand lockup box: (x, y, width, height) — top-start (right). Height ≈ 5% of card.
    fn logo_box(self) -> (f64, f64, f64, f64) {
        match self {
            // Square: tightened under top margin, h≈5%
            Self::Square => (860.0, 64.0, 134.0, 48.0),
            // Story: top zone, tightened toward name
            Self::Story => (800.0, 64.0, 194.0, 80.0),
            // Og: text column top-start
            Self::Og => (980.0, 48.0, 164.0, 52.0),
        }
    }
}

fn font_db() -> Arc<fontdb::Database> {
    static DB: OnceLock<Arc<fontdb::Database>> = OnceLock::new();
    DB.get_or_init(|| {
        let mut db = fontdb::Database::new();
        db.load_font_data(FONT_AMIRI_BOLD.to_vec());
        db.load_font_data(FONT_IBM_REGULAR.to_vec());
        db.load_font_data(FONT_IBM_SEMIBOLD.to_vec());
        Arc::new(db)
    })
    .clone()
}

pub fn xml_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}

/// Replace the text content of `<text id="{id}" …>…</text>`.
pub fn set_text_by_id(svg: &str, id: &str, value: &str) -> String {
    let needle = format!("id=\"{id}\"");
    let Some(id_pos) = svg.find(&needle) else {
        return svg.to_string();
    };
    let Some(gt) = svg[id_pos..].find('>') else {
        return svg.to_string();
    };
    let open_end = id_pos + gt + 1;
    let Some(close_rel) = svg[open_end..].find("</text>") else {
        return svg.to_string();
    };
    let close_start = open_end + close_rel;
    let mut out = String::with_capacity(svg.len() + value.len());
    out.push_str(&svg[..open_end]);
    out.push_str(&xml_escape(value));
    out.push_str(&svg[close_start..]);
    out
}

fn parse_qr_box(svg: &str) -> Option<(f64, f64, f64)> {
    let marker = "id=\"qr\"";
    let pos = svg.find(marker)?;
    let start = svg[..pos].rfind('<')?;
    let end = svg[pos..]
        .find("/>")
        .map(|i| pos + i + 2)
        .or_else(|| svg[pos..].find('>').map(|i| pos + i + 1))?;
    let tag = &svg[start..end];
    let size = attr_f64(tag, "data-size")?;
    if let (Some(x), Some(y)) = (attr_f64(tag, "data-x"), attr_f64(tag, "data-y")) {
        return Some((x, y, size));
    }
    // transform="translate(x y)" or translate(x,y)
    let key = "translate(";
    let i = tag.find(key)?;
    let rest = &tag[i + key.len()..];
    let j = rest.find(')')?;
    let inner = rest[..j].replace(',', " ");
    let mut parts = inner.split_whitespace();
    let x: f64 = parts.next()?.parse().ok()?;
    let y: f64 = parts.next()?.parse().ok()?;
    Some((x, y, size))
}

fn attr_f64(tag: &str, name: &str) -> Option<f64> {
    let key = format!("{name}=\"");
    let i = tag.find(&key)?;
    let rest = &tag[i + key.len()..];
    let j = rest.find('"')?;
    rest[..j].parse().ok()
}

fn inject_qr(svg: &str, path_d: &str) -> String {
    let Some((x, y, size)) = parse_qr_box(svg) else {
        return svg.to_string();
    };
    let replacement = format!(
        "<g id=\"qr\" data-size=\"{size}\" data-x=\"{x}\" data-y=\"{y}\" transform=\"translate({x} {y})\"><path fill=\"#1A1A1A\" d=\"{path_d}\"/></g>"
    );
    if let Some(pos) = svg.find("<g id=\"qr\"") {
        if let Some(end_rel) = svg[pos..].find("/>") {
            let end = pos + end_rel + 2;
            let mut out = String::new();
            out.push_str(&svg[..pos]);
            out.push_str(&replacement);
            out.push_str(&svg[end..]);
            return out;
        }
    }
    svg.to_string()
}

fn to_arabic_indic_digits(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '0'..='9' => char::from_u32('٠' as u32 + (c as u32 - '0' as u32)).unwrap_or(c),
            _ => c,
        })
        .collect()
}

pub fn build_svg(
    halaqah: &PublicHalaqah,
    format: CardFormat,
    public_base: &str,
    tz: &str,
) -> Result<String, String> {
    let mut svg = format.template().to_string();

    let name = truncate_chars(&halaqah.name, 40);
    let teacher = truncate_chars(&halaqah.teacher_name, 30);
    let teacher_line = format!("مع المعلّم {teacher}");
    let htype = arabic_type_label(&halaqah.halaqah_type);
    let riwaya = arabic_riwaya_label(&halaqah.riwaya);

    let (date_line, rhythm_display) = match halaqah.first_session_at {
        Some(at) => {
            let city = tz_city_label("ar", tz);
            let rhythm_days = format_rhythm_ar(&halaqah.schedule_days);
            let rhythm = if rhythm_days.is_empty() {
                format!("بتوقيت {city}")
            } else {
                format!("بتوقيت {city} · {rhythm_days}")
            };
            (format_session_ar(at, tz), rhythm)
        }
        None => {
            let city = tz_city_label("ar", tz);
            (
                "المواعيد تُعلن قريبًا".to_string(),
                format!("بتوقيت {city}"),
            )
        }
    };

    let short = short_display_url(public_base, &halaqah.token);
    let full_url = format!(
        "{}/s/{}",
        public_base.trim_end_matches('/'),
        halaqah.token
    );

    let (lx, ly, lw, lh) = format.logo_box();
    svg = inject_brand_logo(&svg, lx, ly, lw, lh);

    svg = set_text_by_id(&svg, "tagline", "منصة تعليم القرآن");
    svg = set_text_by_id(&svg, "halaqah_name", &name);
    svg = set_text_by_id(&svg, "teacher", &teacher_line);
    svg = set_text_by_id(&svg, "type", htype);
    svg = set_text_by_id(&svg, "riwaya", riwaya);
    svg = set_text_by_id(&svg, "first_session", &date_line);
    svg = set_text_by_id(&svg, "tz_and_rhythm", &rhythm_display);
    svg = set_text_by_id(&svg, "short_url", &short);
    svg = set_text_by_id(&svg, "scan_hint", "امسح للانضمام");

    if format == CardFormat::Og {
        let seats = seats_available(halaqah);
        let seats_line = to_arabic_indic_digits(&format!("{seats} مقعدًا متاحًا"));
        svg = set_text_by_id(&svg, "seats", &seats_line);
    }

    let (qx, qy, qsize) = parse_qr_box(&svg).ok_or_else(|| "missing qr box".to_string())?;
    // Path coords are absolute in the QR group's local space after translate —
    // qr_svg_path currently uses absolute x,y; pass 0,0 and rely on transform,
    // OR pass qx,qy with path in document space. Current inject puts path inside
    // translate(x y) group, so path must be in local 0..size coords.
    let path = qr_svg_path(&full_url, 0.0, 0.0, qsize)?;
    let _ = (qx, qy); // retained on the group transform
    svg = inject_qr(&svg, &path);
    Ok(svg)
}

pub fn render_card_png(
    halaqah: &PublicHalaqah,
    format: CardFormat,
    public_base: &str,
) -> Result<Vec<u8>, String> {
    let tz = if halaqah.timezone.trim().is_empty() {
        default_timezone()
    } else {
        halaqah.timezone.as_str()
    };
    let svg = build_svg(halaqah, format, public_base, tz)?;
    let (w, h) = format.pixel_size();

    let mut opt = Options::default();
    opt.fontdb = font_db();

    let tree = Tree::from_str(&svg, &opt).map_err(|e| format!("usvg parse: {e}"))?;
    let mut pixmap = tiny_skia::Pixmap::new(w, h).ok_or_else(|| "pixmap alloc".to_string())?;
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());
    pixmap
        .encode_png()
        .map_err(|e| format!("png encode: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_escapes_ampersand() {
        let svg = r#"<svg><text id="halaqah_name">x</text></svg>"#;
        let out = set_text_by_id(svg, "halaqah_name", "حفظ & تجويد");
        assert!(out.contains("حفظ &amp; تجويد"));
        assert!(!out.contains(">حفظ & تجويد<"));
    }

    #[test]
    fn xml_escape_basic() {
        assert_eq!(xml_escape("a<b>c&d"), "a&lt;b&gt;c&amp;d");
    }
}
