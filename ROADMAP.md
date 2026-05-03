# Miqraa Roadmap — Beyond the Live Session

**Last updated:** May 2026
**Status:** Forward-looking. Not committed work. Reviewed quarterly.

---

## Context

The live session in Miqraa is functionally complete for a one-reciter-at-a-time tajweed/hifz halaqah:

- QCF V2 mushaf rendering (best-in-class)
- Audio (LiveKit) with role-based publish grants
- WebSocket signaling for ayah sync, annotations, turn changes
- Error annotations with full classical taxonomy (lahn jali/khafi + 14 categories)
- Recitation logging with grade + star rating + turn type (dars/tathbit/muraja)
- QF Activity Day sync + streak display

**The gap is not in the session itself. It's in everything that happens around the session.**

This document captures what real Quran academies offer that Miqraa doesn't yet, organized by impact.

---

## How a real halaqah session works

Every academy surveyed (e-Halaqah, Fajr Al-Quran, NoorPath, Quran Sheikh, Al-Maher, Al-Azhar Quran Teaching, Qutor, etc.) follows roughly the same structure:

### Inside a 30-minute session

Three phases, matching the existing `dars` / `tathbit` / `muraja` turn types:

1. **الدرس / dars (new lesson)** — teacher demonstrates first ("recite as I recite" — the prophetic method), student imitates, teacher corrects letter-by-letter on makharij and sifaat
2. **التثبيت / tathbit (consolidation)** — yesterday's lesson recited from memory
3. **المراجعة / muraja'a (review)** — older portions on a spaced schedule; without consistent muraja'a, hifz decays

The mushaf is open the whole time. Both teacher and student need it visible.

### Outside the session

This is where most academies actually compete:

- **Daily** practice between sessions, including review of older portions
- **Weekly** progress checks
- **Monthly** report sent to student/parent (progress, performance, behavior, recommendations)
- **Ongoing** spaced repetition that surfaces what's at risk of being forgotten
- Eventually, **ijazah** — a chain-of-transmission certification

---

## Tier 1 — Genuinely missing, real teachers will ask for these

These are the features that move Miqraa from "solid live session tool" to "platform a teacher can build a practice on." Without them, the platform competes with Zoom + Mushaf app. With them, it competes with dedicated Quran academies that charge $30–80/month per student.

### T1.1 — Spaced repetition for muraja'a

**The single highest-leverage thing to add post-hackathon.** Every Hifz program markets daily/weekly muraja'a as their core differentiator. Students forget without a system. Solo practice has no enforcement.

Miqraa already has all the data: `recitations` table tracks `student_id`, `surah`, `ayah_start`, `ayah_end`, `grade`, `created_at`, `turn_type`. From that, the platform can compute:

- Last revised date for each covered ayah range
- Overdue queue (e.g., "Al-Mulk has not been revised in 14 days")
- Decay risk score (weight by grade — `weak` decays faster than `excellent`)

**What to build:**

- A "Due for review" queue surfaced to the teacher when starting a session, sorted by decay risk
- A small dashboard widget for students: "Surahs at risk: 3" with a CTA to "request a muraja'a turn"
- A scheduling helper: when teacher creates a recurring schedule, suggest "1 dars + 1 tathbit + 1 muraja'a per week" as the default
- Configurable spaced-repetition intervals per halaqah (e.g., review at 1d / 3d / 7d / 14d / 30d, weighted by grade)

**Backend:** new view or computed query on top of `recitations`. No new tables required.

**Effort:** medium (~2 weeks). Massively differentiating.

---

### T1.2 — Homework / between-session assignments

Real students practice between sessions. They need to know: "Memorize Al-Mulk verses 1–10 for next class." Right now Miqraa has no concept of an assignment between sessions — annotations are in-session only.

**What to build:**

- New `assignments` table: `id`, `student_id`, `room_id`, `assigning_teacher_id`, `surah`, `ayah_start`, `ayah_end`, `assignment_type` (memorize/recite/listen), `due_session_id` or `due_date`, `notes`, `status` (assigned/in_progress/completed/missed), `completed_at`
- Teacher action at end of a session: "Assign homework for next class" — pre-filled with what was just covered, editable
- Student home page: a "Practice for next session" card listing open assignments
- Teacher action at start of next session: "Check homework" — shows what was assigned, lets teacher mark each as completed/missed/partial

**Backend:** one new migration, one new resource (CRUD + 2-3 status transitions).

**Frontend:** new card on student home, new section in session detail / live session, optional assignment-creation modal.

**Effort:** medium (~1.5 weeks).

---

### T1.3 — Monthly progress report

Every academy ships this. Parents and adult students get a PDF or email at end of month: surahs covered, hours of session time, grade trend, attendance percentage, annotation summary, teacher's free-form notes, recommendations.

Miqraa has all the underlying data. What's missing is the rendering and delivery.

**What to build:**

- A teacher action: "Generate monthly report" for a specific student over a date range
- A renderable HTML page that aggregates: total recitations by grade, surahs newly covered vs. revised, attendance count, average star rating, top error categories, free-form teacher notes section, optional sign-off
- "Download as PDF" using existing PDF skill or browser print-to-PDF
- Optional: "Send to student email" — uses existing email infrastructure (or QF email, if integrated)

**Backend:** new report-generation endpoint that aggregates existing tables. No schema changes.

**Frontend:** one new page (`/students/{id}/report?from=...&to=...`), one share button.

**Effort:** small to medium (~1 week).

**This is what parents see and judge the platform by.** Underrated.

---

### T1.4 — Teacher demonstration affordance

Small UX detail with outsized psychological weight. The prophetic method is "recite as I recite" — teacher demonstrates, student imitates. Right now there's a "▶ Listen" button that plays AbdulBaset Mujawwad as a reference. That's useful for solo practice, useless mid-session because *the teacher is the reference*.

**What to build:**

- During a turn, a "Demonstrate" button visible only to the teacher
- Pressing it: visual signal that "Sheikh is reciting now" appears prominently to all students, the teacher's mic indicator becomes a colored beacon, the active reciter (if different) is briefly muted
- Releasing it: state returns to normal turn flow

**Backend:** none — pure WebSocket signaling, fits the existing message types.

**Frontend:** one new toolbar button + a teacher-active overlay state.

**Effort:** small (~2 days).

Makes the teacher feel central, which the classical model demands. Important psychological signal even if functionally minor.

---

## Tier 2 — Useful but not blocking

### T2.1 — Tajweed rule reference panel

Inside the live session, when a teacher annotates "khafi - madd", the student often doesn't know what that means. A small collapsible reference showing the rule + a written example would close the loop. Educational, doesn't interrupt the session.

**What to build:** static content, one component, ~14 entries (one per error category in the existing taxonomy).

**Effort:** small (~3 days, mostly content writing).

---

### T2.2 — Session recording + playback

Multiple academies advertise this. The classical principle quoted in research: *"Record one lesson. Aim for 100% next time."*

Miqraa's `StorageService` is scaffolded but unused. LiveKit Egress can record server-side audio.

**What to build:**

- LiveKit Egress configuration (per-session opt-in)
- Storage backend (local FS in dev, S3/MinIO in prod)
- Playback page: audio player + timeline-aligned annotation markers from the `error_annotations` table

**Effort:** medium (~2 weeks). Half the work is infra (egress setup, storage decisions, retention policy), half is the playback UI.

**Privacy/storage cost:** real concern. Each 30-min session ≈ 15 MB Opus. 1000 sessions/month = 15 GB/month. Need retention policy and per-halaqah opt-in.

---

### T2.3 — Voice notes between sessions

Some academies let teachers send a 30-second voice correction between sessions. Async coaching for students who practice on their own.

**What to build:** small async-message entity with audio attachments. Teacher records, student listens. Can be threaded into the assignment system from T1.2.

**Effort:** small to medium (~1 week).

---

### T2.4 — Khatma tracking

A *khatma* is one complete reading of the Quran. Many serious students do one per month. The platform can detect this from existing recitation data (every ayah covered at least once within a window) and surface it as a milestone: "You completed your 3rd khatma this year."

**What to build:** one computed stat on the student's progress page. Optional milestone celebration on khatma completion.

**Effort:** small (~3 days).

Spiritually meaningful, low cost.

---

## Tier 3 — Nice but not really halaqah-shaped

### T3.1 — Tafsir layer

Showing translation/explanation under the ayah. QCF content API has this data.

**Why not now:** that's the tafsir teacher's job, not the tajweed teacher's. Different halaqah, different curriculum. Cluttering the tajweed mushaf with translations is the wrong move. If we ever build a tafsir-specific halaqah type, this becomes a primary feature there.

---

### T3.2 — Group chat / discussion

Halaqat are sometimes conversational (the "dialogic halaqah" model). The Q&A pattern. Miqraa's one-reciter-at-a-time model is correct for tajweed/hifz, but for tilawa/muraja types a teacher might want a few minutes of open discussion at the end.

**What to build:** simple group text chat panel during sessions, gated by halaqah_type. Tilawa/muraja have it on by default, hifz/tajweed have it off.

**Effort:** small to medium (~1 week).

**Why not high priority:** the audio channel already covers this — students can ask questions out loud. Text chat is convenient but not required.

---

### T3.3 — Ijazah chain (sanad)

The chain-of-transmission certification. A graduated student gets a paper certificate signed by the Sheikh, linked through the chain back to the Prophet ﷺ. Major career milestone in the classical tradition.

**Why not now:**

- Legal/authentication weight is heavy
- Requires scholar-network buy-in
- Real ijazah certificates are issued in person, not generated by a platform
- Misrepresentation risk (a platform-issued ijazah without proper sanad could be misleading)

If we ever do this, it's a partnership move with established Quran academies — not something Miqraa builds alone.

---

## Suggested execution order (post-hackathon)

The ordering optimizes for: (a) compounding value (each builds on the last), (b) parent/student visibility, (c) implementation cost.

1. **T1.4 — Teacher demonstration** (2 days) — small, ships fast, teachers love it immediately
2. **T1.3 — Monthly progress report** (~1 week) — what parents judge the platform by
3. **T1.2 — Homework / assignments** (~1.5 weeks) — closes the practice loop
4. **T1.1 — Spaced repetition for muraja'a** (~2 weeks) — the moat. Needs T1.2 to be most useful.
5. **T2.4 — Khatma tracking** (3 days) — quick spiritual milestone win
6. **T2.1 — Tajweed rule reference** (3 days, content-bound)
7. **T2.2 — Session recording** (~2 weeks) — start only when storage strategy is settled
8. **T2.3 — Voice notes** (~1 week) — extension of T1.2
9. **T3.2 — Group chat** — only if user research shows it's wanted
10. **T3.1 — Tafsir layer** — only when introducing a tafsir-specific halaqah type
11. **T3.3 — Ijazah** — partnership-gated, not a unilateral build

Total: ~6–8 weeks of focused work to deliver Tier 1 + the cheap parts of Tier 2.

---

## What this changes about Miqraa's positioning

**Today (without these features):** "An open-source live Quran teaching platform with a great mushaf."

**After Tier 1:** "An open-source platform for running a Quran teaching practice — sessions, assignments, muraja'a, monthly reports."

The first competes with Zoom + paper notebooks. The second competes with dedicated academies charging $30–80/student/month.

That's the difference between a tool and a product.

---

## Sources & references consulted

- e-Halaqah programs (recitation, tajweed, hifz, ijaza, qiraat structure)
- Fajr Al-Quran academy structure (Tilawa, Tajweed, Hifz programs)
- NoorPath Academy 4-level Hifz program
- Al-Maher Quran online (monthly progress reports format)
- Quran Sheikh dual-layer review methodology
- Qutor whiteboard + recording features
- Classical Quranic teaching principles (Fahm Education, Ayah Story)
- The "dialogic halaqah" model (IELC, University of Cambridge)
- Quran memorization techniques and spaced repetition research

---

## Out of scope for this document

- Multi-tenant / organization model — separate roadmap
- Marketing / pricing / monetization — separate roadmap
- LiveKit migration completion — already underway, tracked elsewhere
- Mushaf rendering improvements — QCF V2 is settled, not on the roadmap
- Live session shell, signaling, annotation lifecycle — already complete
- Ijazah, fatwa-level authority decisions — partnership-gated
