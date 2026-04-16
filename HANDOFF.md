# Handoff Note - BBT Orientation Satisfaction Survey 2569

## Current Location

Project repo:

`C:\Users\splen\new staff แบบสอบถาม พี่จอย survey\codex_handoff_bbt_orientation_2569\satis-survey`

GitHub repo:

`https://github.com/kairos-shift/satis-survey.git`

Local preview server:

`http://127.0.0.1:8787/`

Pages:

- Participant form: `http://127.0.0.1:8787/index.html`
- Admin dashboard: `http://127.0.0.1:8787/admin.html`
- Printable report: `http://127.0.0.1:8787/report.html`

## Supabase

Project URL:

`https://smlqigkadxnmtpexpwsq.supabase.co`

Configured public key in `config.js`:

`sb_publishable_bQ-Hax05szkDweR39qeb7Q_dFwbnwOr`

Do not use or commit any `sb_secret_...` key in browser/client files.

Schema file:

`schema.sql`

Schema was run in Supabase SQL Editor and returned:

`Success. No rows returned`

Live RPC checks passed:

```text
verify_survey_pin('orientation_2569', 'wrong')      -> false
verify_survey_pin('orientation_2569', 'LuvluvBBT')  -> true
verify_master_key('orientation_2569', '10758')      -> true
verify_master_key('orientation_2569', '1553')       -> true
```

## Access Credentials

Participant PIN:

`LuvluvBBT`

Admin / report master keys:

`10758`
`1553`

These are not hardcoded in client JS. They are seeded as bcrypt hashes by `schema.sql`.

## What Has Been Built

Static survey app, no build step:

- `index.html` / `index.js`: participant PIN-gated Thai survey form
- `admin.html` / `admin.js`: master-key dashboard, Chart.js summary, role suppression, Excel export
- `report.html` / `report.js`: master-key A4 printable report using SVG bars
- `survey-data.js`: exact Thai wording and analytics helpers
- `styles.css`: Esper UI light theme based on `C:\Users\splen\Documents\Esper\packages\esper-ui`
- `config.js`: Supabase URL + publishable key + survey id
- `README.md`, `PRD.md`, `FORM_ITEMS.md`, `schema.sql`

Esper light theme details used:

- Body: `#f9f9fb`
- Card/panel: `#ffffff`
- Input: `#fcfcfd`
- Primary text: `#1a3350`
- Accent: `#0284c7`
- Fonts: Sarabun, Rajdhani, IBM Plex Mono

## Print Status

The print report was adjusted after preview showed content too close to the paper edge.

Current print CSS:

- `@page { size: A4 portrait; margin: 0; }`
- `.report-page` uses explicit A4 dimensions: `210mm x 297mm`
- internal page padding: `16mm 16mm 18mm`
- cover page uses flex layout so footer sits near the bottom

Recommended print settings:

```text
Paper: A4
Margins: None or Default
Scale: 100%
Background graphics: On
```

Still needs visual confirmation from print preview after the latest margin adjustment.

## Verification Already Done

JavaScript syntax checks passed:

```powershell
node --check index.js
node --check admin.js
node --check report.js
node --check survey-data.js
```

Secret check:

- Actual `sb_secret_...` value was not found in repo.
- Client files do not contain `LuvluvBBT`, `10758`, or `1553`.

Supabase RPCs are reachable and credentials verify correctly with the publishable key.

## Git Status

The repo was cloned from GitHub and currently has new/untracked app files.

Run:

```powershell
git status --short
```

Expected untracked/new files include:

- `index.html`
- `index.js`
- `admin.html`
- `admin.js`
- `report.html`
- `report.js`
- `styles.css`
- `survey-data.js`
- `config.js`
- `schema.sql`
- `README.md`
- `PRD.md`
- `FORM_ITEMS.md`
- `HANDOFF.md`

No commit or push has been done yet.

## Remaining Next Steps

1. Reopen `http://127.0.0.1:8787/report.html`.
2. Enter master key `10758` or `1553`.
3. Check print preview again with A4 and scale 100%.
4. If print looks correct, commit files:

   ```powershell
   git add .
   git commit -m "Build BBT orientation satisfaction survey"
   git push origin main
   ```

5. Deploy static site through Cloudflare Pages, GitHub Pages, or cPanel.
6. Test on phone:
   - PIN gate
   - required validation
   - submit to Supabase
   - duplicate localStorage block
   - admin dashboard
   - Excel export
   - printable report

## Skill Install Note

Installed skills from:

`pbakaus/impeccable`

Command used:

```powershell
npx skills add pbakaus/impeccable --all --global
```

Installed 17 skills globally:

`adapt`, `animate`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`, `impeccable`, `layout`, `optimize`, `overdrive`, `polish`, `quieter`, `shape`, `typeset`

Restart Codex to pick up new skills.
