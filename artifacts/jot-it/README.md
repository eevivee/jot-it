# Jot It

A personal phone-first journal. This app is a static website: it needs no
Replit API server, managed database, client secret, or paid server to run on
GitHub Pages.

## Your journal's privacy

- Entries, goals, reflections, and recovered drafts are stored in this browser.
  They are **not encrypted**. Anyone with access to this browser profile may
  read them. Use your phone's device lock and avoid shared devices.
- Until you connect Google, select a Sheet, and see **Saved to Google Sheets**,
  entries are on this device only. Clearing site data or changing domains can
  remove that local copy.
- Google access tokens stay only in memory. Reloading the page or token expiry
  requires connecting again; no background server stores a refresh token.
- Disconnecting Google does not erase local entries or delete the spreadsheet.
- Google Sheets is private according to its sharing settings; do not publish
  or share it publicly. This app does not create public sharing permissions.
- The OAuth Sheets permission can access spreadsheets you can access. The app
  only calls the one spreadsheet ID you choose. Use a dedicated journal sheet.
- There is no separate app password or server login. Google controls cloud
  access; the phone/browser controls local access.

## Google Sheets: one-time setup

This browser-based connection works independently of Replit. A Replit account
connector cannot supply authorization to a website hosted on GitHub Pages.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or
   select your personal project, and enable **Google Sheets API**.
2. In Google Auth Platform configure Branding and Audience. For personal use,
   choose External / Testing and add your own Google account as a test user.
   Workspace accounts may need administrator approval.
3. Configure Data Access for
   `https://www.googleapis.com/auth/spreadsheets`.
4. Create an OAuth client with application type **Web application**.
5. Add your site's origin under **Authorized JavaScript origins**. For a
   project page at `https://YOURNAME.github.io/REPOSITORY/`, the origin is
   `https://YOURNAME.github.io` (no repository path). Add the preview's actual
   HTTPS origin too if you wish to authorize there. Embedded previews may
   require opening in a full browser tab.
6. Copy the public **client ID** (ending in `.apps.googleusercontent.com`) into
   Jot It's Settings. This ID is not a secret. Do not create or enter a client
   secret, password, service account key, or API key.
7. Choose **Connect Google**, grant Sheets access, then **Create my sheet**.
   Alternatively, enter a spreadsheet ID or normal Google Sheets link to a
   spreadsheet you own/can edit.
8. Saved changes sync automatically while connected and online. **Sync now**
   is an optional manual retry. The app creates its own **Jot It** tab if needed; it
   refuses to overwrite a tab with incompatible data. It does not change
   other tabs or spreadsheet sharing settings.

Connect again after a reload or token expiry. Google may show an unverified
app notice for your personal testing project; authorize only a client you
created and understand. Test-mode consent and Google policies may require
periodic reauthorization. Do not make the app public for other users without
reviewing Google's consent and verification requirements.

### How spreadsheet storage works

Columns show ID, type, date, title/period, text, mood/outcome, updated time,
and the complete record as JSON. Entries, goals, reflections, and your greeting
name all synchronize. Drafts and Google connection settings stay device-local.

Each saved version is appended rather than replacing old rows. The app uses the
latest updated time per record ID. Earlier versions remain in the sheet. A
deleted entry is a tombstone, not a permanently erased spreadsheet row.
Do not edit/remove the Record JSON column. Human-readable columns are for
inspection; edit entries through the app.

Saved entries (including edits, favorites and deletions), goals, reflections,
and profile changes queue a sync after a brief delay. Unsaved drafts are never
sent. While the app is open, syncing retries every 30 seconds and on returning
online or to the app. Connecting Google also fetches your Sheet. Keep the app
open until **Saved to Google Sheets** appears; closing the app suspends syncing.
Offline changes remain in the browser and sync after reconnection. Expired
Google authorization requires a user-initiated reconnect in Settings.

Use one device at a time and check the sync status before switching devices. If two
devices edit the same entry without syncing, the later timestamp wins in the
app; earlier revisions remain recoverable in the spreadsheet. Large entries
must fit Google's cell limits; the app reports oversized records rather than
truncating them. Failed or partial syncs are safe to retry.

## Publish to GitHub Pages

Publishing is a separate explicit action; nothing is published automatically.

1. Put this repository in your own GitHub account.
2. In repository **Settings → Pages → Build and deployment**, choose
   **GitHub Actions**.
3. Open **Actions → Publish Jot It to GitHub Pages → Run workflow**.
4. The workflow installs dependencies, builds only Jot It, and publishes its
   static output. No API server or database is deployed.
5. Open the published link, then configure its Google authorized origin as
   above. Google settings are entered on each browser/device, not committed.

The workflow handles both account pages (`YOURNAME.github.io`) and repository
subpaths (`YOURNAME.github.io/REPOSITORY/`). Hash/state navigation does not need
server rewrites. For a custom domain, adjust BASE_PATH to `/` in the workflow
and configure the domain in GitHub Pages.

Journal data is **not part of the repository**. Do not upload exported personal
journal JSON files to GitHub.

## Use on your phone

Open the published website in Safari or Chrome. Use **Add to Home Screen**
(on iPhone: Share → Add to Home Screen). This is a website, not an app-store
app. Draft recovery and saved local records work while the page is loaded;
Google sync needs internet. Full offline launching is not promised.

## Calendar rules

- Local calendar dates are used, not UTC days.
- Weeks start Monday and end Sunday, using ISO week numbering (52 or 53 weeks).
- Archive weeks remain whole; a cross-month week belongs to its Monday's
  month and ISO week-year.
- Quarters are Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec.
- Due check-ins appear when you open the app or select a relevant entry date,
  not as push notifications. Unanswered goals remain available later.

## Development

Use the existing Jot It managed workflow in Replit.
Type check: `pnpm --filter @workspace/jot-it run typecheck`.
