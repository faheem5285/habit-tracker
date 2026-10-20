# Habit Tracker recovery API

This Node.js API signs Cloudinary uploads. Full backups are encrypted on the device before upload; the API and Cloudinary receive ciphertext. The Cloudinary API secret belongs only in server-side environment variables; never put it in the Expo app's `.env`.

## Deploy to Vercel

1. Push this project to a Git repository that Vercel can access. Ensure `recovery-api/.env` is not committed; it is ignored by Git.
2. In Vercel, create a project from the repository and set **Root Directory** to `recovery-api`.
3. Set the project environment variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using your Cloudinary account values. Keep the API secret server-side.
4. Deploy. Vercel uses the Node.js function files in `api/`; no separate build command is required.
5. Test `https://<your-project>.vercel.app/api/health`. The response should include `"ok": true` and `"configured": true`.
6. For local Expo development, set `EXPO_PUBLIC_BACKUP_API_URL=https://<your-project>.vercel.app/api` and `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` to the same Cloudinary cloud name in the Expo project's root `.env`. For APKs built with EAS, set both public values in every applicable build profile's `env` in `eas.json` (or configure them in the EAS environment selected by the profile). Rebuild the app after changing them; environment values are embedded in the bundle.
7. If the app is used on web, set `CORS_ALLOWED_ORIGINS` to the exact web app origins, separated by commas. The API accepts all origins by default because requests do not use cookies; restricting origins is recommended for a public web deployment.

Vercel routes API functions under `/api`, so the `/api` suffix in `EXPO_PUBLIC_BACKUP_API_URL` is required. For local development, keep the root URL such as `http://localhost:3000` and run `npm start` from this folder; the local Node server serves `/health` and `/recovery/*` without the `/api` prefix.

## Local development

Copy `.env.example` to `.env` in this folder and fill in the Cloudinary server credentials. Run `npm start` with Node.js 20 or later, then check `GET http://localhost:3000/health`. Run `npm test` to exercise the API's health, validation, CORS, and upload paths.

In Settings → Data & Privacy, choose **Set Up Recovery Code** and save the generated code somewhere outside the app. This uploads the initial full snapshot; later changes to habits, settings, finances, files, and the encrypted password vault are synced automatically. Files are encrypted individually and uploaded as Cloudinary raw assets. The full manifest and all application data are encrypted on the device with a key derived from the recovery code. The password vault remains additionally protected by its own master passphrase. On a fresh install, enter the recovery code to download and decrypt the snapshot. Without both the uploaded snapshot and its code, there is nothing to restore.

Deploy the updated API before using backups from an updated app; it must expose `/recovery/upload-signature`. Older backups created before client-side encryption remain in Cloudinary in their original plaintext format and should be replaced or removed separately. The API currently treats each sync as the latest snapshot; this is a basic single-device recovery flow, not multi-device conflict resolution.
