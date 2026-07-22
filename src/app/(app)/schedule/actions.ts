"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, assertAuthenticated } from "@/lib/auth-role";
import { clubTodayDateString } from "@/lib/scheduled-game-day-promotion";
import { formatTimeOfDay } from "@/lib/format";

const ScheduledSessionSchema = z
  .object({
    session_date: z.string().min(1, "Date is required."),
    session_time: z.string().min(1, "Time is required."),
    end_time: z.string().optional().or(z.literal("")),
    court_number: z.string().optional().or(z.literal("")),
    venue_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((data) => data.session_date >= clubTodayDateString(), {
    message: "Cannot schedule a session in the past.",
    path: ["session_date"],
  })
  .refine((data) => !data.end_time || data.end_time > data.session_time, {
    message: "End time must be after the start time.",
    path: ["end_time"],
  })
  .refine((data) => !data.court_number || /^\d+$/.test(data.court_number), {
    message: "Court number must be a positive whole number.",
    path: ["court_number"],
  });

export type ScheduleFormState = { error?: string; success?: boolean } | undefined;

function playerIdsFrom(formData: FormData): string[] {
  return formData
    .getAll("player_ids")
    .map(String)
    .filter(Boolean);
}

export async function createScheduledSession(
  _prev: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const parsed = ScheduledSessionSchema.safeParse({
    session_date: formData.get("session_date"),
    session_time: formData.get("session_time"),
    end_time: formData.get("end_time"),
    court_number: formData.get("court_number"),
    venue_id: formData.get("venue_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const playerIds = playerIdsFrom(formData);

  const supabase = await createClient();
  try {
    await assertAuthenticated(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { data: session, error } = await supabase
    .from("scheduled_game_days")
    .insert({
      session_date: parsed.data.session_date,
      session_time: parsed.data.session_time,
      end_time: parsed.data.end_time || null,
      court_number: parsed.data.court_number ? Number(parsed.data.court_number) : null,
      venue_id: parsed.data.venue_id || null,
    })
    .select("id")
    .single();
  if (error || !session) return { error: error?.message ?? "Failed to schedule session." };

  if (playerIds.length > 0) {
    const { error: rosterError } = await supabase
      .from("scheduled_game_day_players")
      .insert(playerIds.map((playerId) => ({ scheduled_game_day_id: session.id, player_id: playerId })));
    if (rosterError) return { error: rosterError.message };
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  return { success: true };
}

export async function updateScheduledSession(
  _prev: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing session id." };

  const parsed = ScheduledSessionSchema.safeParse({
    session_date: formData.get("session_date"),
    session_time: formData.get("session_time"),
    end_time: formData.get("end_time"),
    court_number: formData.get("court_number"),
    venue_id: formData.get("venue_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const playerIds = playerIdsFrom(formData);

  const supabase = await createClient();
  try {
    await assertAuthenticated(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { error } = await supabase
    .from("scheduled_game_days")
    .update({
      session_date: parsed.data.session_date,
      session_time: parsed.data.session_time,
      end_time: parsed.data.end_time || null,
      court_number: parsed.data.court_number ? Number(parsed.data.court_number) : null,
      venue_id: parsed.data.venue_id || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Replace the roster wholesale rather than diffing — simpler, and the
  // roster list is small.
  await supabase.from("scheduled_game_day_players").delete().eq("scheduled_game_day_id", id);
  if (playerIds.length > 0) {
    const { error: rosterError } = await supabase
      .from("scheduled_game_day_players")
      .insert(playerIds.map((playerId) => ({ scheduled_game_day_id: id, player_id: playerId })));
    if (rosterError) return { error: rosterError.message };
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  return { success: true };
}

export async function deleteScheduledSession(id: string) {
  const supabase = await createClient();
  await assertAuthenticated(supabase);
  const { error } = await supabase.from("scheduled_game_days").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function sendScheduleReminder(
  scheduledGameDayId: string
): Promise<{ sentCount: number; skippedCount: number; failedCount: number }> {
  const supabase = await createClient();
  // Reminder emails carry players' contact details, so only admins — the
  // same people who can already see email addresses — can trigger this.
  await assertAdmin(supabase);

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_game_days")
    .select("session_date, session_time, end_time, court_number, venue_id")
    .eq("id", scheduledGameDayId)
    .single();
  if (sessionError || !session) throw new Error(sessionError?.message ?? "Session not found.");

  const [{ data: rosterRows }, { data: venue }] = await Promise.all([
    supabase
      .from("scheduled_game_day_players")
      .select("player_id")
      .eq("scheduled_game_day_id", scheduledGameDayId),
    session.venue_id
      ? supabase.from("venues").select("name").eq("id", session.venue_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const playerIds = (rosterRows ?? []).map((r) => r.player_id as string);
  if (playerIds.length === 0) throw new Error("This session has no players on its roster yet.");

  const { data: players } = await supabase
    .from("players")
    .select("name, nickname, email")
    .in("id", playerIds);

  const recipients = (players ?? []).filter(
    (p): p is { name: string; nickname: string | null; email: string } => Boolean(p.email)
  );
  const skippedCount = playerIds.length - recipients.length;
  if (recipients.length === 0) {
    throw new Error("No players on this session's roster have an email on file.");
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "Email reminders aren't configured yet — an admin needs to add GMAIL_USER and GMAIL_APP_PASSWORD."
    );
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  const from = process.env.GMAIL_FROM_NAME
    ? `${process.env.GMAIL_FROM_NAME} <${process.env.GMAIL_USER}>`
    : process.env.GMAIL_USER;

  const dateLabel = format(parseISO(session.session_date), "EEEE, MMMM d, yyyy");
  const timeLabel = session.end_time
    ? `${formatTimeOfDay(session.session_time)} – ${formatTimeOfDay(session.end_time)}`
    : formatTimeOfDay(session.session_time);
  const venueLine = venue?.name ? `<p>📍 ${venue.name}</p>` : "";
  const courtLine = session.court_number ? `<p>🏓 Court ${session.court_number}</p>` : "";

  // Send individually (rather than one email with everyone in "to"/"bcc") so
  // one bad address can't block the reminder from reaching everyone else,
  // and so no player sees anyone else's email address.
  const results = await Promise.allSettled(
    recipients.map((player) =>
      transporter.sendMail({
        from,
        to: player.email,
        subject: `Reminder: Pickleball Game Day — ${dateLabel}`,
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
  return { sentCount: recipients.length - failedCount, skippedCount, failedCount };
}
