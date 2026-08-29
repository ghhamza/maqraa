// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/**
 * Display order for teacher profile qirā'āt pills.
 * Slugs must stay identical to DB / API / profile_constants — ordering only.
 */
export const QIRAAT_OPTIONS = [
  // Visible by default (first 10)
  { slug: "hafs_asim", ar: "حفص عن عاصم" },
  { slug: "warsh_nafi", ar: "ورش عن نافع" },
  { slug: "qalun_nafi", ar: "قالون عن نافع" },
  { slug: "duri_abu_amr", ar: "الدوري عن أبي عمرو" },
  { slug: "shubah_asim", ar: "شعبة عن عاصم" },
  { slug: "susi_abu_amr", ar: "السوسي عن أبي عمرو" },
  { slug: "bazzi_ibn_kathir", ar: "البزي عن ابن كثير" },
  { slug: "qunbul_ibn_kathir", ar: "قنبل عن ابن كثير" },
  { slug: "hisham_ibn_amir", ar: "هشام عن ابن عامر" },
  { slug: "ibn_dhakwan_ibn_amir", ar: "ابن ذكوان عن ابن عامر" },
  // Collapsed group (remaining 10)
  { slug: "khalaf_hamzah", ar: "خلف عن حمزة" },
  { slug: "khallad_hamzah", ar: "خلاد عن حمزة" },
  { slug: "abu_harith_kisai", ar: "أبو الحارث عن الكسائي" },
  { slug: "duri_kisai", ar: "الدوري عن الكسائي" },
  { slug: "ibn_wardan_abu_jafar", ar: "ابن وردان عن أبي جعفر" },
  { slug: "ibn_jammaz_abu_jafar", ar: "ابن جماز عن أبي جعفر" },
  { slug: "ruways_yaqub", ar: "رويس عن يعقوب" },
  { slug: "ruh_yaqub", ar: "روح عن يعقوب" },
  { slug: "ishaq_khalaf", ar: "إسحاق عن خلف" },
  { slug: "idris_khalaf", ar: "إدريس عن خلف" },
] as const;

export type QiraatSlug = (typeof QIRAAT_OPTIONS)[number]["slug"];

/** How many qirā'āt show before the "show more" toggle. */
export const QIRAAT_VISIBLE_COUNT = 10;
