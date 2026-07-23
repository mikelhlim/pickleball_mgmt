import { describe, expect, it } from "vitest";
import { computeGameDayHighlights } from "./game-day-highlights";
import type { Match } from "./types";

let nextId = 1;
function makeMatch(overrides: Partial<Match> = {}): Match {
  const n = nextId++;
  return {
    id: `match-${n}`,
    game_day_id: "gd-1",
    match_number: n,
    team1_player1_id: "p1",
    team1_player2_id: "p2",
    team2_player1_id: "p3",
    team2_player2_id: "p4",
    team1_score: 11,
    team2_score: 5,
    winner_team: 1,
    status: "completed",
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    is_ad_hoc: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeGameDayHighlights", () => {
  it("returns an all-empty result for no matches", () => {
    const result = computeGameDayHighlights([], ["p1", "p2"]);
    expect(result.matchesCompleted).toBe(0);
    expect(result.topPlayer).toBeNull();
    expect(result.topTeam).toBeNull();
    expect(result.biggestBlowout).toBeNull();
    expect(result.closestMatch).toBeNull();
    expect(result.longestMatch).toBeNull();
    expect(result.shortestMatch).toBeNull();
    expect(result.topPlayerStreak).toBeNull();
    expect(result.topTeamStreak).toBeNull();
    expect(result.timesPlayed).toEqual([
      { playerId: "p1", count: 0 },
      { playerId: "p2", count: 0 },
    ]);
  });

  it("ignores matches that are not completed or have no scores yet", () => {
    const matches = [
      makeMatch({ status: "pending", team1_score: null, team2_score: null, winner_team: null }),
      makeMatch({ status: "in_progress", team1_score: null, team2_score: null, winner_team: null }),
      makeMatch({ status: "cancelled" }),
    ];
    const result = computeGameDayHighlights(matches, ["p1", "p2", "p3", "p4"]);
    expect(result.matchesCompleted).toBe(0);
    expect(result.timesPlayed.every((t) => t.count === 0)).toBe(true);
  });

  it("counts matches played and ranks the top player by win % then wins", () => {
    // p1 goes 2-0 (100%), p3 goes 1-2 (33%) across two matches vs different opponents.
    const matches = [
      makeMatch({
        match_number: 1,
        team1_player1_id: "p1",
        team1_player2_id: "p2",
        team2_player1_id: "p3",
        team2_player2_id: "p4",
        winner_team: 1,
      }),
      makeMatch({
        match_number: 2,
        team1_player1_id: "p1",
        team1_player2_id: "p5",
        team2_player1_id: "p3",
        team2_player2_id: "p4",
        winner_team: 1,
      }),
    ];
    const result = computeGameDayHighlights(matches, ["p1", "p2", "p3", "p4", "p5"]);
    expect(result.matchesCompleted).toBe(2);
    expect(result.topPlayer).toEqual({ playerId: "p1", wins: 2, losses: 0, matchesPlayed: 2, winPct: 1 });
    expect(result.timesPlayed).toEqual(
      expect.arrayContaining([
        { playerId: "p1", count: 2 },
        { playerId: "p3", count: 2 },
        { playerId: "p2", count: 1 },
      ])
    );
  });

  it("ranks the top team (partnership) the same way as the top player", () => {
    const matches = [
      makeMatch({ match_number: 1, winner_team: 1 }), // p1+p2 beat p3+p4
      makeMatch({ match_number: 2, winner_team: 1 }), // p1+p2 beat p3+p4 again
    ];
    const result = computeGameDayHighlights(matches, ["p1", "p2", "p3", "p4"]);
    expect(result.topTeam).toEqual({
      playerAId: "p1",
      playerBId: "p2",
      wins: 2,
      losses: 0,
      matchesPlayed: 2,
      winPct: 1,
    });
  });

  it("picks the biggest blowout and closest match by score margin", () => {
    const blowout = makeMatch({ match_number: 1, team1_score: 11, team2_score: 1 }); // margin 10
    const close = makeMatch({ match_number: 2, team1_score: 11, team2_score: 10 }); // margin 1
    const middle = makeMatch({ match_number: 3, team1_score: 11, team2_score: 6 }); // margin 5
    const result = computeGameDayHighlights([blowout, close, middle], []);
    expect(result.biggestBlowout).toEqual({ match: blowout, margin: 10 });
    expect(result.closestMatch).toEqual({ match: close, margin: 1 });
  });

  it("picks the longest and shortest match by duration, ignoring matches with no duration recorded", () => {
    const noDuration = makeMatch({ match_number: 1, duration_seconds: null });
    const short = makeMatch({ match_number: 2, duration_seconds: 300 });
    const long = makeMatch({ match_number: 3, duration_seconds: 900 });
    const result = computeGameDayHighlights([noDuration, short, long], []);
    expect(result.longestMatch).toEqual({ match: long, durationSeconds: 900 });
    expect(result.shortestMatch).toEqual({ match: short, durationSeconds: 300 });
  });

  it("finds the longest consecutive win streak, not just total wins", () => {
    // p1 plays every match with a fresh one-off partner each time (so no
    // partner accumulates enough matches to tie p1's streak): W, L, W, W, W
    // in match_number order -> longest run is 3, not the 4 total wins.
    const matches = [
      makeMatch({ match_number: 1, team1_player1_id: "p1", team1_player2_id: "p2", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
      makeMatch({ match_number: 2, team1_player1_id: "p1", team1_player2_id: "p3", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 2 }),
      makeMatch({ match_number: 3, team1_player1_id: "p1", team1_player2_id: "p4", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
      makeMatch({ match_number: 4, team1_player1_id: "p1", team1_player2_id: "p5", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
      makeMatch({ match_number: 5, team1_player1_id: "p1", team1_player2_id: "p6", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
    ];
    const result = computeGameDayHighlights(matches, ["p1"]);
    expect(result.topPlayerStreak).toEqual({ playerId: "p1", streak: 3 });
  });

  it("does not let a skipped match break a player's win streak", () => {
    // p1 plays m1, m2, m4 (all wins, each with a fresh partner) and sits out
    // m3 entirely. p1's own sequence is [W,W,W] with streak 3 — the match
    // p1 didn't play must not appear as a gap/loss in their personal streak.
    const matches = [
      makeMatch({ match_number: 1, team1_player1_id: "p1", team1_player2_id: "p2", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
      makeMatch({ match_number: 2, team1_player1_id: "p1", team1_player2_id: "p3", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
      makeMatch({ match_number: 3, team1_player1_id: "p5", team1_player2_id: "p6", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 2 }),
      makeMatch({ match_number: 4, team1_player1_id: "p1", team1_player2_id: "p4", team2_player1_id: "p10", team2_player2_id: "p11", winner_team: 1 }),
    ];
    const result = computeGameDayHighlights(matches, ["p1"]);
    expect(result.topPlayerStreak).toEqual({ playerId: "p1", streak: 3 });
  });

  it("finds the longest consecutive win streak for a team (partnership)", () => {
    const matches = [
      makeMatch({ match_number: 1, winner_team: 1 }), // p1+p2 win
      makeMatch({ match_number: 2, winner_team: 2 }), // p1+p2 lose
      makeMatch({ match_number: 3, winner_team: 1 }), // p1+p2 win
      makeMatch({ match_number: 4, winner_team: 1 }), // p1+p2 win
    ];
    const result = computeGameDayHighlights(matches, ["p1", "p2", "p3", "p4"]);
    expect(result.topTeamStreak).toEqual({ playerAId: "p1", playerBId: "p2", streak: 2 });
  });

  it("keeps a roster player with zero completed matches in timesPlayed", () => {
    const matches = [makeMatch()];
    const result = computeGameDayHighlights(matches, ["p1", "p2", "p3", "p4", "benched"]);
    expect(result.timesPlayed).toEqual(
      expect.arrayContaining([{ playerId: "benched", count: 0 }])
    );
  });

  it("still counts a completed match with no winner_team toward matchesCompleted/timesPlayed but not win/loss records", () => {
    const match = makeMatch({ winner_team: null });
    const result = computeGameDayHighlights([match], ["p1", "p2", "p3", "p4"]);
    expect(result.matchesCompleted).toBe(1);
    expect(result.timesPlayed.find((t) => t.playerId === "p1")?.count).toBe(1);
    expect(result.topPlayer).toBeNull();
    expect(result.topTeam).toBeNull();
  });
});
