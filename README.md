# Wayfinder Travel Safety

## Problem

During flash floods, cyclones, and landslides, visitors can receive fragmented or untranslated warnings and may rely on unverified social posts. Wayfinder is a source-aware interface concept for helping travelers understand local conditions and contact responders without presenting rumors or sample records as verified alerts.

## Current delivery

This repository contains a responsive Vite web app with an Express API and PostgreSQL-backed officer hazard reports. Officers can sign in, submit a hazard location, coordinates, severity, and short description; reports are shared with traveler pages and shown on the map. **This is not an operational emergency warning or response service.** The app still has no official alert feed, independent verification, notifications, or mobile client.

The original scenario alert and map overlay remain illustrative and labeled as demo or unverified. Officer-submitted reports are persisted, but are not independently verified or treated as official guidance. Tourist safety actions remain local to the browser. The “Is this safe?” feature always returns “No official information yet for this area. Follow local authority instructions.”

## Delivery checklist

- [x] Responsive traveler view and officer sign-in/reporting view, split into React components and stylesheets.
- [x] PostgreSQL hazard storage with authenticated officer writes and public read-only report feed.
- [x] Kerala coast and Wayanad hills scenarios with visible DEMO labels.
- [x] OpenStreetMap map tiles and live Open-Meteo current weather.
- [x] Safety question fixed fallback, local help actions, local request queue, and India emergency call link.
- [x] PWA manifest and offline app-shell/static asset caching.
- [ ] Official NDMA SACHET CAP or IMD alert ingestion, verified against a working official endpoint.
- [ ] Replace the single configured officer credential with production identity management, role-based access, audit logs, and rate limiting.
- [ ] Server-side translations/AI, Web Push, Telegram, rate limiting, persistent/offline data, and security tests.
- [ ] Expo Go tourist client and installable Android package (Phase 2).
- [ ] Public deployment URL and 2–5 minute demo video added to the repository.

## Run locally

Requirements: Node.js 20.19+ or 22.12+, npm, and PostgreSQL.

```sh
npm install
createdb wayfinder
cp .env.example .env
npm run dev:full
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Set `DATABASE_URL`, `OFFICER_USERNAME`, `OFFICER_PASSWORD`, `SESSION_SECRET`, and the SMTP settings in `.env` before starting. For Gmail, enable 2-Step Verification on `vikhileshkrishna@gmail.com` and create a Google App Password; put that value in `SMTP_PASSWORD`, not your regular Gmail password. `SMTP_FROM_NAME=Travel_tech` sets the sender display name. Gmail requires `SMTP_FROM_EMAIL` to be your Gmail address or a verified send-as alias. Set `SMTP_REPLY_TO` to a real no-reply address or alias you control; Gmail cannot send as an arbitrary unverified address. The API creates the `hazards`, `officer_accounts`, and OTP tables on startup. In the sidebar, open **Officer login**, choose **Register**, enter the officer email, username, and password, then request and verify the emailed code. Codes expire after 10 minutes and allow five attempts. Passwords are stored as bcrypt hashes; OTPs are stored as keyed hashes. Keep `.env` private; `.env.example` contains placeholders only. The Vite development server proxies `/api` to the Express server. In production, deploy the API behind the same origin as the frontend and provide the environment variables there.

Build and serve the production bundle locally:

```sh
npm run build
npm run preview
```

The static frontend can be deployed to Vercel with `npm run build` and `dist` as the output directory. This does not create the Next.js API or Supabase services in the original design brief. A public deployment link and demo video still need to be created and added for the hackathon submission.

## Public APIs and libraries

- React 19 and Vite: frontend and build tooling.
- Leaflet: interactive map UI.
- OpenStreetMap standard tile service: map tiles; attribution is displayed on the map. Follow the tile usage policy before production-scale use.
- Open-Meteo Forecast API: current weather at the selected demo area, without an API key. Weather is contextual information, not an official hazard warning.
- Google Translate web endpoint: automatic Hindi, Malayalam, and Dutch translations for officer bulletin text. Bulletin text is sent to the translation service; the submitted original remains available in the report. Machine translations can be inaccurate and must not replace checking the issuing authority source.
- Lucide React: interface icons.
- Google Fonts: DM Sans and Fraunces typefaces.

No API keys or environment variables are required by this prototype. Open-Meteo and map requests require an internet connection. When the weather service is unavailable, the UI reports that it is unavailable instead of substituting fabricated values.

## Demo walkthrough

1. Select **Kerala coast** or **Wayanad hills** to inspect the illustrative scenario and live weather panel.
2. Open **Officer login**, sign in with the configured credentials, and submit a hazard report with coordinates.
3. Return to **Traveler view** to see the shared report in the feed and as a map marker. The feed refreshes every 30 seconds.
4. Ask “Is this safe?” and confirm that the app gives the fixed no-official-information response; officer-submitted reports are not treated as independently verified official guidance.

## Limitations and next work

- Verify an official NDMA SACHET CAP feed and IMD source before displaying real alerts. Neither feed is currently queried; the prototype does not claim their availability.
- Replace the configured single officer credential with managed officer accounts, multi-factor authentication, role checks, and audit logs before production use.
- Add validated alert normalization, geofencing, approved message templates, translations, source/timestamp presentation, and strict Gemini JSON handling only behind server routes. “Is this safe?” must continue to return the fixed fallback when no relevant official record exists.
- Add RLS to every Supabase table, input validation, per-IP rate limiting, safe error handling, and logged-out authorization tests. Never put Gemini or Supabase service-role keys in a browser environment variable.
- The service worker caches the app shell and same-origin static files only. It does not cache alerts, shelters, roads, weather, or help requests for offline use. Web Push, Telegram, Expo Go, and an installable Android APK are not implemented.
- SMS and WhatsApp are rollout options only, not working features.
- Do not use this prototype to make real evacuation, route, shelter, or rescue decisions. Emergency services in India: **112**.
- Minimize location collection in any future backend; prefer manual area selection. Explain location use and implement event-based deletion/anonymization for location and chat data.
- Before real deployment, add signed official-source ingestion, audit logs, two-factor official login, privacy review, and moderation for traveler reports.
- Run `npm audit` before deployment. Verify authority endpoints while logged out and confirm they refuse access once those endpoints exist.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
