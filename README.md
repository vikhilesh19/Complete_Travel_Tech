# Wayfinder Travel Safety

## Problem

During flash floods, cyclones, and landslides, visitors can receive fragmented or untranslated warnings and may rely on unverified social posts. Wayfinder is a source-aware interface concept for helping travelers understand local conditions and contact responders without presenting rumors or sample records as verified alerts.

## Current delivery

This repository contains a responsive Vite web app with an Express API and PostgreSQL-backed officer hazard reports. Officers can sign in, submit a hazard location, coordinates, severity, and short description; reports are shared with traveler pages and shown on the map. Optional, region-specific SMS subscriptions can notify verified phone numbers when officers publish reports, but require a configured Twilio account. **This is not an operational emergency warning or response service.** The app still has no official alert feed, independent verification, web push, or mobile client.

The original scenario alert and map overlay remain illustrative and labeled as demo or unverified. Officer-submitted reports are persisted, but are not independently verified or treated as official guidance. Tourist safety actions remain local to the browser. The “Is this safe?” feature always returns “No official information yet for this area. Follow local authority instructions.”

## Delivery checklist

- [x] Responsive traveler view and officer sign-in/reporting view, split into React components and stylesheets.
- [x] PostgreSQL hazard storage with authenticated officer writes and public read-only report feed.
- [x] Region-specific phone opt-in with Twilio verification and officer-report SMS delivery (requires provider configuration; live delivery not tested).
- [x] Kerala coast and Wayanad hills scenarios with visible DEMO labels.
- [x] OpenStreetMap map tiles and live Open-Meteo current weather.
- [x] Safety question fixed fallback, local help actions, local request queue, and India emergency call link.
- [x] PWA area QR links, IndexedDB offline snapshots, network-first public hazard/config reads, and queued help actions.
- [ ] Official NDMA SACHET CAP or IMD alert ingestion, verified against a working official endpoint.
- [ ] Replace the single configured officer credential with production identity management, role-based access, audit logs, and rate limiting.
- [ ] Web Push, Telegram, production identity management, and expanded security tests.
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

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Set `DATABASE_URL`, `OFFICER_USERNAME`, `OFFICER_PASSWORD`, `SESSION_SECRET`, and the SMTP settings in `.env` before starting. For Gmail, enable 2-Step Verification on `vikhileshkrishna@gmail.com` and create a Google App Password; put that value in `SMTP_PASSWORD`, not your regular Gmail password. `SMTP_FROM_NAME=Travel_tech` sets the sender display name. Gmail requires `SMTP_FROM_EMAIL` to be your Gmail address or a verified send-as alias. Set `SMTP_REPLY_TO` to a real no-reply address or alias you control; Gmail cannot send as an arbitrary unverified address. Set `SMS_HELP_NUMBER` only if you want the public SMS fallback link; leave it empty to hide that link. Optional outbound hazard SMS setup is described below. The API creates the hazards, officer, OTP, tourist-help, and SMS subscription tables on startup. In the sidebar, open **Officer login**, choose **Register**, enter the officer email, username, and password, then request and verify the emailed code. Codes expire after 10 minutes and allow five attempts. Passwords are stored as bcrypt hashes; OTPs are stored as keyed hashes. Keep `.env` private; `.env.example` contains placeholders only. The Vite development server proxies `/api` to the Express server. In production, deploy the API behind the same origin as the frontend and provide the environment variables there.

Build and serve the production bundle locally:

```sh
npm run build
npm run preview
```

The static frontend can be deployed to Vercel with `npm run build` and `dist` as the output directory. This does not create the Next.js API or Supabase services in the original design brief. A public deployment link and demo video still need to be created and added for the hackathon submission.

## Offline use

- Hotel QR links can point to `/?area=kerala` or `/?area=wayanad`; the area selector remains available as a manual fallback.
- While online, open the desired area and choose **Save for offline**. Its hazards, available weather, road note, emergency number, and safety instruction are stored in this browser's IndexedDB with a saved timestamp. No shelter feed or road geometry is currently supplied, so the snapshot records shelters as unavailable and does not invent map features.
- Test the installed service worker with `npm run build` followed by `npm run preview`. Load and save an area once online, then use browser DevTools Network → Offline and reload the preview URL. The banner shows the saved time and warns when the snapshot is over six hours old.
- Offline maps use a plain background and saved geometry only; the app does not download OpenStreetMap tile sets. The current hazard feed provides points, not official zone polygons.
- Offline safety answers use only saved, unexpired, non-demo reports. Otherwise the app displays: “No official information yet for this area. Follow local authority instructions.” Offline use cannot receive new alerts or verify current conditions.
- “I’m safe” and “I need help” actions are stored locally and retried when connectivity returns. If `SMS_HELP_NUMBER` is configured, the app also offers a prefilled SMS link; the user must review and send it in their messaging app.

## Public APIs and libraries

- React 19 and Vite: frontend and build tooling.
- Leaflet: interactive map UI.
- OpenStreetMap standard tile service: map tiles; attribution is displayed on the map. Follow the tile usage policy before production-scale use.
- Open-Meteo Forecast API: current weather at the selected demo area, without an API key. Weather is contextual information, not an official hazard warning.
- Google Translate web endpoint: automatic Hindi, Malayalam, and Dutch translations for officer bulletin text. Bulletin text is sent to the translation service; the submitted original remains available in the report. Machine translations can be inaccurate and must not replace checking the issuing authority source.
- Lucide React: interface icons.
- Google Fonts: DM Sans and Fraunces typefaces.

Set `SMS_HELP_NUMBER` in the server `.env` to a public contact number in international format (for example `+919876543210`) to show the optional “Send help by SMS” link. Leave it empty to hide the link. The browser receives this public number through `/api/public-config`; no server secrets are sent to the client.

## SMS hazard alerts

Outbound alerts use Twilio Verify for phone ownership and Twilio Programmable Messaging for delivery. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, and `TWILIO_SMS_FROM_NUMBER` in the server environment. Set `TWILIO_INBOUND_WEBHOOK_URL` to the exact public HTTPS URL ending in `/api/sms/twilio/inbound`, then configure the Twilio sender's incoming-message webhook to that same URL. All five values are required before the opt-in form is enabled. Keep the auth token server-side; never expose it through a `VITE_` variable.

Travelers choose a region, enter an international-format number, explicitly consent, and verify ownership with a one-time SMS code. Only verified numbers are stored, keyed by phone and region. A successfully saved officer hazard triggers an alert only for verified subscribers to its selected region. Demo reports are labeled **DEMO ALERT**; other officer reports are labeled unverified. Messages include source and expiry and use the subscriber's selected language when Google translation is available, otherwise English. Delivery failures do not undo hazard creation; officers receive a delivery summary. A signed Twilio inbound message with `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT` deletes that phone's subscriptions.

Twilio Verify and SMS are paid services; prices and carrier delivery vary by destination. This integration is provider-ready but has not been live-tested without configured account credentials. The opt-in remains disabled until all required settings are present.

No key is needed for weather or maps. The backend does require PostgreSQL, officer/session settings, and SMTP credentials for officer registration emails; optional SMS requires Twilio credentials. Open-Meteo, map tiles, and automatic bulletin translation require an internet connection. Offline snapshots do not receive updates.

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
- Offline snapshots are browser-local and are not synchronized between devices. Shelter/road geometry and automatic official alert ingestion are not provided by the current data sources.
- Web Push, Telegram, WhatsApp, Expo Go, and an installable Android APK are not implemented. SMS requires a funded/configured Twilio account and has not been live-tested.
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
