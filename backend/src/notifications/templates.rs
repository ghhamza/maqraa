// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct TemplateVars {
    pub values: HashMap<String, String>,
}

impl TemplateVars {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with(mut self, key: &str, value: impl Into<String>) -> Self {
        self.values.insert(key.to_string(), value.into());
        self
    }
}

#[derive(Debug, Clone)]
pub struct RenderedEmail {
    pub subject: String,
    pub html: String,
    pub text: String,
}

fn normalize_locale(locale: &str) -> &str {
    match locale {
        "ar" | "en" | "fr" => locale,
        _ => "en",
    }
}

fn substitute(template: &str, vars: &TemplateVars) -> String {
    let mut out = template.to_string();
    for (key, value) in &vars.values {
        out = out.replace(&format!("{{{{{key}}}}}"), value);
    }
    out
}

const LOGO_URL: &str = "https://maqraa.org/_next/static/media/lockup-text-left.4585c85b.svg";
const WEBSITE_URL: &str = "https://maqraa.org/";

fn html_escape_attr(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn cta_fallback_copy(locale: &str) -> &'static str {
    match locale {
        "ar" => "إن لم يعمل الزر، انسخ الرابط التالي ولصقه في المتصفح:",
        "fr" => "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
        _ => "If the button doesn't work, copy and paste this link into your browser:",
    }
}

fn footer_copy(locale: &str) -> &'static str {
    match locale {
        "ar" => "المقرأة — منصة تعليم القرآن مفتوحة المصدر",
        "fr" => "Al-Maqraa — plateforme éducative coranique open source",
        _ => "Al-Maqraa — open-source Quran education",
    }
}

fn email_layout(
    locale: &str,
    heading: &str,
    body_paragraphs: &[String],
    cta: Option<(&str, &str)>,
) -> (String, String) {
    let dir = if locale == "ar" { "rtl" } else { "ltr" };
    let font_family = if locale == "ar" {
        "Tahoma, 'Segoe UI', Arial, sans-serif"
    } else {
        "system-ui, -apple-system, 'Segoe UI', sans-serif"
    };

    let body_html: String = body_paragraphs
        .iter()
        .map(|p| {
            format!(
                "<p style=\"margin:0 0 16px;font-size:16px;line-height:1.7;color:#1A1A1A;\">{p}</p>"
            )
        })
        .collect();

    let cta_html = cta.map(|(label, url)| {
        let fallback = cta_fallback_copy(locale);
        let href = html_escape_attr(url);
        format!(
            "<div style=\"margin:24px 0 32px;text-align:center;\">\
             <a href=\"{href}\" style=\"display:inline-block;background:#1B5E20;color:#FFFFFF;\
             text-decoration:none;font-size:16px;font-weight:600;padding:12px 24px;border-radius:8px;\">\
             {label}</a>\
             <p style=\"margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;\">{fallback}</p>\
             <p style=\"margin:8px 0 0;font-size:13px;line-height:1.6;color:#1B5E20;word-break:break-all;\">\
             {url}</p></div>"
        )
    }).unwrap_or_default();

    let cta_text = cta
        .map(|(label, url)| {
            format!(
                "\n\n{label}: {url}\n\n{} {url}",
                cta_fallback_copy(locale)
            )
        })
        .unwrap_or_default();

    let footer_label = footer_copy(locale);

    let html = format!(
        "<!DOCTYPE html><html dir=\"{dir}\"><body style=\"margin:0;padding:0;background:#FAFAF5;\
         font-family:{font_family};\">\
         <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" \
         style=\"background:#FAFAF5;padding:32px 16px;\">\
         <tr><td align=\"center\">\
         <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" \
         style=\"max-width:560px;background:#FFFFFF;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:32px 28px;\">\
         <tr><td style=\"text-align:center;padding-bottom:24px;\">\
         <a href=\"{website_url}\" style=\"text-decoration:none;\">\
         <img src=\"{logo_url}\" alt=\"Al-Maqraa\" width=\"180\" \
         style=\"display:block;margin:0 auto;max-width:180px;height:auto;border:0;\" />\
         </a></td></tr>\
         <tr><td>\
         <h1 style=\"margin:0 0 20px;font-size:22px;line-height:1.4;color:#1A1A1A;\">{heading}</h1>\
         {body_html}\
         {cta_html}\
         </td></tr>\
         <tr><td style=\"padding-top:32px;border-top:1px solid #E5E7EB;\">\
         <p style=\"margin:0;font-size:13px;line-height:1.5;color:#6B7280;text-align:center;\">\
         <a href=\"{website_url}\" style=\"color:#1B5E20;text-decoration:none;\">{footer_label}</a>\
         </p></td></tr>\
         </table></td></tr></table></body></html>",
        website_url = WEBSITE_URL,
        logo_url = LOGO_URL,
    );

    let text_body: String = body_paragraphs.join("\n\n");
    let text = format!(
        "{heading}\n\n{text_body}{cta_text}\n\n{footer_label}: {website_url}",
        website_url = WEBSITE_URL,
    );

    (html, text)
}

pub fn render(template_key: &str, locale: &str, vars: &TemplateVars) -> RenderedEmail {
    let locale = normalize_locale(locale);
    let sub = |s: &str| substitute(s, vars);

    match template_key {
        "welcome_verify" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "مرحبًا بك في المقرأة — فعِّل بريدك الإلكتروني",
                    "مرحبًا {{name}}",
                    "أهلًا بك في المقرأة. لتفعيل حسابك، يُرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه.",
                    "هذا الرابط صالح لمدة ٢٤ ساعة. إن لم تنشئ هذا الحساب فتجاهل هذه الرسالة.",
                    "تفعيل البريد الإلكتروني",
                ),
                "fr" => (
                    "Bienvenue sur Al-Maqraa — vérifiez votre e-mail",
                    "Bienvenue, {{name}}",
                    "Bienvenue sur Al-Maqraa. Pour activer votre compte, veuillez confirmer votre e-mail à l'aide du bouton ci-dessous.",
                    "Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
                    "Vérifier l'e-mail",
                ),
                _ => (
                    "Welcome to Al-Maqraa — verify your email",
                    "Welcome, {{name}}",
                    "Welcome to Al-Maqraa. To activate your account, please confirm your email using the button below.",
                    "This link is valid for 24 hours. If you didn't create this account, you can ignore this email.",
                    "Verify email",
                ),
            };
            let verify_url = vars.values.get("verify_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1), sub(p2)],
                Some((cta_label, &verify_url)),
            );
            RenderedEmail {
                subject: subject.to_string(),
                html,
                text,
            }
        }
        "password_reset" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "إعادة تعيين كلمة المرور",
                    "إعادة تعيين كلمة المرور",
                    "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط الزر أدناه لتعيين كلمة مرور جديدة.",
                    "هذا الرابط صالح لمدة ساعة واحدة. إن لم تطلب ذلك فتجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.",
                    "إعادة تعيين كلمة المرور",
                ),
                "fr" => (
                    "Réinitialiser votre mot de passe",
                    "Réinitialiser le mot de passe",
                    "Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez le bouton ci-dessous pour en définir un nouveau.",
                    "Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe reste inchangé.",
                    "Réinitialiser",
                ),
                _ => (
                    "Reset your password",
                    "Reset your password",
                    "We received a request to reset your account password. Use the button below to set a new one.",
                    "This link is valid for 1 hour. If you didn't request this, ignore this email — your password stays unchanged.",
                    "Reset password",
                ),
            };
            let reset_url = vars.values.get("reset_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1), sub(p2)],
                Some((cta_label, &reset_url)),
            );
            RenderedEmail {
                subject: subject.to_string(),
                html,
                text,
            }
        }
        "enrollment_approved" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "تم قبول انضمامك إلى حلقة {{room_name}}",
                    "تهانينا {{name}}",
                    "تم قبول طلب انضمامك إلى حلقة «{{room_name}}» مع المعلّم {{teacher_name}}.",
                    "يمكنك الآن الدخول إلى الحلقة ومتابعة جلساتها.",
                    "الذهاب إلى الحلقة",
                ),
                "fr" => (
                    "Vous avez rejoint {{room_name}}",
                    "Félicitations, {{name}}",
                    "Votre demande pour rejoindre « {{room_name}} » avec {{teacher_name}} a été acceptée.",
                    "Vous pouvez maintenant ouvrir la halaqah et suivre ses séances.",
                    "Aller à la halaqah",
                ),
                _ => (
                    "You've joined {{room_name}}",
                    "Congratulations, {{name}}",
                    "Your request to join \"{{room_name}}\" with {{teacher_name}} has been approved.",
                    "You can now open the halaqah and follow its sessions.",
                    "Go to halaqah",
                ),
            };
            let app_url = vars.values.get("app_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1), sub(p2)],
                Some((cta_label, &app_url)),
            );
            RenderedEmail {
                subject: sub(subject),
                html,
                text,
            }
        }
        "enrollment_rejected" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "بخصوص طلب انضمامك إلى {{room_name}}",
                    "مرحبًا {{name}}",
                    "نعتذر، لم يُقبل طلب انضمامك إلى حلقة «{{room_name}}» هذه المرة.",
                    "يمكنك تصفّح حلقات أخرى متاحة والانضمام إليها في أي وقت.",
                    "تصفّح الحلقات",
                ),
                "fr" => (
                    "Concernant votre demande pour {{room_name}}",
                    "Bonjour {{name}}",
                    "Nous sommes désolés — votre demande pour rejoindre « {{room_name}} » n'a pas été acceptée cette fois.",
                    "Vous pouvez parcourir d'autres halaqat disponibles et demander à les rejoindre.",
                    "Parcourir les halaqat",
                ),
                _ => (
                    "Update on your request to join {{room_name}}",
                    "Hello {{name}}",
                    "We're sorry — your request to join \"{{room_name}}\" wasn't approved this time.",
                    "You can browse other available halaqat and request to join any of them.",
                    "Browse halaqat",
                ),
            };
            let app_url = vars.values.get("app_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1), sub(p2)],
                Some((cta_label, &app_url)),
            );
            RenderedEmail {
                subject: sub(subject),
                html,
                text,
            }
        }
        other => {
            tracing::warn!(template_key = %other, "unknown email template");
            let (html, text) = email_layout(locale, "Notification", &[], None);
            RenderedEmail {
                subject: "Notification".to_string(),
                html,
                text,
            }
        }
    }
}
