export interface MatchAssignment {
  matchNumber: number;
  team1: [string, string];
  team2: [string, string];
  sittingOut: string[];
}

interface PlayerRotationState {
  timesPlayed: number;
  playStreak: number; // consecutive matches just played
  sitStreak: number; // consecutive matches just sat out
  lastPlayedMatchIndex: number; // -1 = never played yet
  partneredWith: Set<string>; // everyone this player has already been teamed with
}

// Deterministic PRNG (mulberry32) so a given seed always reproduces the same
// schedule — lets "regenerate" just mean "call again with a fresh seed".
function mulberry32(seed: number) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  return [...withFirst, ...combinations(rest, k)];
}

/**
 * Generates a doubles Order of Play for a game day session.
 *
 * Rules enforced: every player partners with every other player at least
 * once (keeping partners fresh) before anyone repeats a partner — this also
 * naturally minimizes the same foursome landing on court together twice; no
 * player plays more than 2 consecutive matches without a rest; and —
 * symmetrically — no player sits out more than 2 consecutive matches without
 * playing (tightened to just 1 consecutive sit-out for 6-7 players, where
 * there's enough rotation slack to enforce it without side effects — see
 * below for why 8+ keeps the looser cap of 2). When there are exactly 4
 * registered players, everyone must play every match (there's nobody to
 * rotate in), so neither rest rule can apply.
 *
 * Each match, every valid group of 4 (respecting the rest/forced-in rules
 * below) is considered together with its best of 3 possible pairings, and
 * the scheduler picks whichever group+pairing repeats the fewest existing
 * partnerships — ties broken in favor of players who've played the least so
 * far. Selecting who plays and how they're paired jointly, rather than
 * fixing the foursome first, is what lets a pair that's never played
 * together get pulled onto the court together even if the "usual" rotation
 * order wouldn't have put them there.
 *
 * Partner freshness has a hard mathematical ceiling: with n players, each
 * has only (n-1) possible partners, so once every pair has played together
 * once (after roughly (n-1) matches' worth of rotation), further matches
 * must start repeating someone — the scheduler falls back to whichever
 * repeat has gone the longest without happening again. This is a per-match
 * greedy search (evaluating every valid foursome+pairing each match), not a
 * full lookahead across the whole session, so it's a strong best effort
 * rather than a mathematical guarantee — for larger rosters, exactly how
 * much of the roster has partnered up before the first unavoidable repeat
 * can vary with the random seed.
 *
 * With exactly 5 players only one player can sit out per match, so keeping
 * every player's play-streak under 3 would require resting more than one
 * player every 3 matches on average — mathematically impossible. In that
 * one under-capacity case the scheduler falls back to picking whoever has
 * waited longest, which is the fairest achievable rotation; the sit-streak
 * cap stays enforceable even then, since only one seat needs freeing up.
 */
export function generateOrderOfPlay(
  playerIds: string[],
  numMatches: number,
  seed: number = Date.now()
): MatchAssignment[] {
  if (playerIds.length < 4) {
    throw new Error("At least 4 players are required to generate an Order of Play.");
  }
  if (numMatches < 1) {
    throw new Error("At least 1 match is required.");
  }

  const random = mulberry32(seed);
  const everyoneMustPlay = playerIds.length === 4;
  // With 6 or 7 players there's still enough slack in the rotation to ban a
  // 2nd consecutive sit-out outright. From 8 players up, exactly 4 sit out
  // each match — banning a 2nd consecutive sit-out would force all 4 of
  // them straight back in with zero slots left to choose from, locking the
  // roster into two fixed groups of 4 that alternate forever and never
  // partner with each other. So 8+ keeps the looser (still enforced) cap of
  // 2 to preserve partner freshness across the whole roster.
  const sitStreakCap = playerIds.length === 6 || playerIds.length === 7 ? 1 : 2;

  const state = new Map<string, PlayerRotationState>();
  for (const id of playerIds) {
    state.set(id, {
      timesPlayed: 0,
      playStreak: 0,
      sitStreak: 0,
      lastPlayedMatchIndex: -1,
      partneredWith: new Set(),
    });
  }

  const byLongestWait = (a: string, b: string) => {
    const sa = state.get(a)!;
    const sb = state.get(b)!;
    if (sa.timesPlayed !== sb.timesPlayed) return sa.timesPlayed - sb.timesPlayed;
    return sa.lastPlayedMatchIndex - sb.lastPlayedMatchIndex;
  };

  const matches: MatchAssignment[] = [];

  for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
    const restEligible = playerIds.filter((id) => state.get(id)!.playStreak < 2);
    const pool = everyoneMustPlay || restEligible.length < 4 ? playerIds : restEligible;

    // Anyone who has hit the sit-streak cap must play this match; if more
    // than 4 qualify at once (only possible with a large enough roster
    // relative to numMatches), the longest-waiting ones take priority.
    const forcedIn = pool
      .filter((id) => state.get(id)!.sitStreak >= sitStreakCap)
      .sort(byLongestWait)
      .slice(0, 4);
    const candidates = pool.filter((id) => !forcedIn.includes(id));
    const slotsNeeded = 4 - forcedIn.length;

    const alreadyPartnered = (a: string, b: string) => state.get(a)!.partneredWith.has(b);
    const bestPairingFor = (four: string[]) => {
      const [p0, p1, p2, p3] = four;
      const candidatePairings: [[string, string], [string, string]][] = [
        [[p0, p1], [p2, p3]],
        [[p0, p2], [p1, p3]],
        [[p0, p3], [p1, p2]],
      ];
      return shuffle(candidatePairings, random)
        .map((pairing) => ({
          pairing,
          repeatCount: pairing.filter(([a, b]) => alreadyPartnered(a, b)).length,
        }))
        .sort((a, b) => a.repeatCount - b.repeatCount)[0];
    };

    const groupOptions = shuffle(combinations(candidates, slotsNeeded), random)
      .map((extra) => {
        const four = [...forcedIn, ...extra];
        const fairnessPenalty = extra.reduce((sum, id) => sum + state.get(id)!.timesPlayed, 0);
        return { four, fairnessPenalty, ...bestPairingFor(four) };
      })
      .sort((a, b) => a.repeatCount - b.repeatCount || a.fairnessPenalty - b.fairnessPenalty);

    const { four: chosen, pairing } = groupOptions[0];
    const [team1, team2] = pairing;
    const sittingOut = playerIds.filter((id) => !chosen.includes(id));

    matches.push({ matchNumber: matchIndex + 1, team1, team2, sittingOut });

    for (const id of playerIds) {
      const s = state.get(id)!;
      if (chosen.includes(id)) {
        const team = team1.includes(id) ? team1 : team2;
        const partner = team[0] === id ? team[1] : team[0];
        s.timesPlayed += 1;
        s.playStreak += 1;
        s.sitStreak = 0;
        s.lastPlayedMatchIndex = matchIndex;
        s.partneredWith.add(partner);
      } else {
        s.playStreak = 0;
        s.sitStreak += 1;
      }
    }
  }

  return matches;
}
