// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use qrcode::types::EcLevel;
use qrcode::QrCode;

/// Quiet-zone padding on each side, in modules (ISO/IEC 18004).
const QUIET_MODULES: usize = 4;

/// Build an SVG path for a QR code scaled into a square of `size` at (`x`, `y`).
/// Dark modules are drawn inside a 4-module quiet zone.
pub fn qr_svg_path(url: &str, x: f64, y: f64, size: f64) -> Result<String, String> {
    let code = QrCode::with_error_correction_level(url.as_bytes(), EcLevel::M)
        .map_err(|e| format!("qr encode: {e}"))?;
    let width = code.width();
    if width == 0 {
        return Err("empty qr".into());
    }
    let total = width + QUIET_MODULES * 2;
    let module = size / total as f64;
    let mut path = String::with_capacity(width * width * 24);
    for row in 0..width {
        for col in 0..width {
            if code[(col, row)] == qrcode::Color::Dark {
                let mx = x + (col + QUIET_MODULES) as f64 * module;
                let my = y + (row + QUIET_MODULES) as f64 * module;
                path.push_str(&format!(
                    "M{mx:.3} {my:.3}h{module:.3}v{module:.3}h-{module:.3}z"
                ));
            }
        }
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Luma;
    use rqrr::PreparedImage;

    #[test]
    fn qr_path_is_scannable() {
        let url = "https://app.maqraa.org/s/abcdefghijklmnop";
        let size = 200.0;
        let path = qr_svg_path(url, 0.0, 0.0, size).expect("path");
        assert!(!path.is_empty());

        let code = QrCode::with_error_correction_level(url.as_bytes(), EcLevel::M).unwrap();
        let w = code.width();
        let quiet = QUIET_MODULES;
        let total = w + quiet * 2;
        let scale = 8usize;
        let dim = total * scale;
        let mut img = image::GrayImage::new(dim as u32, dim as u32);
        for y in 0..dim {
            for x in 0..dim {
                let mx = x / scale;
                let my = y / scale;
                let dark = mx >= quiet
                    && my >= quiet
                    && mx < quiet + w
                    && my < quiet + w
                    && code[(mx - quiet, my - quiet)] == qrcode::Color::Dark;
                img.put_pixel(x as u32, y as u32, Luma([if dark { 0 } else { 255 }]));
            }
        }
        let mut prepared = PreparedImage::prepare(img);
        let grids = prepared.detect_grids();
        assert!(!grids.is_empty(), "expected at least one QR grid");
        let (_meta, content) = grids[0].decode().expect("decode qr");
        assert_eq!(content, url);
    }
}
