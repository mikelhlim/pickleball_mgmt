import type { Match, PartnershipStats, Player, PlayerStats } from "@/lib/types";

/**
 * Computes the same per-player and per-partnership win/loss aggregates as
 * the `player_stats`/`partnership_stats` SQL views, but from an in-memory
 * list of matches — used to scope stats to a single game day, where a
 * parameterized view isn't worth the extra schema surface.
 */
export function computeMatchStats(
  matches: Match[],
  playersById: Map<string, Player>
): { playerStats: PlayerStats[]; partnershipStats: PartnershipStats[] } {
  const playerAgg = new Map<string, { matches_played: number; wins: number; losses: number }>();
  const partnershipAgg = new Map<
    string,
    { player_a_id: string; player_b_id: string; matches_played: number; wins: number; losses: number }
  >();

  for (const match of matches) {
    if (match.status !== "completed" || match.winner_team == null) continue;

    const teams: [string | null, string | null, 1 | 2][] = [
      [match.team1_player1_id, match.team1_player2_id, 1],
      [match.team2_player1_id, match.team2_player2_id, 2],
    ];

    for (const [p1, p2, teamNumber] of teams) {
      const won = match.winner_team === teamNumber;

      for (const pid of [p1, p2]) {
        if (!pid) continue;
        const cur = playerAgg.get(pid) ?? { matches_played: 0, wins: 0, losses: 0 };
        cur.matches_played += 1;
        if (won) cur.wins += 1;
        else cur.losses += 1;
        playerAgg.set(pid, cur);
      }

      if (p1 && p2) {
        const a = p1 < p2 ? p1 : p2;
        const b = p1 < p2 ? p2 : p1;
        const key = `${a}|${b}`;
        const cur = partnershipAgg.get(key) ?? {
          player_a_id: a,
          player_b_id: b,
          matches_played: 0,
          wins: 0,
          losses: 0,
        };
        cur.matches_played += 1;
        if (won) cur.wins += 1;
        else cur.losses += 1;
        partnershipAgg.set(key, cur);
      }
    }
  }

  const playerStats: PlayerStats[] = Array.from(playerAgg.entries()).map(([playerId, agg]) => {
    const player = playersById.get(playerId);
    return {
      player_id: playerId,
      name: player?.name ?? "Removed player",
      nickname: player?.nickname ?? null,
      ...agg,
    };
  });

  const partnershipStats: PartnershipStats[] = Array.from(partnershipAgg.values());

  return { playerStats, partnershipStats };
}
