import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Mail, Phone, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth-role";
import { computeMatchStats } from "@/lib/stats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GameDay, Match, Player } from "@/lib/types";

function playerLabel(player: Player | undefined) {
  return player ? player.nickname || player.name : "Removed player";
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: rawPlayer }, role] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).maybeSingle(),
    getCurrentRole(supabase),
  ]);
  const fetchedPlayer = rawPlayer as Player | null;

  if (!fetchedPlayer) notFound();
  const isAdmin = role === "admin";
  // Email and phone are personal contact details — only admins see them.
  const player = isAdmin ? fetchedPlayer : { ...fetchedPlayer, email: null, phone: null };

  const orFilter = [
    `team1_player1_id.eq.${id}`,
    `team1_player2_id.eq.${id}`,
    `team2_player1_id.eq.${id}`,
    `team2_player2_id.eq.${id}`,
  ].join(",");

  const [{ data: matches }, { data: allPlayers }, { data: gameDays }] = await Promise.all([
    supabase.from("matches").select("*").or(orFilter),
    supabase.from("players").select("*"),
    supabase.from("game_days").select("*"),
  ]);

  const playersById = new Map(((allPlayers ?? []) as Player[]).map((p) => [p.id, p]));
  const gameDaysById = new Map(((gameDays ?? []) as GameDay[]).map((g) => [g.id, g]));
  const matchList = (matches ?? []) as Match[];

  const { playerStats, partnershipStats } = computeMatchStats(matchList, playersById);
  const overall = playerStats.find((s) => s.player_id === id) ?? {
    matches_played: 0,
    wins: 0,
    losses: 0,
  };
  const winPct = overall.matches_played > 0 ? Math.round((overall.wins / overall.matches_played) * 100) : 0;

  const partnerships = partnershipStats
    .filter((p) => p.player_a_id === id || p.player_b_id === id)
    .map((p) => {
      const partnerId = p.player_a_id === id ? p.player_b_id : p.player_a_id;
      return { partnerId, ...p };
    })
    .sort((a, b) => b.matches_played - a.matches_played);

  const history = matchList
    .filter((m) => m.status === "completed")
    .map((m) => {
      const onTeam1 = m.team1_player1_id === id || m.team1_player2_id === id;
      const myTeam: 1 | 2 = onTeam1 ? 1 : 2;
      const partnerId = onTeam1
        ? m.team1_player1_id === id
          ? m.team1_player2_id
          : m.team1_player1_id
        : m.team2_player1_id === id
          ? m.team2_player2_id
          : m.team2_player1_id;
      const opponentIds = onTeam1
        ? [m.team2_player1_id, m.team2_player2_id]
        : [m.team1_player1_id, m.team1_player2_id];
      const won = m.winner_team === myTeam;
      const gameDay = gameDaysById.get(m.game_day_id);
      const myScore = onTeam1 ? m.team1_score : m.team2_score;
      const opponentScore = onTeam1 ? m.team2_score : m.team1_score;
      return { match: m, partnerId, opponentIds, won, gameDay, myScore, opponentScore };
    })
    .sort((a, b) => {
      const dateDiff = (b.gameDay?.session_date ?? "").localeCompare(a.gameDay?.session_date ?? "");
      if (dateDiff !== 0) return dateDiff;
      return b.match.match_number - a.match.match_number;
    });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/players"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Players
        </Link>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
            <AvatarFallback className="text-lg">{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{player.name}</h1>
            {player.nickname && <p className="text-sm text-muted-foreground">&ldquo;{player.nickname}&rdquo;</p>}
            {(player.email || player.phone) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {player.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {player.email}
                  </span>
                )}
                {player.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {player.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{overall.matches_played}</p>
            <p className="text-xs text-muted-foreground">Played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-chart-1">{overall.wins}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{winPct}%</p>
            <p className="text-xs text-muted-foreground">Win rate</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
        </CardHeader>
        <CardContent>
          {partnerships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed matches yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Played</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Losses</TableHead>
                  <TableHead className="text-right">Win %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerships.map((p) => {
                  const pct = p.matches_played > 0 ? Math.round((p.wins / p.matches_played) * 100) : 0;
                  return (
                    <TableRow key={p.partnerId}>
                      <TableCell className="font-medium">{playerLabel(playersById.get(p.partnerId))}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.matches_played}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.wins}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.losses}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed matches yet.</p>
          ) : (
            history.map(({ match, partnerId, opponentIds, won, gameDay, myScore, opponentScore }) => (
              <Link
                key={match.id}
                href={gameDay ? `/statistics/${gameDay.id}` : "/statistics"}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {gameDay ? format(parseISO(gameDay.session_date), "MMM d, yyyy") : "Unknown date"} ·
                    Match {match.match_number}
                  </p>
                  <p className="truncate">
                    with {playerLabel(playersById.get(partnerId ?? ""))} vs{" "}
                    {opponentIds.map((oid) => playerLabel(playersById.get(oid ?? ""))).join(" & ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {won && <Trophy className="size-4 text-primary" />}
                  <span className={won ? "font-medium text-chart-1" : "font-medium text-chart-2"}>
                    {won ? "Won" : "Lost"}
                  </span>
                  {myScore != null && opponentScore != null && (
                    <span className="tabular-nums text-muted-foreground">
                      {myScore}-{opponentScore}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
