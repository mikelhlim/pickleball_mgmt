import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { autoEndIfExpired } from "@/lib/game-day-lifecycle";
import { getCurrentRole } from "@/lib/auth-role";
import { RosterPanel } from "@/components/game-days/roster-panel";
import { MatchCard } from "@/components/game-days/match-card";
import { EndGameDayDialog } from "@/components/game-days/end-game-day-dialog";
import { Badge } from "@/components/ui/badge";
import { formatHoursMinutesBetween } from "@/lib/format";
import { FormattedTime } from "@/components/ui/formatted-time";
import type { GameDay, Match, Player, Venue } from "@/lib/types";

export default async function GameDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fetchedGameDay } = (await supabase
    .from("game_days")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: GameDay | null };

  if (!fetchedGameDay) notFound();

  const gameDay = await autoEndIfExpired(supabase, fetchedGameDay);

  const [{ data: rosterRows }, { data: allPlayers }, { data: matches }, { data: venue }, role] =
    await Promise.all([
      supabase.from("game_day_players").select("player_id").eq("game_day_id", id),
      supabase.from("players").select("*").order("name"),
      supabase.from("matches").select("*").eq("game_day_id", id).order("match_number"),
      gameDay.venue_id
        ? supabase.from("venues").select("*").eq("id", gameDay.venue_id).maybeSingle()
        : Promise.resolve({ data: null as Venue | null }),
      getCurrentRole(supabase),
    ]);
  const isAdmin = role === "admin";

  const players = (allPlayers ?? []) as Player[];
  const playersById = new Map(players.map((p) => [p.id, p]));

  const rosterIds = new Set((rosterRows ?? []).map((r) => r.player_id as string));
  const roster = players.filter((p) => rosterIds.has(p.id));
  const availablePlayers = players.filter((p) => !rosterIds.has(p.id));

  const matchList = (matches ?? []) as Match[];
  const canEditRoster =
    isAdmin && gameDay.status !== "completed" && matchList.every((m) => m.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/game-days"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Game Days
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {format(parseISO(gameDay.session_date), "EEEE, MMMM d, yyyy")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {gameDay.num_matches} matches
            {venue && <> · {venue.name}</>}
            {gameDay.started_at && (
              <>
                {" "}
                · Started <FormattedTime iso={gameDay.started_at} />
              </>
            )}
            {gameDay.started_at && gameDay.ended_at && (
              <> · {formatHoursMinutesBetween(gameDay.started_at, gameDay.ended_at)}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {gameDay.status === "in_progress" && isAdmin && <EndGameDayDialog gameDayId={id} />}
          <Badge
            variant={
              gameDay.status === "completed"
                ? "secondary"
                : gameDay.status === "in_progress"
                  ? "default"
                  : "outline"
            }
          >
            {gameDay.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <RosterPanel
        gameDayId={id}
        roster={roster}
        availablePlayers={availablePlayers}
        canEdit={canEditRoster}
        defaultNumMatches={gameDay.num_matches}
        hasMatches={matchList.length > 0}
      />

      {matchList.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Order of Play</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {matchList.map((match) => {
              const onCourtIds = new Set(
                [
                  match.team1_player1_id,
                  match.team1_player2_id,
                  match.team2_player1_id,
                  match.team2_player2_id,
                ].filter((v): v is string => Boolean(v))
              );
              const sittingOut = roster.filter((p) => !onCourtIds.has(p.id));

              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  gameDayId={id}
                  team1={[
                    match.team1_player1_id ? (playersById.get(match.team1_player1_id) ?? null) : null,
                    match.team1_player2_id ? (playersById.get(match.team1_player2_id) ?? null) : null,
                  ]}
                  team2={[
                    match.team2_player1_id ? (playersById.get(match.team2_player1_id) ?? null) : null,
                    match.team2_player2_id ? (playersById.get(match.team2_player2_id) ?? null) : null,
                  ]}
                  sittingOut={sittingOut}
                  locked={gameDay.status === "completed"}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
