import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// The club runs in the Philippines (UTC+8, no DST). session_date/session_time
// are naive — no timezone of their own — so the offset has to be supplied
// explicitly here rather than relying on whatever timezone the Node process
// happens to run in (local dev is Asia/Manila; Vercel is UTC). Same class of
// bug as the one fixed in components/ui/formatted-time.tsx, just on the
// write side instead of display.
const CLUB_UTC_OFFSET = "+08:00";

function scheduledInstant(sessionDate: string, sessionTime: string): number {
  return new Date(`${sessionDate}T${sessionTime}${CLUB_UTC_OFFSET}`).getTime();
}

/**
 * Safety-net promotion for scheduled sessions: there's no background job
 * scheduler here (see game-day-lifecycle.ts for the same pattern), so this
 * runs lazily from every page that shows scheduled sessions. Any session
 * whose date/time has arrived and hasn't been promoted yet gets turned into
 * a real Game Day, with its planned roster and venue carried over.
 */
export async function autoPromoteDueScheduledSessions(supabase: SupabaseServerClient): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due } = await supabase
    .from("scheduled_game_days")
    .select("id, session_date, session_time, num_matches, venue_id")
    .is("promoted_game_day_id", null)
    .lte("session_date", today);

  if (!due || due.length === 0) return;

  const now = Date.now();

  for (const session of due) {
    if (scheduledInstant(session.session_date, session.session_time) > now) continue;

    const { data: gameDay, error } = await supabase
      .from("game_days")
      .insert({
        session_date: session.session_date,
        num_matches: session.num_matches,
        venue_id: session.venue_id,
      })
      .select("id")
      .single();
    if (error || !gameDay) continue;

    const { data: rosterRows } = await supabase
      .from("scheduled_game_day_players")
      .select("player_id")
      .eq("scheduled_game_day_id", session.id);

    if (rosterRows && rosterRows.length > 0) {
      await supabase
        .from("game_day_players")
        .insert(rosterRows.map((r) => ({ game_day_id: gameDay.id, player_id: r.player_id })));
    }

    await supabase
      .from("scheduled_game_days")
      .update({ promoted_game_day_id: gameDay.id })
      .eq("id", session.id);
  }
}
