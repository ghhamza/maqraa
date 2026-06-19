// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Html,
};
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::Deserialize;

use super::{
    resolve_share, HalaqahTeaser, InstanceTeaser, SessionTeaser, ShareError, TeaserPayload,
};
use crate::api::AppState;

const SITE_NAME: &str = "المقرأة";
const SHARE_LOGO_PATH: &str = "/logo-icon.svg";

fn share_logo_url(base: &str) -> String {
    format!("{base}{SHARE_LOGO_PATH}")
}

struct ShareLocale {
    lang: &'static str,
    dir: &'static str,
    og_locale: &'static str,
}

#[derive(Deserialize)]
pub struct ShareLandingQuery {
    pub lang: Option<String>,
}

pub async fn share_landing(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(query): Query<ShareLandingQuery>,
    headers: HeaderMap,
) -> (StatusCode, Html<String>) {
    let locale = resolve_locale(
        query.lang.as_deref(),
        headers
            .get("accept-language")
            .and_then(|v| v.to_str().ok()),
    );
    let base = state.config.public_base_url.trim_end_matches('/');
    let page_url = format!("{base}/s/{}", urlencoding_path_segment(&token));
    let card_image = share_logo_url(base);
    let token_trimmed = token.trim();
    let register_url = format!(
        "{base}/register?next={}",
        urlencoding_path_segment(&format!("/share/{token_trimmed}"))
    );
    let login_url = format!(
        "{base}/login?next={}",
        urlencoding_path_segment(&format!("/share/{token_trimmed}"))
    );

    match resolve_share(&state, &token, true).await {
        Ok(payload) => {
            let html = render_success_page(
                &state,
                &locale,
                &payload,
                &page_url,
                &card_image,
                &register_url,
                &login_url,
                token_trimmed,
            );
            (StatusCode::OK, Html(html))
        }
        Err(ShareError::InvalidLink) => {
            let html = render_invalid_page(&locale, &page_url, base, &card_image);
            (StatusCode::OK, Html(html))
        }
        Err(ShareError::Db(_)) => {
            let html = render_invalid_page(&locale, &page_url, base, &card_image);
            (StatusCode::OK, Html(html))
        }
    }
}

fn urlencoding_path_segment(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' | '/' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

fn resolve_locale(query_lang: Option<&str>, accept_language: Option<&str>) -> ShareLocale {
    if let Some(lang) = query_lang {
        if let Some(loc) = locale_from_tag(lang) {
            return loc;
        }
    }
    if let Some(hdr) = accept_language {
        for part in hdr.split(',') {
            let tag = part.trim().split(';').next().unwrap_or("").trim();
            if tag.is_empty() {
                continue;
            }
            if let Some(loc) = locale_from_tag(tag) {
                return loc;
            }
        }
    }
    locale_from_tag("ar").unwrap()
}

fn locale_from_tag(tag: &str) -> Option<ShareLocale> {
    let primary = tag.split('-').next()?.to_lowercase();
    match primary.as_str() {
        "en" => Some(ShareLocale {
            lang: "en",
            dir: "ltr",
            og_locale: "en_US",
        }),
        "fr" => Some(ShareLocale {
            lang: "fr",
            dir: "ltr",
            og_locale: "fr_FR",
        }),
        "ar" => Some(ShareLocale {
            lang: "ar",
            dir: "rtl",
            og_locale: "ar_SA",
        }),
        _ => None,
    }
}

fn t(lang: &str, key: &str) -> &'static str {
    match (lang, key) {
        ("en", "teaser.join_halaqah") => "Join the circle",
        ("fr", "teaser.join_halaqah") => "Rejoindre le cercle",
        (_, "teaser.join_halaqah") => "انضمّ إلى الحلقة",

        ("en", "teaser.teacher") => "Teacher",
        ("fr", "teaser.teacher") => "Enseignant",
        (_, "teaser.teacher") => "المعلّم",

        ("en", "teaser.available") => "Available",
        ("fr", "teaser.available") => "Disponible",
        (_, "teaser.available") => "متاح",

        ("en", "teaser.full") => "Full",
        ("fr", "teaser.full") => "Complet",
        (_, "teaser.full") => "مكتمل",

        ("en", "teaser.register") => "Create account",
        ("fr", "teaser.register") => "Créer un compte",
        (_, "teaser.register") => "إنشاء حساب",

        ("en", "teaser.login") => "Log in",
        ("fr", "teaser.login") => "Se connecter",
        (_, "teaser.login") => "تسجيل الدخول",

        ("en", "teaser.invalid") => "This link is no longer valid",
        ("fr", "teaser.invalid") => "Ce lien n'est plus valide",
        (_, "teaser.invalid") => "هذا الرابط لم يعد صالحًا",

        ("en", "teaser.go_home") => "Go to Al-Maqraa",
        ("fr", "teaser.go_home") => "Aller à Al-Maqraa",
        (_, "teaser.go_home") => "الذهاب إلى المقرأة",

        ("en", "teaser.session_at") => "Session time",
        ("fr", "teaser.session_at") => "Heure de la séance",
        (_, "teaser.session_at") => "موعد الحصّة",

        ("en", "teaser.duration") => "Duration",
        ("fr", "teaser.duration") => "Durée",
        (_, "teaser.duration") => "المدّة",

        ("en", "teaser.minutes") => "min",
        ("fr", "teaser.minutes") => "min",
        (_, "teaser.minutes") => "د",

        ("en", "teaser.room") => "Circle",
        ("fr", "teaser.room") => "Cercle",
        (_, "teaser.room") => "الحلقة",

        ("en", "share.liveNow") => "Live now",
        ("fr", "share.liveNow") => "En direct",
        (_, "share.liveNow") => "مباشر الآن",

        ("en", "share.joinNow") => "Join now",
        ("fr", "share.joinNow") => "Rejoindre",
        (_, "share.joinNow") => "انضمّ الآن",

        ("en", "calendar.add") => "Add to calendar",
        ("fr", "calendar.add") => "Ajouter au calendrier",
        (_, "calendar.add") => "إضافة إلى التقويم",

        _ => "",
    }
}

fn halaqah_type_label<'a>(lang: &str, value: &'a str) -> &'a str {
    match (lang, value) {
        ("en", "hifz") => "Memorization",
        ("en", "tilawa") => "Recitation",
        ("en", "muraja") => "Review",
        ("en", "tajweed") => "Tajweed",
        ("fr", "hifz") => "Mémorisation",
        ("fr", "tilawa") => "Récitation",
        ("fr", "muraja") => "Révision",
        ("fr", "tajweed") => "Tajwīd",
        ("ar", "hifz") => "حفظ",
        ("ar", "tilawa") => "تلاوة",
        ("ar", "muraja") => "مراجعة",
        ("ar", "tajweed") => "تجويد",
        _ => value,
    }
}

fn riwaya_label<'a>(lang: &str, value: &'a str) -> &'a str {
    match (lang, value) {
        ("en", "hafs") => "Ḥafṣ",
        ("fr", "hafs") => "Ḥafṣ",
        ("ar", "hafs") => "حفص",
        ("en", "warsh") => "Warsh",
        ("fr", "warsh") => "Warsh",
        ("ar", "warsh") => "ورش",
        _ => value,
    }
}

fn riwaya_badge_style(riwaya: &str) -> &'static str {
    if riwaya == "hafs" {
        "background:#1B5E20;color:#fff;border:1px solid #1B5E20;"
    } else {
        "background:#E8F5E9;color:#1B5E20;border:1px solid #4CAF50;"
    }
}

pub fn html_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

fn format_session_time(state: &AppState, at: DateTime<Utc>, lang: &str) -> String {
    let tz: Tz = state
        .config
        .app_display_tz
        .parse()
        .unwrap_or(chrono_tz::Asia::Riyadh);
    let local = at.with_timezone(&tz);
    match lang {
        "en" => local.format("%A %d %B %Y, %H:%M").to_string(),
        "fr" => local.format("%A %d %B %Y, %H:%M").to_string(),
        _ => local.format("%A %d %B %Y، %H:%M").to_string(),
    }
}

fn auth_redirect_script(token: &str) -> String {
    let safe_token: String = token
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    format!(
        r#"<script>try{{if(localStorage.getItem("miqraa_token")){{window.location.replace("/share/{safe_token}");}}}}catch(e){{}}</script>"#
    )
}

fn page_shell(
    locale: &ShareLocale,
    title: &str,
    description: &str,
    page_url: &str,
    card_image: &str,
    body: &str,
    auth_redirect: Option<&str>,
) -> String {
    let redirect = auth_redirect.unwrap_or("");
    format!(
        r#"<!DOCTYPE html>
<html lang="{lang}" dir="{dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{card_image}">
<meta property="og:url" content="{page_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{site_name}">
<meta property="og:locale" content="{og_locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{card_image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif;
  background: #FAFAF5;
  color: #1A1A1A;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  line-height: 1.6;
}}
.wrap {{ width: 100%; max-width: 480px; }}
.logo-img {{
  display: block;
  width: 120px;
  height: auto;
  margin: 0 auto 24px;
}}
.card {{
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(26, 26, 26, 0.08);
  padding: 32px 28px;
}}
.card h1 {{
  font-family: Amiri, serif;
  font-size: 1.75rem;
  color: #1B5E20;
  margin-bottom: 12px;
  line-height: 1.35;
}}
.meta {{ color: #6B7280; font-size: 0.95rem; margin-bottom: 8px; }}
.meta strong {{ color: #1A1A1A; font-weight: 600; }}
.desc {{
  color: #1A1A1A;
  font-size: 0.95rem;
  margin: 16px 0;
  white-space: pre-wrap;
}}
.badges {{ display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }}
.badge {{
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}}
.status {{
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}}
.status-open {{ background: #E8F5E9; color: #1B5E20; }}
.status-full {{ background: #FEF3C7; color: #92400E; }}
.ctas {{ display: flex; flex-direction: column; gap: 12px; margin-top: 28px; }}
.btn {{
  display: block;
  text-align: center;
  text-decoration: none;
  padding: 14px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
}}
.btn-primary {{ background: #1B5E20; color: #fff; }}
.btn-secondary {{
  background: #fff;
  color: #1B5E20;
  border: 2px solid #1B5E20;
}}
.invalid-msg {{
  font-family: Amiri, serif;
  font-size: 1.5rem;
  color: #1A1A1A;
  text-align: center;
  margin-bottom: 24px;
}}
.accent {{ color: #D4A843; }}
.live-badge {{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #FFEBEE;
  color: #EF5350;
}}
.live-dot {{
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EF5350;
  animation: live-pulse 1.5s ease-in-out infinite;
}}
@keyframes live-pulse {{
  0%, 100% {{ opacity: 1; transform: scale(1); }}
  50% {{ opacity: 0.5; transform: scale(0.85); }}
}}
</style>
</head>
<body>
{redirect}
<div class="wrap">
  <img class="logo-img" src="{logo_src}" alt="{site_name}" width="120" height="120">
  <div class="card">{body}</div>
</div>
</body>
</html>"#,
        lang = locale.lang,
        dir = locale.dir,
        title = html_escape(title),
        description = html_escape(description),
        card_image = html_escape(card_image),
        page_url = html_escape(page_url),
        site_name = html_escape(SITE_NAME),
        logo_src = html_escape(SHARE_LOGO_PATH),
        og_locale = locale.og_locale,
        body = body,
        redirect = redirect,
    )
}

fn render_invalid_page(
    locale: &ShareLocale,
    page_url: &str,
    home_url: &str,
    card_image: &str,
) -> String {
    let title = t(locale.lang, "teaser.invalid");
    let body = format!(
        r#"<p class="invalid-msg">{invalid}</p>
<div class="ctas">
  <a class="btn btn-primary" href="{home}">{go_home}</a>
</div>"#,
        invalid = html_escape(title),
        home = html_escape(home_url),
        go_home = html_escape(t(locale.lang, "teaser.go_home")),
    );
    page_shell(
        locale,
        &format!("{title} — {SITE_NAME}"),
        title,
        page_url,
        card_image,
        &body,
        None,
    )
}

fn render_success_page(
    state: &AppState,
    locale: &ShareLocale,
    payload: &TeaserPayload,
    page_url: &str,
    card_image: &str,
    register_url: &str,
    login_url: &str,
    token: &str,
) -> String {
    let (title, description, body, primary_cta_key) = match payload {
        TeaserPayload::Halaqah {
            teaser,
            description,
        } => {
            let (t, d, b) = render_halaqah_body(locale, teaser, description.as_deref());
            (t, d, b, "teaser.register")
        }
        TeaserPayload::Invite {
            teaser,
            description,
        } => {
            let base = HalaqahTeaser {
                name: teaser.name.clone(),
                teacher_name: teaser.teacher_name.clone(),
                riwaya: teaser.riwaya.clone(),
                halaqah_type: teaser.halaqah_type.clone(),
                is_public: teaser.is_public,
                enrollment_open: teaser.enrollment_open,
                requires_approval: teaser.requires_approval,
                max_students: teaser.max_students,
                enrolled_count: teaser.enrolled_count,
            };
            let (t, d, b) = render_halaqah_body(locale, &base, description.as_deref());
            (t, d, b, "teaser.register")
        }
        TeaserPayload::Session { teaser } => render_session_body(state, locale, teaser, token),
        TeaserPayload::Instance { teaser } => {
            let (t, d, b) = render_instance_body(locale, teaser);
            (t, d, b, "teaser.register")
        }
    };

    let ctas = format!(
        r#"<div class="ctas">
  <a class="btn btn-primary" href="{register}">{register_label}</a>
  <a class="btn btn-secondary" href="{login}">{login_label}</a>
</div>"#,
        register = html_escape(register_url),
        register_label = html_escape(t(locale.lang, primary_cta_key)),
        login = html_escape(login_url),
        login_label = html_escape(t(locale.lang, "teaser.login")),
    );

    let full_body = format!("{body}{ctas}");
    page_shell(
        locale,
        &title,
        &description,
        page_url,
        card_image,
        &full_body,
        Some(&auth_redirect_script(token)),
    )
}

fn render_halaqah_body(
    locale: &ShareLocale,
    teaser: &HalaqahTeaser,
    description: Option<&str>,
) -> (String, String, String) {
    let name = html_escape(&teaser.name);
    let teacher = html_escape(&teaser.teacher_name);
    let riwaya = html_escape(riwaya_label(locale.lang, &teaser.riwaya));
    let htype = html_escape(halaqah_type_label(locale.lang, &teaser.halaqah_type));
    let is_full = teaser.enrolled_count >= teaser.max_students as i64;
    let status_class = if is_full { "status-full" } else { "status-open" };
    let status_label = html_escape(if is_full {
        t(locale.lang, "teaser.full")
    } else {
        t(locale.lang, "teaser.available")
    });

    let heading = t(locale.lang, "teaser.join_halaqah");

    let desc_block = description
        .filter(|d| !d.trim().is_empty())
        .map(|d| format!(r#"<p class="desc">{}</p>"#, html_escape(d)))
        .unwrap_or_default();

    let body = format!(
        r#"<p class="meta">{heading}</p>
<h1>{name}</h1>
<p class="meta"><strong>{teacher_label}:</strong> {teacher}</p>
<div class="badges">
  <span class="badge" style="{riwaya_style}">{riwaya}</span>
  <span class="badge" style="background:#FAFAF5;color:#1A1A1A;border:1px solid #D4A843;">{htype}</span>
  <span class="status {status_class}">{status_label}</span>
</div>
{desc_block}"#,
        heading = html_escape(heading),
        name = name,
        teacher_label = html_escape(t(locale.lang, "teaser.teacher")),
        teacher = teacher,
        riwaya_style = riwaya_badge_style(&teaser.riwaya),
        riwaya = riwaya,
        htype = htype,
        status_class = status_class,
        status_label = status_label,
        desc_block = desc_block,
    );

    let page_title = format!("«{}» — {}", teaser.name, SITE_NAME);
    let meta_desc = match locale.lang {
        "en" => format!("Join {} with teacher {}", teaser.name, teaser.teacher_name),
        "fr" => format!(
            "Rejoignez {} avec l'enseignant {}",
            teaser.name, teaser.teacher_name
        ),
        _ => format!("انضمّ إلى {} مع المعلّم {}", teaser.name, teaser.teacher_name),
    };

    (page_title, meta_desc, body)
}

fn render_session_body(
    state: &AppState,
    locale: &ShareLocale,
    teaser: &SessionTeaser,
    token: &str,
) -> (String, String, String, &'static str) {
    let title_text = teaser
        .title
        .as_deref()
        .filter(|t| !t.trim().is_empty())
        .unwrap_or(&teaser.room_name);
    let title = html_escape(title_text);
    let room = html_escape(&teaser.room_name);
    let teacher = html_escape(&teaser.teacher_name);
    let is_live = teaser.status == "in_progress";

    let body = if is_live {
        let live_label = html_escape(t(locale.lang, "share.liveNow"));
        format!(
            r#"<div class="badges">
  <span class="live-badge"><span class="live-dot" aria-hidden="true"></span>{live_label}</span>
</div>
<h1>{title}</h1>
<p class="meta"><strong>{room_label}:</strong> {room}</p>
<p class="meta"><strong>{teacher_label}:</strong> {teacher}</p>"#,
            live_label = live_label,
            title = title,
            room_label = html_escape(t(locale.lang, "teaser.room")),
            room = room,
            teacher_label = html_escape(t(locale.lang, "teaser.teacher")),
            teacher = teacher,
        )
    } else {
        let when = html_escape(&format_session_time(state, teaser.scheduled_at, locale.lang));
        let duration = format!("{} {}", teaser.duration_minutes, t(locale.lang, "teaser.minutes"));
        let base = state.config.public_base_url.trim_end_matches('/');
        let ics_url = html_escape(&format!("{base}/s/{}/ics", urlencoding_path_segment(token)));
        let calendar_label = html_escape(t(locale.lang, "calendar.add"));
        format!(
            r#"<h1>{title}</h1>
<p class="meta"><strong>{room_label}:</strong> {room}</p>
<p class="meta"><strong>{teacher_label}:</strong> {teacher}</p>
<p class="meta"><strong>{session_at}:</strong> {when}</p>
<p class="meta"><strong>{duration_label}:</strong> {duration}</p>
<p class="meta" style="margin-top:16px;">
  <a class="calendar-link" href="{ics_url}" style="color:#1B5E20;font-weight:600;text-decoration:none;">
    {calendar_label}
  </a>
</p>"#,
            title = title,
            room_label = html_escape(t(locale.lang, "teaser.room")),
            room = room,
            teacher_label = html_escape(t(locale.lang, "teaser.teacher")),
            teacher = teacher,
            session_at = html_escape(t(locale.lang, "teaser.session_at")),
            when = when,
            duration_label = html_escape(t(locale.lang, "teaser.duration")),
            duration = html_escape(&duration),
            ics_url = ics_url,
            calendar_label = calendar_label,
        )
    };

    let page_title = format!("{} — {}", title_text, SITE_NAME);
    let meta_desc = match locale.lang {
        "en" if is_live => format!("Join live: {title_text} — {}", teaser.room_name),
        "fr" if is_live => format!("Rejoindre en direct : {title_text} — {}", teaser.room_name),
        _ if is_live => format!("انضمّ مباشرة: {title_text} — {}", teaser.room_name),
        "en" => format!("{title_text} — {}", teaser.room_name),
        "fr" => format!("{title_text} — {}", teaser.room_name),
        _ => format!("{title_text} — {}", teaser.room_name),
    };

    let primary_cta = if is_live {
        "share.joinNow"
    } else {
        "teaser.register"
    };

    (page_title, meta_desc, body, primary_cta)
}

fn render_instance_body(_locale: &ShareLocale, teaser: &InstanceTeaser) -> (String, String, String) {
    let app_name = html_escape(teaser.app_name);
    let tagline = html_escape(teaser.tagline);
    let body = format!(
        r#"<h1>{app_name}</h1>
<p class="meta accent">{tagline}</p>"#,
        app_name = app_name,
        tagline = tagline,
    );
    let page_title = format!("{} — {}", teaser.app_name, SITE_NAME);
    (page_title, teaser.tagline.to_string(), body)
}
