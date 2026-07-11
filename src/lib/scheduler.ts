export interface MatchAssignment {
  matchNumber: number;
  team1: [string, string];
  team2: [string, string];
  sittingOut: string[];
}

interface PlayerState {
  timesPlayed: number;
  playStreak: number; // consecutive matches just played
  sitStreak: number; // consecutive matches just sat out
  lastPlayedMatchIndex: number; // -1 = never played yet
  partneredWith: Set<string>; // everyone this player has already been teamed with
  benchedWith: Set<string>; // everyone this player has already sat out alongside
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

// Number of pairs within `group` that have already shared the given relation
// (partnered on a team, or benched together). Used to score how much a
// candidate group would repeat existing pairings vs. introduce fresh ones.
function repeatedPairs(group: string[], relation: (id: string) => Set<string>): number {
  let count = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (relation(group[i]).has(group[j])) count++;
    }
  }
  return count;
}

/**
 * Generates a doubles Order of Play for a game day session.
 *
 * Four rotation rules are applied on top of keeping teams fair and varied:
 *
 *   1. Sit-out cap for 7 players: with exactly 7 registered players, nobody
 *      may sit out more than 1 match in a row.
 *   2. Sit-out cap for everyone else: with any other player count, nobody may
 *      sit out more than 2 matches in a row.
 *   3. No repeated bench pair back-to-back: the same two players never sit
 *      out together in two consecutive matches (at most one player carries
 *      over from one match's bench to the next).
 *   4. Everyone benches with everyone: over the session each player should get
 *      to sit out alongside every other player, not always the same one or
 *      two — so bench company is spread around, mirroring how partners are.
 *
 * Rules 1–3 are hard constraints: candidate line-ups that would break them
 * are filtered out before selection, and are only ever allowed back in if no
 * line-up at all could satisfy them (a mathematically forced corner — see the
 * per-count notes below for when that can happen). Rule 4, like partner
 * freshness, is a strong best-effort preference used to rank the surviving
 * candidates rather than an absolute guarantee.
 *
 * On top of the sit-out rules the scheduler also keeps play fair and teams
 * fresh: no player plays more than 2 consecutive matches without a rest (3
 * for 6 players — see note); partners are kept fresh, aiming to have every
 * player team with every other before any partnership repeats (there are only
 * (n-1) possible partners per player, so repeats become unavoidable after
 * that); and playing time is balanced. Each match every valid foursome is
 * scored together with its best of 3 possible pairings, and the line-up is
 * chosen by priority: fewest repeated partnerships first, then freshest bench
 * company (rule 4), then most balanced playing time. Partner freshness leads
 * the ranking but still yields to the hard sit-out rules above — when those
 * constraints leave only line-ups that repeat a partnership, the freshest
 * available one is taken, so an early partner repeat is possible.
 *
 * Player-count notes:
 *   - n=4: everyone plays every match (nobody to rotate in), so no sit-out
 *     rule applies.
 *   - n=5: only one player sits out per match, so a "bench pair" never exists
 *     and rule 3 / rule 4 are vacuous; the play-streak rest rule also can't
 *     always hold (resting >1 player per 3 matches is impossible with a single
 *     seat), so it falls back to resting whoever has waited longest.
 *   - n=6: raises the play-streak cap to 3. At a cap of 2 the six players are
 *     mathematically forced into 3 fixed bench pairs, so nobody would ever
 *     bench with more than one other player — allowing an occasional 3rd
 *     straight match is what makes rule 4 reachable.
 *   - n=7 uses the tighter sit-out cap of 1 (rule 1); every other count uses 2.
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
  // Rules 1 & 2: 7 players get a tighter cap of 1 consecutive sit-out; every
  // other count allows up to 2.
  const sitOutCap = playerIds.length === 7 ? 1 : 2;
  // Play-streak cap (max consecutive matches on court before a forced rest).
  // Normally 2, but 6 players get 3: with 6 players any two back-to-back
  // matches share 2 players on court, so a cap of 2 would force those 2 to
  // rest together every time — locking the roster into 3 fixed bench pairs
  // (proven: full bench-company coverage is unreachable at cap 2). Allowing an
  // occasional 3rd straight match is the only way to satisfy rule 4 (everyone
  // benches with everyone) for 6 players.
  const playStreakCap = playerIds.length === 6 ? 3 : 2;

  const state = new Map<string, PlayerState>();
  for (const id of playerIds) {
    state.set(id, {
      timesPlayed: 0,
      playStreak: 0,
      sitStreak: 0,
      lastPlayedMatchIndex: -1,
      partneredWith: new Set(),
      benchedWith: new Set(),
    });
  }

  const partnersOf = (id: string) => state.get(id)!.partneredWith;
  const benchMatesOf = (id: string) => state.get(id)!.benchedWith;

  const byLongestWait = (a: string, b: string) => {
    const sa = state.get(a)!;
    const sb = state.get(b)!;
    if (sa.timesPlayed !== sb.timesPlayed) return sa.timesPlayed - sb.timesPlayed;
    return sa.lastPlayedMatchIndex - sb.lastPlayedMatchIndex;
  };

  // Of the 3 ways to split a foursome into two teams, the split that repeats
  // the fewest existing partnerships (freshest teams).
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
        partnerRepeats: pairing.filter(([a, b]) => partnersOf(a).has(b)).length,
      }))
      .sort((a, b) => a.partnerRepeats - b.partnerRepeats)[0];
  };

  const matches: MatchAssignment[] = [];
  let previousBench = new Set<string>();

  for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
    // Rest rule: a player who has hit the play-streak cap should sit unless
    // there aren't enough rested players to fill a court, in which case
    // everyone's back in the running.
    const restEligible = playerIds.filter((id) => state.get(id)!.playStreak < playStreakCap);
    const pool = everyoneMustPlay || restEligible.length < 4 ? playerIds : restEligible;

    // Rules 1 & 2: anyone who has hit the sit-out cap must play this match; if
    // more than a court's worth qualify at once, the longest-waiting go first.
    const forcedIn = pool
      .filter((id) => state.get(id)!.sitStreak >= sitOutCap)
      .sort(byLongestWait)
      .slice(0, 4);
    const fillers = pool.filter((id) => !forcedIn.includes(id));
    const slotsNeeded = 4 - forcedIn.length;

    // Every line-up we could field this match: the forced-in players plus each
    // way of filling the remaining seats, scored on all the rules at once.
    const lineups = shuffle(combinations(fillers, slotsNeeded), random).map((extra) => {
      const four = [...forcedIn, ...extra];
      const bench = playerIds.filter((id) => !four.includes(id));
      return {
        four,
        bench,
        // Rule 3: players sitting out again right after they just did. A pair
        // repeats on the bench only if 2+ carry over, so we keep this ≤ 1.
        benchCarryOver: bench.filter((id) => previousBench.has(id)).length,
        // Rule 4: bench pairs that have already sat out together this session.
        benchPairRepeats: repeatedPairs(bench, benchMatesOf),
        // Fair play: prefer resting players who've already played the most.
        playtimePenalty: extra.reduce((sum, id) => sum + state.get(id)!.timesPlayed, 0),
        ...bestPairingFor(four),
      };
    });

    // Rule 3 as a hard constraint: drop any line-up that would put the same
    // pair on the bench two matches running. Only relax it if literally no
    // line-up avoids it (shouldn't happen for supported counts, but never get
    // stuck).
    const rule3Ok = lineups.filter((l) => l.benchCarryOver <= 1);
    const candidates = rule3Ok.length > 0 ? rule3Ok : lineups;

    // Rank the survivors: freshest teams first (fewest repeated partnerships),
    // then freshest bench company (rule 4 — fewest bench pairs that have
    // already sat out together), then most balanced playing time. Partner
    // freshness leads because varied teams are the main draw; bench freshness
    // rides in as the tiebreak, which is enough to spread bench company across
    // the whole roster now that the play-streak cap (3 for six players) leaves
    // the rotation enough slack to actually choose different benches rather
    // than being forced into a fixed few.
    candidates.sort(
      (a, b) =>
        a.partnerRepeats - b.partnerRepeats ||
        a.benchPairRepeats - b.benchPairRepeats ||
        a.playtimePenalty - b.playtimePenalty
    );

    const { four: chosen, pairing, bench } = candidates[0];
    const [team1, team2] = pairing;

    matches.push({ matchNumber: matchIndex + 1, team1, team2, sittingOut: bench });
    previousBench = new Set(bench);

    // Record who benched with whom (rule 4 bookkeeping).
    for (let i = 0; i < bench.length; i++) {
      for (let j = i + 1; j < bench.length; j++) {
        state.get(bench[i])!.benchedWith.add(bench[j]);
        state.get(bench[j])!.benchedWith.add(bench[i]);
      }
    }

    // Advance each player's streaks / partnerships for the match just fielded.
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
