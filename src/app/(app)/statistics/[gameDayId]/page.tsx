import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { autoEndIfExpired } from "@/lib/game-day-lifecycle";
import { formatDuration, formatTime } from "@/lib/format";
import { computeMatchStats } from "@/lib/stats";
import { StatsCharts } from "@/components/statistics/stats-charts";
import { PartnershipTable } from "@/components/statistics/partnership-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GameDay, Match, Player, Venue } from "@/lib/types";

function playerLabel(player: Player | undefined) {
  return player ? player.nickname || player.name : "Removed player";
}

export default async function GameDayStatsPage({
  params,
}: {
  params: Promise<{ gameDayId: string }>;
}) {
  const { gameDayId } = await params;
  const supabase = await createClient();

  const { data: fetchedGameDay } = (await supabase
    .from("game_days")
    .select("*")
    .eq("id", gameDayId)
    .maybeSingle()) as { data: GameDay | null };

  if (!fetchedGameDay) notFound();

  const gameDay = await autoEndIfExpired(supabase, fetchedGameDay);

  const [{ data: matches }, { data: allPlayers }, { data: venue }] = await Promise.all([
    supabase.from("matches").select("*").eq("game_day_id", gameDayId).order("match_number"),
    supabase.from("players").select("*"),
    gameDay.venue_id
      ? supabase.from("venues").select("*").eq("id", gameDay.venue_id).maybeSingle()
      : Promise.resolve({ data: null as Venue | null }),
  ]);

  const playersById = new Map(((allPlayers ?? []) as Player[]).map((p) => [p.id, p]));
  const matchList = (matches ?? []) as Match[];
  const completed = matchList.filter((m) => m.status === "completed");

  const { playerStats, partnershipStats } = computeMatchStats(matchList, playersById);
  const nameById = new Map(
    ((allPlayers ?? []) as Player[]).map((p) => [p.id, p.nickname || p.name])
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/statistics"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to All Games
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {format(parseISO(gameDay.session_date), "EEEE, MMMM d, yyyy")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {completed.length} of {matchList.length} matches completed
          {venue && <> · {venue.name}</>}
          {gameDay.started_at && <> · Started {formatTime(gameDay.started_at)}</>}
          {gameDay.ended_at && <> · Ended {formatTime(gameDay.ended_at)}</>}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wins &amp; Losses — This Game Day</CardTitle>
        </CardHeader>
        <CardContent>
          <StatsCharts playerStats={playerStats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Pairings — This Game Day</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PartnershipTable partnerships={partnershipStats} nameById={nameById} />
          {partnershipStats.some((p) => p.matches_played > 0) && (
            <p className="text-xs text-muted-foreground">
              Each match is played by two pairings, so the “Played” column totals twice the
              number of completed matches ({completed.length}).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {matchList.map((match) => {
          const team1 = [
            playersById.get(match.team1_player1_id ?? ""),
            playersById.get(match.team1_player2_id ?? ""),
          ];
          const team2 = [
            playersById.get(match.team2_player1_id ?? ""),
            playersById.get(match.team2_player2_id ?? ""),
          ];

          return (
            <Card
              key={match.id}
              className={match.status === "in_progress" ? "border-chart-4 bg-chart-4/5" : ""}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  Match {match.match_number}
                </span>
                <Badge
                  variant={match.status === "completed" ? "secondary" : "outline"}
                  className={match.status === "in_progress" ? "bg-chart-4 text-white" : ""}
                >
                  {match.status === "completed" && match.duration_seconds != null
                    ? formatDuration(match.duration_seconds)
                    : match.status === "in_progress"
                      ? "Live"
                      : match.status === "cancelled"
                        ? "Cancelled"
                        : "Pending"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-1 items-center gap-2">
                    {match.winner_team === 1 && <Trophy className="size-4 shrink-0 text-primary" />}
                    <div className="flex -space-x-2">
                      {team1.map((p, i) => (
                        <Avatar key={i} className="size-8 ring-2 ring-background">
                          <AvatarImage src={p?.photo_url ?? undefined} alt={playerLabel(p)} />
                          <AvatarFallback className="text-xs">
                            {p ? p.name.slice(0, 2).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="truncate text-sm">
                      {playerLabel(team1[0])} &amp; {playerLabel(team1[1])}
                    </span>
                    {match.team1_score != null && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {match.team1_score}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <div className="flex flex-1 items-center justify-end gap-2 text-right">
                    {match.team2_score != null && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {match.team2_score}
                      </span>
                    )}
                    <span className="truncate text-sm">
                      {playerLabel(team2[0])} &amp; {playerLabel(team2[1])}
                    </span>
                    <div className="flex -space-x-2">
                      {team2.map((p, i) => (
                        <Avatar key={i} className="size-8 ring-2 ring-background">
                          <AvatarImage src={p?.photo_url ?? undefined} alt={playerLabel(p)} />
                          <AvatarFallback className="text-xs">
                            {p ? p.name.slice(0, 2).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {match.winner_team === 2 && <Trophy className="size-4 shrink-0 text-primary" />}
                  </div>
                </div>
                {(match.started_at || match.ended_at) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {match.started_at && <>Started {formatTime(match.started_at)}</>}
                    {match.ended_at && <> · Ended {formatTime(match.ended_at)}</>}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
