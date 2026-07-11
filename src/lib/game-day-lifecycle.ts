import type { createClient } from "@/lib/supabase/server";
import type { GameDay } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const AUTO_END_AFTER_MS = 4 * 60 * 60 * 1000;

/**
 * Safety net for sessions nobody remembered to close out: if a game day has
 * been in_progress for more than 4 hours since it started, cancel whichever
 * matches never got a final score and complete the game day. There's no
 * background job scheduler here, so this runs lazily — called from each page
 * that loads a game day — rather than on a timer.
 *
 * The cutoff used for ended_at/duration is exactly 4 hours after started_at,
 * not "whenever a user happened to load the page," so the recorded times
 * reflect when the session actually timed out.
 */
export async function autoEndIfExpired(
  supabase: SupabaseServerClient,
  gameDay: GameDay
): Promise<GameDay> {
  if (gameDay.status !== "in_progress" || !gameDay.started_at) return gameDay;

  const cutoff = new Date(new Date(gameDay.started_at).getTime() + AUTO_END_AFTER_MS);
  if (Date.now() < cutoff.getTime()) return gameDay;

  const cutoffIso = cutoff.toISOString();

  await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("game_day_id", gameDay.id)
    .eq("status", "pending");

  const { data: inProgressMatches } = await supabase
    .from("matches")
    .select("id, started_at")
    .eq("game_day_id", gameDay.id)
    .eq("status", "in_progress");

  for (const match of inProgressMatches ?? []) {
    const durationSeconds = match.started_at
      ? Math.max(0, Math.round((cutoff.getTime() - new Date(match.started_at).getTime()) / 1000))
      : null;
    await supabase
      .from("matches")
      .update({ status: "cancelled", ended_at: cutoffIso, duration_seconds: durationSeconds })
      .eq("id", match.id);
  }

  await supabase
    .from("game_days")
    .update({ status: "completed", ended_at: cutoffIso })
    .eq("id", gameDay.id);

  return { ...gameDay, status: "completed", ended_at: cutoffIso };
}
