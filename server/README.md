# Habit Tracker recovery API

This Node.js API stores Habit Tracker backups as plain JSON in Cloudinary raw storage. The Cloudinary API secret belongs only in server-side environment variables; never put it in the Expo app's `.env`.

## Deploy to Vercel

1. Push this project to a Git repository that Vercel can access. Ensure `server/.env` is not committed; it is ignored by Git.
2. In Vercel, create a project from the repository and set **Root Directory** to `server`.
3. Set the project environment variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using your Cloudinary account values. Keep the API secret server-side.
4. Deploy. Vercel uses the Node.js function files in `api/`; no separate build command is required.
5. Test `https://<your-project>.vercel.app/api/health`. The response should include `"ok": true` and `"configured": true`.
6. In the Expo project's root `.env`, set `EXPO_PUBLIC_BACKUP_API_URL=https://<your-project>.vercel.app/api` and `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` to the same Cloudinary cloud name. Restart Expo and rebuild the app so it uses the deployed URL.

Vercel routes API functions under `/api`, so the `/api` suffix in `EXPO_PUBLIC_BACKUP_API_URL` is required. For local development, keep the root URL such as `http://localhost:3000` and run `npm start` from this folder; the local Node server serves `/health` and `/recovery/*` without the `/api` prefix.

## Local development

Copy `.env.example` to `.env` in this folder and fill in the Cloudinary server credentials. Run `npm start` with Node.js 20 or later, then check `GET http://localhost:3000/health`.

In Settings → Data & Privacy, choose **Set Up Recovery Code** and save the generated code somewhere outside the app. This uploads the initial snapshot; later app changes are synced automatically. On a fresh install, enter that code on the recovery screen to fetch and validate the matching backup from Cloudinary. Without a previously uploaded snapshot and its code, there is nothing to restore.

The API signs uploads and stores each snapshot at a deterministic raw asset ID; the app fetches that public JSON asset directly from Cloudinary. Data is not encrypted, so anyone who obtains the code can read the backup. Keep it private. Cloudinary unsigned uploads cannot overwrite assets, so the small API is still needed to update a backup. The API currently treats each sync as the latest snapshot; this is a basic single-device recovery flow, not multi-device conflict resolution.
