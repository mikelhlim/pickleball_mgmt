"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateOrderOfPlay } from "@/lib/scheduler";
import { assertAdmin, assertAuthenticated } from "@/lib/auth-role";

export async function addPlayerToRoster(gameDayId: string, playerId: string) {
  const supabase = await createClient();
  await assertAuthenticated(supabase);
  const { error } = await supabase
    .from("game_day_players")
    .insert({ game_day_id: gameDayId, player_id: playerId });
  // 23505 = unique_violation: player already on the roster, safe to ignore.
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/game-days/${gameDayId}`);
}

export async function addAllPlayersToRoster(gameDayId: string) {
  const supabase = await createClient();
  await assertAuthenticated(supabase);

  const [{ data: allPlayers }, { data: rosterRows }] = await Promise.all([
    supabase.from("players").select("id"),
    supabase.from("game_day_players").select("player_id").eq("game_day_id", gameDayId),
  ]);

  const rosterIds = new Set((rosterRows ?? []).map((r) => r.player_id as string));
  const toAdd = (allPlayers ?? [])
    .map((p) => p.id as string)
    .filter((id) => !rosterIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("game_day_players")
      .insert(toAdd.map((playerId) => ({ game_day_id: gameDayId, player_id: playerId })));
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/game-days/${gameDayId}`);
}

export async function removePlayerFromRoster(gameDayId: string, playerId: string) {
  const supabase = await createClient();
  await assertAuthenticated(supabase);
  const { error } = await supabase
    .from("game_day_players")
    .delete()
    .eq("game_day_id", gameDayId)
    .eq("player_id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/game-days/${gameDayId}`);
}

const NewPlayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  nickname: z.string().trim().optional(),
});

export type RegisterPlayerState = { error?: string; success?: boolean } | undefined;

export async function registerAndAddPlayer(
  gameDayId: string,
  _prev: RegisterPlayerState,
  formData: FormData
): Promise<RegisterPlayerState> {
  const parsed = NewPlayerSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  try {
    await assertAuthenticated(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({ name: parsed.data.name, nickname: parsed.data.nickname || null })
    .select("id")
    .single();
  if (error || !player) return { error: error?.message ?? "Failed to register player." };

  const { error: rosterError } = await supabase
    .from("game_day_players")
    .insert({ game_day_id: gameDayId, player_id: player.id });
  if (rosterError) return { error: rosterError.message };

  revalidatePath(`/game-days/${gameDayId}`);
  revalidatePath("/players");
  return { success: true };
}

export type GenerateState = { error?: string } | undefined;

export async function generateSchedule(
  gameDayId: string,
  _prev: GenerateState,
  formData: FormData
): Promise<GenerateState> {
  const numMatches = Number(formData.get("num_matches"));
  if (!Number.isInteger(numMatches) || numMatches < 1) {
    return { error: "Enter a valid number of matches." };
  }

  const supabase = await createClient();
  try {
    await assertAuthenticated(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  // Regenerating after a match has started would corrupt already-recorded
  // results, so only allow it while every match is still untouched.
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, status")
    .eq("game_day_id", gameDayId);

  if (existingMatches?.some((m) => m.status !== "pending")) {
    return { error: "Can't regenerate — a match has already started." };
  }

  const { data: roster } = await supabase
    .from("game_day_players")
    .select("player_id")
    .eq("game_day_id", gameDayId);

  const playerIds = (roster ?? []).map((r) => r.player_id as string);
  if (playerIds.length < 4) {
    return { error: "At least 4 players are required." };
  }

  let assignments;
  try {
    assignments = generateOrderOfPlay(playerIds, numMatches, Date.now());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate schedule." };
  }

  await supabase.from("matches").delete().eq("game_day_id", gameDayId);

  const rows = assignments.map((a) => ({
    game_day_id: gameDayId,
    match_number: a.matchNumber,
    team1_player1_id: a.team1[0],
    team1_player2_id: a.team1[1],
    team2_player1_id: a.team2[0],
    team2_player2_id: a.team2[1],
    status: "pending" as const,
  }));

  const { error: insertError } = await supabase.from("matches").insert(rows);
  if (insertError) return { error: insertError.message };

  await supabase
    .from("game_days")
    .update({ num_matches: numMatches, status: "in_progress" })
    .eq("id", gameDayId);

  revalidatePath(`/game-days/${gameDayId}`);
  return undefined;
}

export async function startMatch(matchId: string, gameDayId: string) {
  const supabase = await createClient();
  await assertAuthenticated(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("matches")
    .update({ status: "in_progress", started_at: now })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  // Stamp the game day's own start time the first time any match starts;
  // the `.is(...)` guard means later matches won't overwrite it.
  await supabase.from("game_days").update({ started_at: now }).eq("id", gameDayId).is("started_at", null);

  revalidatePath(`/game-days/${gameDayId}`);
}

export async function endMatch(
  matchId: string,
  gameDayId: string,
  team1Score: number,
  team2Score: number
) {
  if (team1Score === team2Score) {
    throw new Error("Scores can't be tied — enter a final score with a winner.");
  }
  const winnerTeam: 1 | 2 = team1Score > team2Score ? 1 : 2;

  const supabase = await createClient();
  await assertAuthenticated(supabase);

  const { data: match, error: fetchError } = await supabase
    .from("matches")
    .select("started_at")
    .eq("id", matchId)
    .single();
  if (fetchError || !match) throw new Error(fetchError?.message ?? "Match not found.");

  const endedAt = new Date();
  const startedAt = match.started_at ? new Date(match.started_at) : endedAt;
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  const { error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      winner_team: winnerTeam,
      team1_score: team1Score,
      team2_score: team2Score,
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  const { data: remaining } = await supabase
    .from("matches")
    .select("id")
    .eq("game_day_id", gameDayId)
    .neq("status", "completed");

  if (remaining && remaining.length === 0) {
    await supabase
      .from("game_days")
      .update({ status: "completed", ended_at: endedAt.toISOString() })
      .eq("id", gameDayId);
  }

  revalidatePath(`/game-days/${gameDayId}`);
  revalidatePath("/statistics");
}

export async function endGameDay(gameDayId: string) {
  const supabase = await createClient();
  await assertAdmin(supabase);

  // A running match would be left with no way to record its result once the
  // day is closed out, so require it to be ended first.
  const { data: inProgress } = await supabase
    .from("matches")
    .select("id")
    .eq("game_day_id", gameDayId)
    .eq("status", "in_progress");

  if (inProgress && inProgress.length > 0) {
    throw new Error("Finish the in-progress match before ending the game day.");
  }

  // Any match that never started has no result to lose — cancel it rather
  // than leaving it pending forever, matching the 4-hour auto-end behavior.
  await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("game_day_id", gameDayId)
    .eq("status", "pending");

  const { error } = await supabase
    .from("game_days")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", gameDayId);
  if (error) throw new Error(error.message);

  revalidatePath(`/game-days/${gameDayId}`);
  revalidatePath("/game-days");
  revalidatePath("/statistics");
}

export async function deleteGameDay(gameDayId: string) {
  const supabase = await createClient();
  await assertAdmin(supabase);

  const { error } = await supabase.from("game_days").delete().eq("id", gameDayId);
  if (error) throw new Error(error.message);

  revalidatePath("/game-days");
  revalidatePath("/statistics");
  revalidatePath("/");
}
