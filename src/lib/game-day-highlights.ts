import type { Match } from "@/lib/types";

type WinLossRecord = { wins: number; losses: number; matchesPlayed: number };

export type PlayerRecord = WinLossRecord & { playerId: string; winPct: number };
export type TeamRecord = WinLossRecord & { playerAId: string; playerBId: string; winPct: number };
export type PlayerStreak = { playerId: string; streak: number };
export type TeamStreak = { playerAId: string; playerBId: string; streak: number };
export type MatchMargin = { match: Match; margin: number };
export type MatchDuration = { match: Match; durationSeconds: number };

export type GameDayHighlights = {
  matchesCompleted: number;
  topPlayer: PlayerRecord | null;
  topTeam: TeamRecord | null;
  biggestBlowout: MatchMargin | null;
  closestMatch: MatchMargin | null;
  longestMatch: MatchDuration | null;
  shortestMatch: MatchDuration | null;
  topPlayerStreak: PlayerStreak | null;
  topTeamStreak: TeamStreak | null;
  timesPlayed: { playerId: string; count: number }[];
};

// Canonicalizes an unordered player pair into a stable "a:b" map key (a < b),
// mirroring the least/greatest ordering the player_stats/partnership_stats
// SQL views already use in supabase/schema.sql.
function teamKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function winPct(rec: WinLossRecord): number {
  return rec.matchesPlayed > 0 ? rec.wins / rec.matchesPlayed : 0;
}

// Same ranking rule used for Top Players/Teams on the Dashboard: win % first,
// total wins as the tiebreaker.
function byRecordDesc(a: WinLossRecord, b: WinLossRecord): number {
  return winPct(b) - winPct(a) || b.wins - a.wins;
}

function recordOutcome(
  records: Map<string, WinLossRecord>,
  sequences: Map<string, boolean[]>,
  key: string,
  won: boolean
) {
  const rec = records.get(key) ?? { wins: 0, losses: 0, matchesPlayed: 0 };
  rec.matchesPlayed += 1;
  if (won) rec.wins += 1;
  else rec.losses += 1;
  records.set(key, rec);
  sequences.set(key, [...(sequences.get(key) ?? []), won]);
}

// Longest run of consecutive `true` values, e.g. [W,W,L,W,W,W] -> 3. A
// player's/team's streak is measured across only the matches they actually
// played, in match_number order — sitting out a match doesn't break it.
function longestWinRun(sequence: boolean[]): number {
  let best = 0;
  let current = 0;
  for (const won of sequence) {
    current = won ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

/**
 * Computes the end-of-day highlights for one Game Day's PDF summary.
 * `matches` may include any status — only "completed" matches with both
 * scores recorded count toward every stat. `rosterPlayerIds` seeds
 * `timesPlayed` with 0 for anyone on the roster who didn't end up playing.
 */
export function computeGameDayHighlights(matches: Match[], rosterPlayerIds: string[]): GameDayHighlights {
  const completed = matches
    .filter((m) => m.status === "completed" && m.team1_score != null && m.team2_score != null)
    .slice()
    .sort((a, b) => a.match_number - b.match_number);

  const playerRecords = new Map<string, WinLossRecord>();
  const playerSequences = new Map<string, boolean[]>();
  const teamRecords = new Map<string, WinLossRecord>();
  const teamSequences = new Map<string, boolean[]>();
  const timesPlayed = new Map<string, number>();
  for (const id of rosterPlayerIds) timesPlayed.set(id, 0);

  let biggestBlowout: MatchMargin | null = null;
  let closestMatch: MatchMargin | null = null;
  let longestMatch: MatchDuration | null = null;
  let shortestMatch: MatchDuration | null = null;

  for (const m of completed) {
    if (m.team1_score == null || m.team2_score == null) continue;

    const team1 = [m.team1_player1_id, m.team1_player2_id].filter((v): v is string => Boolean(v));
    const team2 = [m.team2_player1_id, m.team2_player2_id].filter((v): v is string => Boolean(v));

    for (const id of [...team1, ...team2]) {
      timesPlayed.set(id, (timesPlayed.get(id) ?? 0) + 1);
    }

    const margin = Math.abs(m.team1_score - m.team2_score);
    if (!biggestBlowout || margin > biggestBlowout.margin) biggestBlowout = { match: m, margin };
    if (!closestMatch || margin < closestMatch.margin) closestMatch = { match: m, margin };

    if (m.duration_seconds != null) {
      const durationSeconds = m.duration_seconds;
      if (!longestMatch || durationSeconds > longestMatch.durationSeconds) {
        longestMatch = { match: m, durationSeconds };
      }
      if (!shortestMatch || durationSeconds < shortestMatch.durationSeconds) {
        shortestMatch = { match: m, durationSeconds };
      }
    }

    // A completed match with no winner_team (shouldn't happen in practice —
    // ending a match always records one — but the column allows null)
    // still counts toward matchesCompleted/timesPlayed/margin/duration
    // above; it just can't be attributed to anyone's win/loss record.
    if (m.winner_team !== 1 && m.winner_team !== 2) continue;
    const team1Won = m.winner_team === 1;

    for (const id of team1) recordOutcome(playerRecords, playerSequences, id, team1Won);
    for (const id of team2) recordOutcome(playerRecords, playerSequences, id, !team1Won);
    if (team1.length === 2) recordOutcome(teamRecords, teamSequences, teamKey(team1[0], team1[1]), team1Won);
    if (team2.length === 2) recordOutcome(teamRecords, teamSequences, teamKey(team2[0], team2[1]), !team1Won);
  }

  const topPlayer =
    [...playerRecords.entries()]
      .map(([playerId, rec]): PlayerRecord => ({ playerId, ...rec, winPct: winPct(rec) }))
      .sort(byRecordDesc)[0] ?? null;

  const topTeam =
    [...teamRecords.entries()]
      .map(([key, rec]): TeamRecord => {
        const [playerAId, playerBId] = key.split(":");
        return { playerAId, playerBId, ...rec, winPct: winPct(rec) };
      })
      .sort(byRecordDesc)[0] ?? null;

  const topPlayerStreakCandidate = [...playerSequences.entries()]
    .map(([playerId, seq]): PlayerStreak => ({ playerId, streak: longestWinRun(seq) }))
    .sort((a, b) => b.streak - a.streak)[0];
  const topPlayerStreak =
    topPlayerStreakCandidate && topPlayerStreakCandidate.streak > 0 ? topPlayerStreakCandidate : null;

  const topTeamStreakCandidate = [...teamSequences.entries()]
    .map(([key, seq]): TeamStreak => {
      const [playerAId, playerBId] = key.split(":");
      return { playerAId, playerBId, streak: longestWinRun(seq) };
    })
    .sort((a, b) => b.streak - a.streak)[0];
  const topTeamStreak = topTeamStreakCandidate && topTeamStreakCandidate.streak > 0 ? topTeamStreakCandidate : null;

  const timesPlayedList = [...timesPlayed.entries()]
    .map(([playerId, count]) => ({ playerId, count }))
    .sort((a, b) => b.count - a.count);

  return {
    matchesCompleted: completed.length,
    topPlayer,
    topTeam,
    biggestBlowout,
    closestMatch,
    longestMatch,
    shortestMatch,
    topPlayerStreak,
    topTeamStreak,
    timesPlayed: timesPlayedList,
  };
}
