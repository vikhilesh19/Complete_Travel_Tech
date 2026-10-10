# Wayfinder Travel Safety

Wayfinder is a traveler-safety web application for understanding local hazard reports during severe weather. It brings officer-submitted reports, map context, translated guidance, and offline reference information into one interface.

> **Safety notice:** This project is a prototype, not an emergency service. Scenario content is illustrative. Officer-submitted reports are not independently verified and must not be treated as official warnings. Follow local authorities and contact emergency services directly.

## Problem

During floods, cyclones, and landslides, visitors may have trouble finding clear, local-language information about affected areas and safe next steps. Wayfinder explores a shared traveler and officer interface for publishing area-specific reports and making relevant information easier to find.

## What works today

- Traveler view for the Kerala coast and Wayanad hills scenarios.
- Interactive Leaflet map using OpenStreetMap tiles, plus current weather from Open-Meteo.
- English, Hindi, Malayalam, and Dutch interface and report translations.
- Officer sign-in and PostgreSQL-backed hazard reporting.
- Officers can delete only reports they created; ownership is enforced by the API.
- Traveler hazard feed, safety-question fallback, and assistance actions.
- Topbar database health indicator, refreshed every 30 seconds through the API.
- Optional SMS subscriptions with phone verification and area-specific hazard notifications. Requires Twilio configuration and may incur charges.
- PWA shell and IndexedDB snapshots for selected offline information.

## Architecture

- `src/`: React 19 and Vite traveler/officer interface.
- `server/index.js`: Express application API used by the full local application. It connects to PostgreSQL through `DATABASE_URL` and initializes the application's tables.
- `backend/api/health.js`: separate Vercel serverless health check. It verifies that its `DATABASE_URL` can query Neon; it does **not** implement the application routes for hazards, officers, help requests, or SMS.
- `backend/server.js`: standalone Express health-check example; it is not the full application API.
- `public/sw.js`: PWA service worker and offline public-data handling.

The Vite development server proxies `/api` to `http://localhost:3001` by default. The browser can use `VITE_API_BASE_URL` to call a separately hosted API. The frontend must point to a backend that implements all routes it uses; a successful `/api/health` response alone does not provide the application API.

The application API's `GET /api/health` executes a PostgreSQL query and reports whether its configured database connection is available. The frontend uses this endpoint only for the connection indicator; hazard and officer data continue to use their dedicated API routes.

## Requirements

- Node.js 20.19 or newer
- npm
- PostgreSQL for the full application API (local or hosted, such as Neon)

## Local setup

1. Install root dependencies:

   ```sh
   npm install
   ```

2. Create a database, or prepare a PostgreSQL connection string from your database provider.
3. Copy `.env.example` to `.env` and set at least `DATABASE_URL` and `SESSION_SECRET`.
4. Start the API and frontend together:

   ```sh
   npm run dev
   ```

The frontend is served by Vite, normally at `http://localhost:5173`; the application API listens on port `3001`. The API creates or updates its tables during startup. To run just one process, use `npm run api` or `npm run dev:web`.

PowerShell environment-file setup:

```powershell
Copy-Item .env.example .env
```

For a hosted PostgreSQL provider, use the provider's complete connection URL as `DATABASE_URL`. Keep it in the backend environment only. Do not use it as `VITE_API_BASE_URL` or commit it to Git.

## Configuration

### Full application API

Set these in the environment where `server/index.js` runs:

| Variable                                                                                                                       | Purpose                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                                                 | PostgreSQL connection string.                                                                                                     |
| `SESSION_SECRET`                                                                                                               | Signs officer session cookies; use a long random value.                                                                           |
| `OFFICER_USERNAME`, `OFFICER_PASSWORD`                                                                                         | Optional configured officer login. Prefer a strong password.                                                                      |
| `API_PORT`                                                                                                                     | Local API port; defaults to `3001`.                                                                                               |
| `API_PROXY_TARGET`                                                                                                             | Vite development proxy destination; defaults to `http://localhost:3001`.                                                          |
| `FRONTEND_ORIGINS`                                                                                                             | Comma-separated allowed browser origins for cross-origin API calls.                                                               |
| `COOKIE_SAME_SITE`                                                                                                             | Session cookie policy; keep `strict` for same-site. Cross-site requires HTTPS and `none`, subject to browser cookie restrictions. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`                                                      | Optional officer email-registration delivery. Keep SMTP credentials server-side.                                                  |
| `SMS_HELP_NUMBER`                                                                                                              | Optional public contact number for the user-initiated SMS link.                                                                   |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_SMS_FROM_NUMBER`, `TWILIO_INBOUND_WEBHOOK_URL` | Optional verified SMS subscriptions and notifications. Keep these server-side.                                                    |

### Frontend API origin

`VITE_API_BASE_URL` is embedded in the frontend at build time and is therefore public. Set it to the API origin only, for example `https://api.example.com`, with no trailing slash. It must never contain a database URL, password, or provider secret. Leave it blank for local development with the Vite proxy.

## Deployment

### Vercel frontend

For the current Vite frontend, configure the Vercel project with:

- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://<your-full-api-origin>`

Redeploy after setting or changing `VITE_API_BASE_URL`. On the API host, set `FRONTEND_ORIGINS` to the exact Vercel site origin.

**The complete application API is not currently deployed as Vercel functions in this repository.** `backend/api/health.js` is only a database health check. To make the deployed frontend fully functional, deploy `server/index.js` as a persistent Node API service or implement the required application endpoints as serverless functions, then set `VITE_API_BASE_URL` to that service. The Vercel health endpoint can confirm database connectivity, but it cannot replace those routes.

No public deployment URL is currently recorded in this repository.

## Application API

The full Express API in `server/index.js` provides:

| Route                                      | Access            | Purpose                                                     |
| ------------------------------------------ | ----------------- | ----------------------------------------------------------- |
| `GET /api/health`                          | Public            | Check PostgreSQL connectivity; does not return hazard data. |
| `GET /api/hazards`                         | Public            | Read unexpired hazard reports.                              |
| `POST /api/hazards`                        | Officer session   | Publish a hazard report.                                    |
| `DELETE /api/hazards/:id`                  | Owning officer    | Delete a report created by the signed-in officer.           |
| `GET /api/officer/session`                 | Public            | Check officer session state.                                |
| `POST /api/officer/login`                  | Public            | Sign in an officer.                                         |
| `POST /api/officer/register/*`             | Public, email OTP | Register an officer account. Requires SMTP configuration.   |
| `GET /api/officer/hazards`                 | Officer session   | List IDs owned by the signed-in officer.                    |
| `GET /api/officer/help-queue`              | Officer session   | Read tourist assistance actions.                            |
| `POST /api/help-queue`                     | Public            | Record a help action.                                       |
| `POST /api/translate-alert`                | Public            | Translate alert text.                                       |
| `POST /api/sms/subscriptions/request-code` | Public            | Send a phone verification code when Twilio is configured.   |
| `POST /api/sms/subscriptions/verify`       | Public            | Verify and subscribe a phone number to a region.            |
| `POST /api/sms/twilio/inbound`             | Twilio signature  | Process SMS opt-out keywords.                               |

The separate Vercel function currently exposes only `GET /api/health`.

## SMS notifications

SMS is optional and disabled unless all Twilio variables are configured on the application API. Travelers select a region, enter an international-format phone number, consent, and verify ownership. Verified subscribers receive notifications for reports in that region. Demo reports are labeled as demos; other officer reports are identified as unverified. A signed inbound Twilio message containing `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT` removes that number's subscriptions.

Twilio Verify and messaging are paid services; carrier availability and rates vary. Translations use an external Google Translate endpoint when available and can fall back to English. SMS delivery has not been live-tested in this repository's environment.

## Offline behavior

- Use **Save for offline** to store a browser-local snapshot of available area information in IndexedDB.
- The service worker caches the app shell and network-first public reads. Confirmed hazard deletions invalidate cached hazard data.
- OpenStreetMap tiles are not downloaded for offline use. Offline maps use only available saved data.
- Offline snapshots do not receive updates. A saved report is not a current or verified warning.

## Safety, privacy, and limitations

- No official IMD or NDMA SACHET alert feed is connected.
- Officer reports are not independently verified; demo content is labeled.
- “Is this safe?” does not infer safety. Without relevant official records, it returns the fixed no-official-information guidance.
- The full API stores officer reports and verified SMS subscription phone numbers in PostgreSQL. Configure access, backups, retention, and deletion policies before real-world use.
- Do not use this prototype to make evacuation, route, shelter, or rescue decisions. In India, call **112** for emergencies.
- Before production use, add verified official-source ingestion, stronger production identity management, audit logging, rate limiting, privacy review, and security testing.

## Commands

```sh
npm run dev       # Run the frontend and full local API
npm run dev:web   # Run only Vite
npm run api       # Run only the Express API
npm run build     # Build the frontend
npm run preview   # Preview the production frontend bundle
npm run lint      # Run Oxlint
```

## Libraries and external services

- React, Vite, Express, and PostgreSQL (`pg`)
- Leaflet and OpenStreetMap tiles
- Open-Meteo Forecast API
- Twilio Verify and Programmable Messaging (optional, paid)
- Google Translate web endpoint for officer bulletin translations
- Lucide React, Nodemailer, and bcryptjs
