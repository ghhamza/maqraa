// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct TemplateVars {
    pub values: HashMap<String, String>,
    /// Extra body paragraphs appended after the intro (e.g. digest signup lines).
    pub list_lines: Vec<String>,
}

impl TemplateVars {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with(mut self, key: &str, value: impl Into<String>) -> Self {
        self.values.insert(key.to_string(), value.into());
        self
    }

    pub fn with_list_lines(mut self, lines: Vec<String>) -> Self {
        self.list_lines = lines;
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
        "enrollment_requested" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "طلب انضمام جديد إلى حلقة {{room_name}}",
                    "مرحبًا {{name}}",
                    "قدّم الطالب {{student_name}} طلبًا للانضمام إلى حلقتك «{{room_name}}».",
                    "يمكنك قبول الطلب أو رفضه من صفحة الحلقة.",
                    "مراجعة الطلب",
                ),
                "fr" => (
                    "Nouvelle demande pour {{room_name}}",
                    "Bonjour {{name}}",
                    "{{student_name}} a demandé à rejoindre votre halaqah « {{room_name}} ».",
                    "Vous pouvez accepter ou refuser depuis la page de la halaqah.",
                    "Examiner la demande",
                ),
                _ => (
                    "New join request for {{room_name}}",
                    "Hello {{name}}",
                    "{{student_name}} has requested to join your halaqah \"{{room_name}}\".",
                    "You can approve or reject the request from the halaqah page.",
                    "Review request",
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
        "session_reminder" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "تذكير: جلسة {{session_title}} قريبًا",
                    "تذكير بالجلسة",
                    "لديك جلسة «{{session_title}}» في حلقة «{{room_name}}» بتاريخ {{session_time}}.",
                    "نراك هناك إن شاء الله.",
                    "الذهاب إلى الجلسة",
                ),
                "fr" => (
                    "Rappel : {{session_title}} approche",
                    "Rappel de séance",
                    "Vous avez une séance « {{session_title}} » dans « {{room_name}} » le {{session_time}}.",
                    "À bientôt.",
                    "Aller à la séance",
                ),
                _ => (
                    "Reminder: {{session_title}} is coming up",
                    "Session reminder",
                    "You have a session \"{{session_title}}\" in \"{{room_name}}\" on {{session_time}}.",
                    "See you there.",
                    "Go to session",
                ),
            };
            let session_url = vars.values.get("session_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1), sub(p2)],
                Some((cta_label, &session_url)),
            );
            RenderedEmail {
                subject: sub(subject),
                html,
                text,
            }
        }
        "session_cancelled" => {
            let (subject, heading, p1, cta_label) = match locale {
                "ar" => (
                    "إلغاء جلسة {{session_title}}",
                    "إلغاء جلسة",
                    "نأسف لإبلاغك بأن جلسة «{{session_title}}» في حلقة «{{room_name}}» المقرّرة بتاريخ {{session_time}} قد أُلغيت.",
                    "الذهاب إلى الحلقة",
                ),
                "fr" => (
                    "{{session_title}} a été annulée",
                    "Séance annulée",
                    "Nous vous informons que « {{session_title}} » dans « {{room_name}} » prévue le {{session_time}} a été annulée.",
                    "Voir la halaqah",
                ),
                _ => (
                    "{{session_title}} has been cancelled",
                    "Session cancelled",
                    "We're sorry to let you know that \"{{session_title}}\" in \"{{room_name}}\" scheduled for {{session_time}} has been cancelled.",
                    "View halaqah",
                ),
            };
            let app_url = vars.values.get("app_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1)],
                Some((cta_label, &app_url)),
            );
            RenderedEmail {
                subject: sub(subject),
                html,
                text,
            }
        }
        "session_rescheduled" => {
            let (subject, heading, p1, cta_label) = match locale {
                "ar" => (
                    "تغيير موعد جلسة {{session_title}}",
                    "تغيير موعد الجلسة",
                    "تم تغيير موعد جلسة «{{session_title}}» في حلقة «{{room_name}}» إلى {{session_time}}.",
                    "الذهاب إلى الجلسة",
                ),
                "fr" => (
                    "{{session_title}} a été reprogrammée",
                    "Séance reprogrammée",
                    "« {{session_title}} » dans « {{room_name}} » a été déplacée au {{session_time}}.",
                    "Aller à la séance",
                ),
                _ => (
                    "{{session_title}} has been rescheduled",
                    "Session rescheduled",
                    "\"{{session_title}}\" in \"{{room_name}}\" has been moved to {{session_time}}.",
                    "Go to session",
                ),
            };
            let session_url = vars.values.get("session_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1)],
                Some((cta_label, &session_url)),
            );
            RenderedEmail {
                subject: sub(subject),
                html,
                text,
            }
        }
        "recitation_feedback" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "ملاحظات جديدة على تلاوتك",
                    "مرحبًا {{name}}",
                    "سجّل معلّمك تقييمًا جديدًا لتلاوتك ({{recitation_ref}}) بتقدير: {{grade_label}}.",
                    "يمكنك الاطلاع على التفاصيل والملاحظات في حسابك.",
                    "عرض التلاوة",
                ),
                "fr" => (
                    "Nouveau retour sur votre récitation",
                    "Bonjour {{name}}",
                    "Votre enseignant a ajouté un retour sur votre récitation ({{recitation_ref}}), note : {{grade_label}}.",
                    "Consultez les détails et les remarques dans votre compte.",
                    "Voir la récitation",
                ),
                _ => (
                    "New feedback on your recitation",
                    "Hello {{name}}",
                    "Your teacher logged new feedback on your recitation ({{recitation_ref}}), graded {{grade_label}}.",
                    "You can review the details and notes in your account.",
                    "View recitation",
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
                subject: subject.to_string(),
                html,
                text,
            }
        }
        "profile_completion_reminder" => {
            let (subject, heading, p1, cta_label) = match locale {
                "ar" => (
                    "أكمل ملفك الشخصي في المقرأة",
                    "مرحبًا {{name}}",
                    "لم تُكمل بيانات ملفك الشخصي بعد. إكمالها يستغرق أقل من دقيقة ويساعدنا على تحسين تجربتك.",
                    "إكمال الملف",
                ),
                "fr" => (
                    "Complétez votre profil Al-Maqraa",
                    "Bonjour {{name}}",
                    "Vous n'avez pas encore terminé votre profil. Cela prend moins d'une minute et améliore votre expérience.",
                    "Compléter le profil",
                ),
                _ => (
                    "Complete your Al-Maqraa profile",
                    "Hello {{name}}",
                    "You haven't finished setting up your profile yet. It takes less than a minute and helps us improve your experience.",
                    "Complete profile",
                ),
            };
            let app_url = vars.values.get("app_url").cloned().unwrap_or_default();
            let (html, text) = email_layout(
                locale,
                &sub(heading),
                &[sub(p1)],
                Some((cta_label, &app_url)),
            );
            RenderedEmail {
                subject: subject.to_string(),
                html,
                text,
            }
        }
        "first_session_guide" => {
            let (subject, heading, paragraphs) = match locale {
                "ar" => (
                    "إنشاء أول حصة في حلقتك",
                    "إنشاء أول حصة في حلقتك",
                    &[
                        "السلام عليكم ورحمة الله وبركاته، {{name}}،",
                        "فيما يلي توضيح سريع للفرق بين «الحلقة» و«الحصة»:",
                        "• الحلقة: هي الفصل الدائم الذي ينتمي إليه الطلاب — لها اسمها ونوعها وقائمة طلابها، وتبقى موجودة باستمرار.",
                        "• الحصة: هي اللقاء المُجدوَل داخل الحلقة في وقتٍ محدد — وفيها تجري التلاوة المباشرة والتصحيح. كل حلقة تحتوي على عدة حصص عبر الزمن.",
                        "باختصار: الحلقة هي الإطار الدائم، والحصة هي الموعد الفعلي للدرس.",
                        "خطوات إنشاء أول حصة:",
                        "١. فتح الحلقة من قائمة الحلقات.",
                        "٢. اختيار «إنشاء حصة» من داخل الحلقة.",
                        "٣. تحديد العنوان والتاريخ والوقت والمدة، ثم الحفظ.",
                        "وبذلك تصبح الحصة جاهزة، ويتمكن الطلاب من الانضمام في موعدها.",
                        "ولأي مساعدة، نحن في الخدمة.",
                    ][..],
                ),
                "fr" => (
                    "Créez votre première session",
                    "Créez votre première session",
                    &[
                        "Assalamou alaykoum {{name}},",
                        "Pour vous aider à démarrer, voici une explication rapide de la différence entre une « halaqa » et une « session » :",
                        "• La halaqa (room) : la classe permanente à laquelle vos élèves appartiennent — elle a un nom, un type et une liste d'élèves inscrits, et reste en place dans le temps.",
                        "• La session : une rencontre planifiée qui a lieu à l'intérieur d'une halaqa à un moment précis — c'est là que se déroulent la récitation en direct et la correction. Chaque halaqa contient plusieurs sessions au fil du temps.",
                        "En bref : la halaqa est le cadre permanent ; la session est le rendez-vous concret du cours.",
                        "Pour créer votre première session :",
                        "1. Ouvrez votre halaqa depuis la liste des halaqat.",
                        "2. À l'intérieur de la halaqa, choisissez « Créer une session ».",
                        "3. Renseignez le titre, la date, l'heure et la durée, puis enregistrez.",
                        "Votre session est alors prête, et vos élèves pourront la rejoindre à l'heure prévue.",
                        "Si vous avez besoin d'aide, je suis à votre disposition.",
                    ][..],
                ),
                _ => (
                    "Create your first session",
                    "Create your first session",
                    &[
                        "Assalamu alaikum {{name}},",
                        "To help you get started, here is a quick explanation of the difference between a \"halaqah\" and a \"session\":",
                        "• Halaqah (room): the permanent class your students belong to — it has a name, a type, and an enrolled student list, and it stays in place over time.",
                        "• Session: a scheduled meeting that happens inside a halaqah at a specific time — this is where live recitation and correction take place. Each halaqah holds many sessions over time.",
                        "In short: the halaqah is the lasting frame; the session is the actual lesson appointment.",
                        "To create your first session:",
                        "1. Open your halaqah from the halaqat list.",
                        "2. Inside the halaqah, choose \"Create session\".",
                        "3. Set the title, date, time, and duration, then save.",
                        "Your session is then ready, and your students can join at its scheduled time.",
                        "If you need any help, I'm here for you.",
                    ][..],
                ),
            };
            let body: Vec<String> = paragraphs.iter().map(|p| sub(p)).collect();
            let (html, text) = email_layout(locale, heading, &body, None);
            RenderedEmail {
                subject: subject.to_string(),
                html,
                text,
            }
        }
        "enrollment_removed" => {
            let (subject, heading, p1, p2, cta_label) = match locale {
                "ar" => (
                    "انتهاء اشتراكك في حلقة {{room_name}}",
                    "مرحبًا {{name}}",
                    "نودّ إعلامك بأنه تم إنهاء اشتراكك في حلقة «{{room_name}}».",
                    "إن كان لديك أي استفسار يمكنك التواصل مع معلّم الحلقة، كما يمكنك تصفّح حلقات أخرى والانضمام إليها في أي وقت.",
                    "تصفّح الحلقات",
                ),
                "fr" => (
                    "Votre inscription à {{room_name}} a pris fin",
                    "Bonjour {{name}}",
                    "Nous vous informons que votre inscription à « {{room_name}} » a pris fin.",
                    "Pour toute question, contactez l'enseignant de la halaqah. Vous pouvez parcourir et rejoindre d'autres halaqat à tout moment.",
                    "Parcourir les halaqat",
                ),
                _ => (
                    "Your enrollment in {{room_name}} has ended",
                    "Hello {{name}}",
                    "We're letting you know that your enrollment in \"{{room_name}}\" has ended.",
                    "If you have any questions, reach out to the halaqah's teacher. You're welcome to browse and join other halaqat anytime.",
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
        "new_signup_digest" => {
            let (subject, heading, intro, cta_label) = match locale {
                "ar" => (
                    "ملخص التسجيلات الجديدة — {{count}} مستخدم",
                    "تسجيلات آخر ٢٤ ساعة",
                    "انضم {{count}} مستخدم جديد خلال آخر ٢٤ ساعة:",
                    "إدارة المستخدمين",
                ),
                "fr" => (
                    "Nouvelles inscriptions — {{count}} utilisateurs",
                    "Inscriptions des dernières 24 h",
                    "{{count}} nouveaux utilisateurs ont rejoint au cours des dernières 24 h :",
                    "Gérer les utilisateurs",
                ),
                _ => (
                    "New signups — {{count}} new users",
                    "Signups in the last 24 hours",
                    "{{count}} new users joined in the last 24 hours:",
                    "Manage users",
                ),
            };
            let app_url = vars.values.get("app_url").cloned().unwrap_or_default();
            let mut paragraphs = vec![sub(intro)];
            paragraphs.extend(vars.list_lines.iter().cloned());
            let (html, text) = email_layout(
                locale,
                heading,
                &paragraphs,
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
