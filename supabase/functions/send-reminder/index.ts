// Supabase Edge Function used by the iOS app's "Send Reminder" button on a
// scheduled session's Upcoming Sessions row.
//
// Ports sendScheduleReminder from src/app/(app)/schedule/actions.ts
// verbatim (same recipient selection, same per-recipient send strategy,
// same email copy). The web app sends via Gmail SMTP using nodemailer
// directly from a Next.js Server Action, holding GMAIL_USER /
// GMAIL_APP_PASSWORD as regular env vars; a mobile app binary can't hold
// those safely, so the iOS client instead calls this function
// (authenticated with the signed-in user's own JWT) and this function
// holds the Gmail credentials server-side as Supabase secrets instead.
// Only admins may trigger it — reminder emails carry players' contact
// details, the same people who can already see email addresses.
//
// One-time setup (from the pickleball-app directory, with the Supabase CLI
// installed and linked to your project):
//   supabase functions deploy send-reminder
//   supabase secrets set GMAIL_USER=you@gmail.com
//   supabase secrets set GMAIL_APP_PASSWORD=your-16-char-app-password
//   supabase secrets set GMAIL_FROM_NAME="Pickleball Manager"   # optional

import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let scheduledGameDayId: string;
  try {
    const body = await req.json();
    scheduledGameDayId = String(body.scheduledGameDayId ?? "");
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!scheduledGameDayId) return json({ error: "Missing scheduledGameDayId." }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not signed in." }, 401);

  // Missing/null role defaults to admin, matching roleFromAppMetadata in
  // src/lib/auth-role.ts.
  const isAdmin = (user.app_metadata?.role ?? "admin") === "admin";
  if (!isAdmin) return json({ error: "Only admins can do this." }, 403);

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_game_days")
    .select("session_date, session_time, end_time, court_number, venue_id")
    .eq("id", scheduledGameDayId)
    .single();
  if (sessionError || !session) {
    return json({ error: sessionError?.message ?? "Session not found." }, 404);
  }

  const [{ data: rosterRows }, { data: venue }] = await Promise.all([
    supabase.from("scheduled_game_day_players").select("player_id").eq("scheduled_game_day_id", scheduledGameDayId),
    session.venue_id
      ? supabase.from("venues").select("name").eq("id", session.venue_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const playerIds = (rosterRows ?? []).map((r) => r.player_id as string);
  if (playerIds.length === 0) {
    return json({ error: "This session has no players on its roster yet." }, 400);
  }

  const { data: players } = await supabase.from("players").select("name, nickname, email").in("id", playerIds);

  const recipients = (players ?? []).filter(
    (p): p is { name: string; nickname: string | null; email: string } => Boolean(p.email)
  );
  const skippedCount = playerIds.length - recipients.length;
  if (recipients.length === 0) {
    return json({ error: "No players on this session's roster have an email on file." }, 400);
  }

  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!gmailUser || !gmailPassword) {
    return json({ error: "Email reminders aren't configured yet — an admin needs to add GMAIL_USER and GMAIL_APP_PASSWORD." }, 500);
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
  });
  const fromName = Deno.env.get("GMAIL_FROM_NAME");
  const from = fromName ? `${fromName} <${gmailUser}>` : gmailUser;

  const dateLabel = formatDateLabel(session.session_date);
  const timeLabel = session.end_time
    ? `${formatTimeOfDay(session.session_time)} \u{2013} ${formatTimeOfDay(session.end_time)}`
    : formatTimeOfDay(session.session_time);
  const venueLine = venue?.name ? `<p>\u{1F4CD} ${venue.name}</p>` : "";
  const courtLine = session.court_number ? `<p>\u{1F3D3} Court ${session.court_number}</p>` : "";

  // Send individually (rather than one email with everyone in "to"/"bcc")
  // so one bad address can't block the reminder from reaching everyone
  // else, and so no player sees anyone else's email address.
  const results = await Promise.allSettled(
    recipients.map((player) =>
      transporter.sendMail({
        from,
        to: player.email,
        subject: `Reminder: Pickleball Game Day \u{2014} ${dateLabel}`,
        html: `
          <p>Hi ${player.nickname || player.name},</p>
          <p>This is a reminder that you're on the roster for an upcoming Game Day session:</p>
          <p><strong>${dateLabel} at ${timeLabel}</strong></p>
          ${venueLine}
          ${courtLine}
          <p>See you on the court!</p>
        `,
      })
    )
  );

  const failedCount = results.filter((r) => r.status === "rejected").length;
  return json({ sentCount: recipients.length - failedCount, skippedCount, failedCount }, 200);
});

function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function formatTimeOfDay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h, m));
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
