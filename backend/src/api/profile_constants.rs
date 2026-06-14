// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

pub const SPOKEN_LANGUAGE_CODES: &[&str] = &["ar", "en", "fr", "id", "ru"];

pub const QIRAAT_SLUGS: &[&str] = &[
    "qalun_nafi",
    "warsh_nafi",
    "bazzi_ibn_kathir",
    "qunbul_ibn_kathir",
    "duri_abu_amr",
    "susi_abu_amr",
    "hisham_ibn_amir",
    "ibn_dhakwan_ibn_amir",
    "shubah_asim",
    "hafs_asim",
    "khalaf_hamzah",
    "khallad_hamzah",
    "duri_kisai",
    "abu_harith_kisai",
    "ibn_wardan_abu_jafar",
    "ibn_jammaz_abu_jafar",
    "ruways_yaqub",
    "ruh_yaqub",
    "ishaq_khalaf",
    "idris_khalaf",
];

pub fn is_valid_spoken_language(code: &str) -> bool {
    SPOKEN_LANGUAGE_CODES.contains(&code)
}

pub fn is_valid_qiraat_slug(slug: &str) -> bool {
    QIRAAT_SLUGS.contains(&slug)
}
