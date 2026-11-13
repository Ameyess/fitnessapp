# FitStreak

Camera-powered rep counter with Duolingo-style daily streaks. Built with Next.js
(App Router), TypeScript, Tailwind, MediaPipe Pose Landmarker (client-side),
Firebase Auth/Firestore/FCM, and Recharts. Video never leaves the device.

## Features

- **Rep tracking**: live camera feed with skeleton overlay (canvas), joint-angle
  state machine with hysteresis, "get in frame" guide, manual rep correction.
- **Exercises** (plug-in configs): pushups, situps, crunches, squats, jumping
  jacks, planks (timed hold). Add a new exercise in one new file.
- **Streaks**: daily goals per exercise, strict streak with rest days, timezone-
  aware days, streak milestones (7/30/100).
- **Social**: friends by username/invite, friends-only leaderboard (streak +
  weekly reps).
- **Progress**: history page with recharts (reps/day, per exercise, weekly).
- **Reminders**: opt-in web push via FCM at a user-chosen time; Vercel Cron
  job calls a protected API route using firebase-admin.
- **PWA**: manifest + service worker, installable to Home Screen, wake lock,
  haptics, optional rep sound.
- **Design**: bright Duolingo-inspired UI, Nunito font, 3D-pressed buttons,
  streak flame in header, dark mode toggle.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- @mediapipe/tasks-vision (Pose Landmarker, lite model, GPU delegate)
- Firebase (Auth, Firestore, Cloud Messaging)
- Recharts, framer-motion, lucide-react, react-confetti, zustand
- Deploy target: Vercel

## Project structure

```
fitness-app/
├── public/                # manifest.json, sw.js, icon.svg
├── src/
│   ├── app/               # App Router pages + API routes
│   ├── components/        # ui, camera, layout, exercises
│   ├── hooks/             # useAuth
│   ├── lib/               # firebase, firebaseAdmin, mediapipe, db, exercises
│   ├── store/             # zustand workout session
│   └── types/             # shared TS types
├── firestore.rules        # Firestore security rules
├── vercel.json            # cron schedule
├── .env.example           # environment variables
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Exercise config example (plug-in style)

New exercises live in `src/lib/exercises/`. Example `src/lib/exercises/lunges.ts`:

```ts
import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const lunges: ExerciseConfig = baseExercise({
  id: "lunges",
  name: "Lunges",
  trackedLandmarks: [23, 24, 25, 26, 27, 28],
  cameraAngle: "side",
  downThreshold: 110,
  upThreshold: 170,
  repCompletedOn: "down-to-up",
  setupText: "Step forward, lower your knee, then return to stand.",
  phonePlacement: "Side view, phone at knee level, ~1.5 meters away.",
  distance: "About 1.5 meters (5 ft) from the phone.",
})
```

Then register it in `src/lib/exercises/index.ts`:

```ts
import { lunges } from "./lunges"
export const exerciseRegistry = { pushups, ..., lunges }
```

That's it — the core rep-counting, camera, and streak logic picks it up
automatically. No changes to `live/page.tsx` required.

## Prerequisites

- Node.js 18+
- A Firebase project (Firestore in Native mode, Authentication enabled)
- A Vercel account

## 1. Firebase setup

1. Create a project at https://console.firebase.google.com
2. **Authentication**: enable "Email/Password" and "Google" sign-in.
3. **Firestore**: create a database in **Native mode**.
4. **Cloud Messaging**: enable FCM (for web push reminders).
5. **Project settings > General**: copy your web app config values.
6. **Project settings > Service accounts**: generate a new private key
   (JSON). Base64-encode it:
   ```
   cat serviceAccountKey.json | base64 -w 0
   ```

## 2. Environment variables

Copy `.env.example` to `.env.local` (dev) and set the same variables in
Vercel project settings (production):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 of service account JSON>
CRON_SECRET=<a long random string>
```

`NEXT_PUBLIC_*` variables are exposed to the browser. `FIREBASE_SERVICE_ACCOUNT_BASE64`
and `CRON_SECRET` are server-only.

## 3. Firestore security rules

Deploy the rules in `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Or paste them into the Firebase Console > Firestore > Rules. Key rules:
- Users own their profile (read/write), limited public fields readable by friends.
- Workouts: only the owning user can read/write.
- Friends & friend requests: owner-scoped.
- `reminderLogs` and `dailyStats`: server-only writes.

## 4. Local development

```bash
cd fitness-app
npm install
cp .env.example .env.local
# edit .env.local with your Firebase config
npm run dev
```

Open http://localhost:3000. Sign in, complete onboarding (goals per exercise,
timezone, rest days), then start a workout. Camera permission is required for
rep counting; it runs entirely on-device.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New Project** → import the repo → Framework preset: Next.js.
3. Add all environment variables (including `FIREBASE_SERVICE_ACCOUNT_BASE64`
   and `CRON_SECRET` — these are NOT `NEXT_PUBLIC_`).
4. Deploy.

Vercel detects Next.js automatically. `vercel.json` configures the cron job:

```json
{
  "crons": [ { "path": "/api/cron/reminders", "schedule": "0 * * * *" } ]
}
```

The reminders cron runs every hour, checks each user's local reminder time, and
writes a reminder log if the day's goals aren't done. Connect it to FCM
`admin.messaging().send()` using `profile.pushToken` for real push delivery.

## 6. PWA

`public/manifest.json` and `public/sw.js` make the app installable. Replace
`public/icon.svg` with real PNG icons (192×192, 512×512) for production.
On iOS Safari, use "Add to Home Screen"; on Chrome/Edge, the install prompt
appears automatically.

## 7. Available scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check (`tsc --noEmit`)

## 8. Security notes

- Video and pose landmarks are processed client-side only; nothing is uploaded.
- Streak updates are validated server-side in `/api/streak` so clients can't
  trivially fake rep counts.
- The cron reminders route is protected by `CRON_SECRET`.
- Firestore rules enforce owner-only access; friends can only read public stats.

## License

MIT