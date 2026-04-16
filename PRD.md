# PRD — BBT Orientation Satisfaction Survey 2569

**Project:** Online + paper satisfaction survey for Bangbuatong Hospital new-nurse orientation
**Event:** 1–2 April 2569 (already completed), ห้องประชุมสัตตบงกช โรงพยาบาลบางบัวทอง
**Target respondents:** ~20 new nurses + a handful of other new healthcare staff, not yet assigned to wards
**Collection window:** Post-event, ~2 weeks

---

## 1. Goals

**Primary:** Collect anonymous satisfaction feedback from new-hire orientation attendees.
**Secondary:**
- Generate QI report identifying strengths and areas for improvement.
- Produce printable report for HR and หัวหน้าพยาบาล.
- Export raw data as Excel for further analysis.

## 2. Non-goals

- No identification of individual respondents.
- No ward/department assignment tracking.
- No authentication/accounts for respondents.
- No persistent platform — one-off yearly survey.

## 3. User roles

| Role | Access path | Credential |
|------|-------------|------------|
| Participant (new hire) | `index.html` | Participant PIN: `LuvluvBBT` |
| HR staff / หัวหน้าพยาบาล / DT | `admin.html`, `report.html` | Master Key: `10758` or `1553` |

## 4. Anonymity model

### Hard constraints
- No name, email, phone, IP, or user-agent captured or logged.
- `submitted_date` is DATE only, never timestamptz.
- No ward/department field.
- Role bucketed to 2 options (พยาบาลวิชาชีพ / สหวิชาชีพอื่น) to protect k=1 staff.

### Reporting suppression
- Any breakdown where a group has n<3 must be suppressed from display and export.
- Apply to: role-bucket breakdowns, per-institution breakdowns, any future sub-group analysis.

### Duplicate prevention (soft, event-is-over context)
- `localStorage.setItem('bbt_orientation_2569_submitted', ISOdate)` after successful submit.
- On re-visit, show "ท่านได้ส่งแบบประเมินแล้ว" screen instead of form.
- Accept that this doesn't stop malicious duplicates (incognito, different device). Acceptable risk given the low-stakes nature of the survey.
- Post-collection: cross-check total N against attendance (~20). Flag if N > expected.

## 5. Access control

### Two-tier bcrypt-hashed credentials
- Credentials stored in `survey_config` table as bcrypt hashes (via `pgcrypto`).
- Admin/report access supports multiple master keys for the same survey.
- RLS on `survey_config` blocks all direct client access. Only RPCs can read.
- Two RPC functions: `verify_survey_pin(survey_id, pin)` and `verify_master_key(survey_id, key)`.
- Session unlock stored in `sessionStorage` (not localStorage) — closing the tab logs out.

### Brute-force protection
- 5 wrong attempts per session → 5-minute lockout on that browser session.
- Track attempts and lockout-until in `sessionStorage`.
- Reset on correct entry.

## 6. Pages

### 6.1 `index.html` — Survey form

**Layout (top to bottom):**

1. **Header:** รพ.บางบัวทอง title, subtitle "แบบประเมินความพึงพอใจ โครงการปฐมนิเทศบุคลากรจบใหม่ ประจำปีงบประมาณ 2569"
2. **Anonymity note:** "แบบประเมินนี้ไม่ระบุตัวตน และสามารถส่งได้เพียงครั้งเดียวต่อท่าน ข้อมูลของท่านจะถูกใช้เพื่อปรับปรุงโครงการในปีต่อไปเท่านั้น"
3. **PIN gate** (until unlocked): single input field + submit button
4. **Form** (after unlock):
   - ส่วนที่ 1 — Demographics
   - ส่วนที่ 2 — 7 dimensions satisfaction (Likert 1–5)
   - ส่วนที่ 3 — Per-day satisfaction (Likert 1–5)
   - ส่วนที่ 4 — Knowledge/readiness (Likert 1–5)
   - ส่วนที่ 5 — Open-ended (6 textareas, optional)
5. **Submit button** — validates all Likert items answered; open-ended optional.
6. **Thank-you screen** after successful submit.

**Exact wording for all items: see `FORM_ITEMS.md`.**

**Likert UI:** 5 radio buttons per item, labeled `5 4 3 2 1`. Show legend at top: "5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด". Mobile-friendly (large tap targets).

**Validation:**
- All Likert items (ส่วนที่ 2, 3, 4) required.
- All ส่วนที่ 1 fields required EXCEPT `institution` (optional).
- ส่วนที่ 5 all optional.
- On validation failure: highlight missing items, scroll to first one, show message "กรุณาตอบคำถามที่เหลือ X ข้อ".

**Submit flow:**
1. Validate.
2. Disable submit button, show "กำลังส่ง...".
3. Insert into `orientation_responses_2569` via Supabase anon client.
4. On success: set `localStorage.bbt_orientation_2569_submitted`, show thank-you screen.
5. On failure: re-enable button, show Thai error message, log error to console.

### 6.2 `admin.html` — Dashboard

**Master key gate first.** Then load data via `get_responses('orientation_2569', masterKey)` RPC.

**Dashboard sections:**

1. **Hero stat card** — Response count (N) + Overall satisfaction mean (from ส่วนที่ 4 item 6), displayed prominently.

2. **Dimension means** — 7 dimensions from ส่วนที่ 2, 2 per-day scores from ส่วนที่ 3, 6 items from ส่วนที่ 4. Bar chart (Chart.js) horizontal, sorted by mean descending.

3. **QI flags:**
   - Green "จุดแข็ง" badge on items with mean ≥ 4.5
   - Red "ควรปรับปรุง" badge on items with mean < 3.5
   - Neutral (no badge) for items in between

4. **Distribution table** — per item: count of 5/4/3/2/1 + mean + SD + N.

5. **Role bucket breakdown** — separate column per bucket (พยาบาล / สหวิชาชีพ) showing dimension means.
   - **Suppress entire breakdown if either bucket has n<3.** Show message "ไม่แสดงข้อมูลแยกตำแหน่ง (กลุ่มย่อยน้อยเกินไปเพื่อปกป้องความเป็นส่วนตัว)".

6. **Open-ended responses** — grouped by question (6 sections from ส่วนที่ 5), verbatim. Tag each with role bucket only if bucket n≥3.

**Buttons:**
- `ดาวน์โหลด Excel` — triggers SheetJS export
- `ดูรายงานพิมพ์` — opens `report.html` in new tab
- `ออกจากระบบ` — clears sessionStorage, reloads page

### 6.3 `report.html` — Printable report

**Master key gate** (uses sessionStorage from admin; re-prompt if absent).

**A4-optimized layout, `@media print` styling.** Hide all buttons/nav with `.no-print { display: none }` in print mode.

**Sections (in order):**

1. **Cover page (page 1):**
   - รพ.บางบัวทอง header
   - Title: "รายงานผลการประเมินความพึงพอใจ"
   - Subtitle: "โครงการปฐมนิเทศบุคลากรจบใหม่ ประจำปีงบประมาณ 2569"
   - Event dates, venue, N respondents
   - Generated date
   - "เอกสารภายใน — ไม่ระบุตัวตน" watermark/footer

2. **Executive summary (page 2):**
   - Overall mean (hero number)
   - Top 3 strengths (items with highest mean)
   - Top 3 areas for improvement (items with lowest mean)

3. **Dimension breakdown (pages 3+):**
   - Per dimension: mean, SD, N, horizontal SVG bar chart, distribution table
   - 7 dimensions + per-day + ส่วนที่ 4

4. **QI recommendations:**
   - All items flagged "ควรปรับปรุง" listed with scores
   - All items flagged "จุดแข็ง" listed with scores

5. **Open-ended responses (verbatim, grouped by question)**

6. **Footer on every page:** generated date, page number, "เอกสารภายใน — ไม่ระบุตัวตน"

**Fonts:** Noto Sans Thai, with `@font-face` loaded from Google Fonts. Print-safe (embed or fallback to system Thai font).

## 7. Data model

See `schema.sql` for complete DDL.

**Response payload structure (jsonb):**
```json
{
  "demographics": {
    "gender": "female",
    "age": 24,
    "role": "พยาบาลวิชาชีพ",
    "institution": "มหาวิทยาลัย X",
    "graduation_year": 2568
  },
  "s2": {
    "1_1": 5, "1_2": 4, "1_3": 5,
    "2_1": 5, "2_2": 5, "2_3": 4, "2_4": 4,
    "3_1": 5, "3_2": 4, "3_3": 4,
    "4_1": 4, "4_2": 4,
    "5_1": 5, "5_2": 4,
    "6_1": 5, "6_2": 4, "6_3": 5,
    "7_1": 4, "7_2": 4
  },
  "s3": {
    "day1": 5,
    "day2": 4
  },
  "s4": {
    "1": 5, "2": 4, "3": 5, "4": 4, "5": 4, "6": 5
  },
  "s5": {
    "benefits": "...",
    "improvements": "...",
    "additional_topics": "...",
    "concerns": "...",
    "preferred_ward": "...",
    "other": "..."
  }
}
```

**Keys are stable — document these in a comment block at the top of `index.html`.**

## 8. Excel export specification

**Filename:** `BBT_ปฐมนิเทศ_2569_ผลประเมิน_YYYYMMDD.xlsx`

**Sheet 1 — Summary:**
| Item | Label (Thai) | N | Mean | SD | 5 | 4 | 3 | 2 | 1 | QI Flag |

**Sheet 2 — Raw:**
One row per response. Columns: response_id, submitted_date, gender, age, role, institution, graduation_year, s2_1_1 ... s4_6, s5_benefits ... s5_other.

**Sheet 3 — Comments:**
| Question | Response Text | Role Bucket (if n≥3) |

## 9. Visual design

**Palette:**
- Background: `#F7F9FC`
- Surface: `#FFFFFF`
- Text: `#1A1C20`
- Muted: `#6B7280`
- Primary accent: `#2E75B6`
- Success/strength: `#27AE60`
- Warning/QI: `#C0392B`
- Border: `#E5E7EB`

**Typography:**
- Font: Noto Sans Thai, fallback to system sans
- Body: 16px mobile, 17px desktop
- Headings: scaled, bold weight 600

**Layout:**
- Max content width: 720px on mobile/tablet, 960px on admin desktop
- Generous whitespace
- Cards with 8–12px border radius
- Soft shadow on cards (`0 1px 3px rgba(0,0,0,0.08)`)

## 10. Deployment

Static hosting. Two viable paths:

**Path A — Cloudflare Pages (recommended):**
- Push files to GitHub repo
- Connect to Cloudflare Pages
- Deploy to subdomain, e.g. `orientation-2569.esper-bbt.com`

**Path B — Namecheap cPanel:**
- Upload files to `public_html/orientation-2569/`
- Access at `esper-bbt.com/orientation-2569/`

In either case, `config.js` contains the Supabase URL and anon key (the anon key is safe to expose — RLS + RPC enforce access).

## 11. Setup checklist (for DT)

1. Create new Supabase project (or use existing)
2. Run `schema.sql` in SQL editor
3. Verify seed data: `select survey_id from survey_config;` returns one row
4. Test RPCs in SQL editor:
   - `select verify_survey_pin('orientation_2569', 'LuvluvBBT');` → `true`
   - `select verify_survey_pin('orientation_2569', 'wrong');` → `false`
   - `select verify_master_key('orientation_2569', '10758');` → `true`
   - `select verify_master_key('orientation_2569', '1553');` → `true`
5. Copy Supabase URL and anon key into `config.js`
6. Deploy static files
7. Test participant flow on phone: PIN → form → submit → thank-you
8. Test admin flow: master key → dashboard → export → print report
9. Share URL + PIN via LINE group to attendees

## 12. Known limitations (by design)

- Soft duplicate prevention only (event is over, tokens impossible)
- Participant can technically share the PIN with outsiders (social trust problem)
- Admin "logout" = close tab (no server-side session invalidation)
- N will be small (~20) — statistical comparisons between groups often underpowered

These are accepted tradeoffs for the simplicity and anonymity the survey needs.
