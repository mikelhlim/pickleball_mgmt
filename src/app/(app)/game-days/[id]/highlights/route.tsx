import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { computeGameDayHighlights } from "@/lib/game-day-highlights";
import { GameDayHighlightsDocument } from "@/components/game-days/highlights-pdf";
import type { GameDay, Match, Player, Venue } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: gameDay } = (await supabase
    .from("game_days")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: GameDay | null };

  // Highlights only make sense once a Game Day is finished — matches are
  // still being played (or haven't started) otherwise.
  if (!gameDay || gameDay.status !== "completed") notFound();

  const [{ data: rosterRows }, { data: matches }, { data: allPlayers }, { data: venue }] = await Promise.all([
    supabase.from("game_day_players").select("player_id").eq("game_day_id", id),
    supabase.from("matches").select("*").eq("game_day_id", id).order("match_number"),
    supabase.from("players").select("*"),
    gameDay.venue_id
      ? supabase.from("venues").select("*").eq("id", gameDay.venue_id).maybeSingle()
      : Promise.resolve({ data: null as Venue | null }),
  ]);

  const rosterPlayerIds = (rosterRows ?? []).map((r) => r.player_id as string);
  const playersById = new Map(((allPlayers ?? []) as Player[]).map((p) => [p.id, p]));
  const highlights = computeGameDayHighlights((matches ?? []) as Match[], rosterPlayerIds);

  const buffer = await renderToBuffer(
    <GameDayHighlightsDocument gameDay={gameDay} venue={venue} highlights={highlights} playersById={playersById} />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="game-day-${gameDay.session_date}-highlights.pdf"`,
    },
  });
}
