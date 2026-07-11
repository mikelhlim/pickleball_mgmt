import { describe, expect, it } from "vitest";
import { generateOrderOfPlay, type MatchAssignment } from "./scheduler";

function playersOf(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

function assertStructurallyValid(matches: MatchAssignment[], playerIds: string[]) {
  for (const match of matches) {
    const onCourt = [...match.team1, ...match.team2];
    expect(new Set(onCourt).size).toBe(4);
    expect(new Set([...onCourt, ...match.sittingOut]).size).toBe(playerIds.length);
    expect(onCourt.length + match.sittingOut.length).toBe(playerIds.length);
    for (const id of onCourt) expect(playerIds).toContain(id);
  }
}

/**
 * Independently replays the output (without relying on the algorithm's
 * internals) to verify the greedy "keep partners fresh" rule: for every
 * match, among the 3 ways the 4 on-court players could have been split into
 * teams, the pairing actually chosen must have the fewest already-happened
 * partnerships (0 whenever a fully-fresh split was available).
 */
function assertPartnersKeptFreshGreedily(matches: MatchAssignment[]) {
  const partneredWith = new Map<string, Set<string>>();
  const partnersOf = (id: string) => partneredWith.get(id) ?? new Set<string>();

  for (const match of matches) {
    const [p0, p1, p2, p3] = [...match.team1, ...match.team2];
    const candidatePairings: [[string, string], [string, string]][] = [
      [[p0, p1], [p2, p3]],
      [[p0, p2], [p1, p3]],
      [[p0, p3], [p1, p2]],
    ];
    const repeatCount = (pairing: [[string, string], [string, string]]) =>
      pairing.filter(([a, b]) => partnersOf(a).has(b)).length;

    const bestPossible = Math.min(...candidatePairings.map(repeatCount));
    const actualPairing: [[string, string], [string, string]] = [match.team1, match.team2];
    expect(repeatCount(actualPairing)).toBe(bestPossible);

    for (const [a, b] of [match.team1, match.team2]) {
      if (!partneredWith.has(a)) partneredWith.set(a, new Set());
      if (!partneredWith.has(b)) partneredWith.set(b, new Set());
      partneredWith.get(a)!.add(b);
      partneredWith.get(b)!.add(a);
    }
  }
}

/**
 * Stronger, whole-session invariant: with n players there are only
 * n*(n-1)/2 possible partnerships, so no pair should ever repeat until
 * every other pair has partnered at least once. This catches bugs where the
 * pairing step is locally optimal for whichever foursome got selected, but
 * the foursome-selection step itself ignored partner freshness and kept
 * bringing the same players back together.
 */
function assertNoRepeatBeforeFullPartnerCoverage(matches: MatchAssignment[], playerIds: string[]) {
  const totalPairs = (playerIds.length * (playerIds.length - 1)) / 2;
  const seen = new Set<string>();
  for (const match of matches) {
    for (const [a, b] of [match.team1, match.team2]) {
      const key = [a, b].sort().join("-");
      if (seen.has(key)) {
        expect(seen.size).toBe(totalPairs);
      } else {
        seen.add(key);
      }
    }
  }
}

function maxConsecutiveStreak(matches: MatchAssignment[], playerId: string): number {
  let max = 0;
  let current = 0;
  for (const match of matches) {
    const played = [...match.team1, ...match.team2].includes(playerId);
    current = played ? current + 1 : 0;
    max = Math.max(max, current);
  }
  return max;
}

function maxConsecutiveSitOut(matches: MatchAssignment[], playerId: string): number {
  let max = 0;
  let current = 0;
  for (const match of matches) {
    const satOut = match.sittingOut.includes(playerId);
    current = satOut ? current + 1 : 0;
    max = Math.max(max, current);
  }
  return max;
}

describe("generateOrderOfPlay", () => {
  it("throws with fewer than 4 players", () => {
    expect(() => generateOrderOfPlay(playersOf(3), 3, 1)).toThrow();
  });

  it("throws with zero matches requested", () => {
    expect(() => generateOrderOfPlay(playersOf(4), 0, 1)).toThrow();
  });

  it("n=4: every player is on court every match (no one to rotate in)", () => {
    const players = playersOf(4);
    const matches = generateOrderOfPlay(players, 6, 42);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    for (const match of matches) expect(match.sittingOut).toHaveLength(0);
  });

  it("n=4: exhausts all 3 possible pairings before any partner repeats", () => {
    const players = playersOf(4);
    const matches = generateOrderOfPlay(players, 3, 7);
    const pairingKeys = matches.map((m) =>
      [...m.team1].sort().join("-") + " vs " + [...m.team2].sort().join("-")
    );
    expect(new Set(pairingKeys).size).toBe(3);
  });

  it("n=5: structurally valid and partner rule holds (play-streak rest rule is not always achievable, but sit-streak still is)", () => {
    const players = playersOf(5);
    const matches = generateOrderOfPlay(players, 10, 7);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    for (const match of matches) expect(match.sittingOut).toHaveLength(1);
    for (const id of players) {
      expect(maxConsecutiveSitOut(matches, id)).toBeLessThanOrEqual(2);
    }
  });

  it("n=8: no player plays more than 2 consecutive matches, and rotation is fair", () => {
    const players = playersOf(8);
    const matches = generateOrderOfPlay(players, 20, 99);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    for (const match of matches) expect(match.sittingOut).toHaveLength(4);
    for (const id of players) {
      expect(maxConsecutiveStreak(matches, id)).toBeLessThanOrEqual(2);
      expect(maxConsecutiveSitOut(matches, id)).toBeLessThanOrEqual(2);
    }
    const timesPlayed = players.map(
      (id) => matches.filter((m) => [...m.team1, ...m.team2].includes(id)).length
    );
    expect(Math.max(...timesPlayed) - Math.min(...timesPlayed)).toBeLessThanOrEqual(1);
  });

  it("large session (many matches) stays valid throughout, with 6 players banning any 2nd consecutive sit-out", () => {
    const players = playersOf(6);
    const matches = generateOrderOfPlay(players, 50, 123);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    for (const id of players) {
      expect(maxConsecutiveStreak(matches, id)).toBeLessThanOrEqual(2);
      expect(maxConsecutiveSitOut(matches, id)).toBeLessThanOrEqual(1);
    }
  });

  it("n=7, 12 matches: no pair repeats until every other pair has partnered once, and no one sits out twice in a row (regression: foursome selection must consider partner freshness, not just whoever's next in the rest rotation)", () => {
    const players = playersOf(7);
    const matches = generateOrderOfPlay(players, 12, 5);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    assertNoRepeatBeforeFullPartnerCoverage(matches, players);
    for (const id of players) {
      expect(maxConsecutiveStreak(matches, id)).toBeLessThanOrEqual(2);
      expect(maxConsecutiveSitOut(matches, id)).toBeLessThanOrEqual(1);
    }
  });

  it("n=8: sit-streak cap stays at 2 (not tightened to 1) to avoid locking the roster into two fixed groups that never cross-partner", () => {
    const players = playersOf(8);
    const matches = generateOrderOfPlay(players, 20, 42);
    assertStructurallyValid(matches, players);
    assertPartnersKeptFreshGreedily(matches);
    for (const id of players) {
      expect(maxConsecutiveSitOut(matches, id)).toBeLessThanOrEqual(2);
    }
    // If the roster had locked into two fixed groups of 4, each player would
    // only ever appear alongside the same 3 teammates across every match —
    // confirm each player shares the court with more than just 3 others.
    for (const id of players) {
      const courtmates = new Set<string>();
      for (const match of matches) {
        const onCourt = [...match.team1, ...match.team2];
        if (onCourt.includes(id)) for (const other of onCourt) if (other !== id) courtmates.add(other);
      }
      expect(courtmates.size).toBeGreaterThan(3);
    }
  });

  it("is deterministic for a given seed and varies across seeds (regenerate)", () => {
    const players = playersOf(8);
    const a = generateOrderOfPlay(players, 5, 555);
    const b = generateOrderOfPlay(players, 5, 555);
    const c = generateOrderOfPlay(players, 5, 556);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
