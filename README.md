# BBT Orientation Satisfaction Survey 2569

Anonymous static survey app for Bangbuatong Hospital's new-staff orientation program.

## Files

- `index.html` - participant PIN-gated survey form
- `admin.html` - master-key-gated dashboard and Excel export
- `report.html` - master-key-gated A4 printable report
- `config.js` - Supabase project URL and anon/publishable key
- `schema.sql` - Supabase tables, RLS policies, and RPCs
- `survey-data.js` - exact Thai survey wording and analytics helpers
- `styles.css` - Esper UI light theme styling

## Setup

1. Open Supabase SQL editor and run `schema.sql`.
2. Confirm:

   ```sql
   select verify_survey_pin('orientation_2569', 'LuvluvBBT');
   select verify_master_key('orientation_2569', '10758');
   select verify_master_key('orientation_2569', '1553');
   ```

3. Edit `config.js`:

   ```js
   window.SUPABASE_URL = 'https://smlqigkadxnmtpexpwsq.supabase.co';
   window.SUPABASE_ANON_KEY = '<anon-or-publishable-key>';
   window.SURVEY_ID = 'orientation_2569';
   ```

Use only the anon/publishable key in `config.js`. Do not put any `sb_secret_...` key in browser files.

## Deploy

Deploy as static files through Cloudflare Pages, GitHub Pages, or cPanel. There is no build step.

## Access

- Participant form: `index.html`
- Admin dashboard: `admin.html`
- Printable report: `report.html`

The PIN and master keys are seeded by `schema.sql` as bcrypt hashes and verified through Supabase RPCs.
