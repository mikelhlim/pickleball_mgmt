# Pickleball Player & Game Management

A mobile-friendly web app for running pickleball open-play sessions: register players,
create a "game day," auto-generate a doubles Order of Play (with partner-rotation and
rest rules), track match results, and view win/loss statistics.

Built with **Next.js 16 (App Router, TypeScript)**, **Tailwind CSS + shadcn/ui**, and
**Supabase** (Postgres, Auth, Storage).

## 1. Prerequisites

- [Node.js](https://nodejs.org/) 20.9 or later
- [VS Code](https://code.visualstudio.com/) (or any editor)
- A free [Supabase](https://supabase.com/) account

## 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Once it's ready, open **SQL Editor** in the left sidebar, click **New query**, paste in
   the entire contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
   This creates all the tables, security policies, statistics views, and the
   `player-photos` storage bucket. It's safe to re-run if you ever need to.
3. Open **Authentication → Users** and click **Add user → Create new user**. Enter an
   email and password for yourself — this is the single admin account the app uses to
   sign in. (Turn off "Auto confirm user" only if you want an email confirmation step;
   for a private club tool, leaving it checked is simplest.)
4. Open **Project Settings → API**. You'll need two values from this page in the next step:
   - **Project URL**
   - **anon public** API key

## 3. Configure the app

1. Open this folder (`pickleball-app`) in VS Code.
2. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the two values from Supabase step 2.4 above:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## 4. Install and run

In a VS Code terminal (``Terminal > New Terminal``):

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin user you
created in step 2.3.

### Using it from your phone

With the dev server running, find your computer's local network IP (e.g. on macOS:
`ipconfig getifaddr en0`), then on your phone (connected to the same WiFi) visit:

```
http://<your-computer-ip>:3000
```

Player photo upload will offer to open the camera directly when you tap "Add photo" on
a phone.

## 5. Everyday use

- **Players**: register players with a name, optional nickname, and photo.
- **Game Days**: create a session for a date, add players to the roster (existing or
  register new ones inline), set the number of matches, and click **Generate Order of
  Play**. The scheduler rotates partners and rest turns automatically — you can
  **Regenerate** for a different valid schedule as long as no match has started yet.
- Start each match to begin its timer, then **End Match** to record the winner (and
  optional score).
- **Statistics** shows win/loss records per player and per team pairing, with graphs,
  plus a drill-down into any past game day.
- **Admin → Delete All Game Data** wipes all game days/matches (keeping your player
  roster) if you want to start fresh.

## 6. Running tests

The doubles-scheduling algorithm (partner rotation + rest rules) has its own unit test
suite, independent of Supabase:

```bash
npm test
```

## 7. Deploying (optional)

To make the app reachable from anywhere (not just your home WiFi), deploy it to
[Vercel](https://vercel.com) (free tier is enough for a club):

1. Push this project to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Add the same two environment variables from step 3 in the Vercel project's
   **Settings → Environment Variables**.
4. Deploy. Vercel gives you a public URL you can open from any phone.

## Project structure

```
src/
  app/
    login/                 Sign-in page
    (app)/                 Everything behind auth, sharing the nav layout
      page.tsx             Dashboard
      players/             Player registration & management
      game-days/            List + create game days
      game-days/[id]/       Roster, Order of Play, live match play
      statistics/           Win/loss stats & graphs
      statistics/[gameDayId]/  Per-session match history
      admin/                Delete-all-game-data
  components/               UI components (shadcn/ui primitives in components/ui)
  lib/
    scheduler.ts            Doubles Order of Play generator (+ scheduler.test.ts)
    supabase/                Browser & server Supabase clients
    types.ts                 Shared domain types
  proxy.ts                   Route protection (Next.js 16's renamed middleware)
supabase/
  schema.sql                 Full DB schema, RLS policies, storage bucket, stats views
```
