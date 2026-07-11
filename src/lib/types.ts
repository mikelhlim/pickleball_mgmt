export type Player = {
  id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  created_at: string;
};

export type Venue = {
  id: string;
  name: string;
  created_at: string;
};

export type GameDayStatus = "setup" | "in_progress" | "completed";

export type GameDay = {
  id: string;
  session_date: string;
  num_matches: number;
  status: GameDayStatus;
  started_at: string | null;
  ended_at: string | null;
  venue_id: string | null;
  created_at: string;
};

export type MatchStatus = "pending" | "in_progress" | "completed";

export type Match = {
  id: string;
  game_day_id: string;
  match_number: number;
  team1_player1_id: string | null;
  team1_player2_id: string | null;
  team2_player1_id: string | null;
  team2_player2_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: 1 | 2 | null;
  status: MatchStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export type PlayerStats = {
  player_id: string;
  name: string;
  nickname: string | null;
  matches_played: number;
  wins: number;
  losses: number;
};

export type PartnershipStats = {
  player_a_id: string;
  player_b_id: string;
  matches_played: number;
  wins: number;
  losses: number;
};
