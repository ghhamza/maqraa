// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

export const QIRAAT_OPTIONS = [
  { slug: "qalun_nafi", ar: "قالون عن نافع" },
  { slug: "warsh_nafi", ar: "ورش عن نافع" },
  { slug: "bazzi_ibn_kathir", ar: "البزي عن ابن كثير" },
  { slug: "qunbul_ibn_kathir", ar: "قنبل عن ابن كثير" },
  { slug: "duri_abu_amr", ar: "الدوري عن أبي عمرو" },
  { slug: "susi_abu_amr", ar: "السوسي عن أبي عمرو" },
  { slug: "hisham_ibn_amir", ar: "هشام عن ابن عامر" },
  { slug: "ibn_dhakwan_ibn_amir", ar: "ابن ذكوان عن ابن عامر" },
  { slug: "shubah_asim", ar: "شعبة عن عاصم" },
  { slug: "hafs_asim", ar: "حفص عن عاصم" },
  { slug: "khalaf_hamzah", ar: "خلف عن حمزة" },
  { slug: "khallad_hamzah", ar: "خلاد عن حمزة" },
  { slug: "duri_kisai", ar: "الدوري عن الكسائي" },
  { slug: "abu_harith_kisai", ar: "أبو الحارث عن الكسائي" },
  { slug: "ibn_wardan_abu_jafar", ar: "ابن وردان عن أبي جعفر" },
  { slug: "ibn_jammaz_abu_jafar", ar: "ابن جماز عن أبي جعفر" },
  { slug: "ruways_yaqub", ar: "رويس عن يعقوب" },
  { slug: "ruh_yaqub", ar: "روح عن يعقوب" },
  { slug: "ishaq_khalaf", ar: "إسحاق عن خلف" },
  { slug: "idris_khalaf", ar: "إدريس عن خلف" },
] as const;

export type QiraatSlug = (typeof QIRAAT_OPTIONS)[number]["slug"];
