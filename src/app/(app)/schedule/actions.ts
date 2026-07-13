"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth-role";
import { clubTodayDateString } from "@/lib/scheduled-game-day-promotion";

const ScheduledSessionSchema = z
  .object({
    session_date: z.string().min(1, "Date is required."),
    session_time: z.string().min(1, "Time is required."),
    venue_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((data) => data.session_date >= clubTodayDateString(), {
    message: "Cannot schedule a session in the past.",
    path: ["session_date"],
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
