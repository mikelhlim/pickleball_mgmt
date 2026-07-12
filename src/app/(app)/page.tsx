import Link from "next/link";
import { BarChart3, CalendarDays, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionScroller, type SessionGroup } from "@/components/dashboard/session-scroller";
import type { GameDay, PartnershipStats, PlayerStats, Venue } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: playerCount },
    { data: recentGameDays },
    { data: topPlayers },
    { data: topPartnerships },
    { data: players },
    { data: venues },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase
      .from("game_days")
      .select("*")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("player_stats").select("*").gt("matches_played", 0),
    supabase.from("partnership_stats").select("*").gt("matches_played", 0),
    supabase.from("players").select("id, name, nickname"),
    supabase.from("venues").select("*"),
  ]);

  const winPct = (wins: number, matchesPlayed: number) => (matchesPlayed > 0 ? wins / matchesPlayed : 0);
  const byWinPctDesc = (a: { wins: number; matches_played: number }, b: { wins: number; matches_played: number }) =>
    winPct(b.wins, b.matches_played) - winPct(a.wins, a.matches_played) || b.wins - a.wins;

  const topPlayersRanked = ((topPlayers ?? []) as PlayerStats[]).slice().sort(byWinPctDesc).slice(0, 3);
  const topPartnershipsRanked = ((topPartnerships ?? []) as PartnershipStats[])
    .slice()
    .sort(byWinPctDesc)
    .slice(0, 3);

  const gameDays = (recentGameDays ?? []) as GameDay[];
  const gameDayIds = gameDays.map((gd) => gd.id);

  const { data: liveMatches } =
    gameDayIds.length > 0
      ? await supabase
          .from("matches")
          .select("game_day_id, match_number")
          .in("game_day_id", gameDayIds)
          .eq("status", "in_progress")
      : { data: [] as { game_day_id: string; match_number: number }[] };

  const liveMatchByGameDay = new Map((liveMatches ?? []).map((m) => [m.game_day_id, m.match_number]));
  const venuesById = new Map(((venues ?? []) as Venue[]).map((v) => [v.id, v]));
  const nameById = new Map(
    (players ?? []).map((p: { id: string; name: string; nickname: string | null }) => [
      p.id,
      p.nickname || p.name,
    ])
  );

  const groups: SessionGroup[] = [];
  for (const gd of gameDays) {
    const card = {
      id: gd.id,
      status: gd.status,
      numMatches: gd.num_matches,
      venueName: gd.venue_id ? (venuesById.get(gd.venue_id)?.name ?? null) : null,
      liveMatchNumber: liveMatchByGameDay.get(gd.id) ?? null,
    };
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === gd.session_date) {
      lastGroup.sessions.push(card);
    } else {
      groups.push({ date: gd.session_date, sessions: [card] });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Quick overview of your pickleball club.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">{playerCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">Players</p>
            </div>
          </CardContent>
        </Card>
        <Link href="/game-days">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-4 p-6">
              <CalendarDays className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Game Days</p>
                <p className="text-sm text-muted-foreground">Create or run a session</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/statistics">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-4 p-6">
              <BarChart3 className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Statistics</p>
                <p className="text-sm text-muted-foreground">Win/loss records</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              Top Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPlayersRanked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed matches yet.</p>
            ) : (
              <ol className="space-y-2">
                {topPlayersRanked.map((p, i) => (
                  <li key={p.player_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {p.nickname || p.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(winPct(p.wins, p.matches_played) * 100)}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              Top Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartnershipsRanked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed matches yet.</p>
            ) : (
              <ol className="space-y-2">
                {topPartnershipsRanked.map((p, i) => (
                  <li
                    key={`${p.player_a_id}-${p.player_b_id}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {nameById.get(p.player_a_id) ?? "Unknown"} &amp;{" "}
                      {nameById.get(p.player_b_id) ?? "Unknown"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(winPct(p.wins, p.matches_played) * 100)}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Game Days</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionScroller groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}
