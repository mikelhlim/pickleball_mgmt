"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { GameDay, Match, Player, Venue } from "@/lib/types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StatsAnswer = {
  answer: string;
  inScope: boolean;
  table: { headers: string[]; rows: string[][] } | null;
};

const SYSTEM_PROMPT = `You are a statistics assistant embedded in a pickleball club management app. You answer natural-language questions about player, team, match, venue, and game-day statistics using ONLY the JSON data provided below in this system prompt.

Rules:
- Only answer questions about this app's statistics (players, teams, matches, scores, venues, game days, win/loss records, streaks, etc).
- If the question is unrelated to these statistics — general chat, advice, other topics, or a request to change or delete data — set "in_scope" to false and politely explain in "answer" that you can only help with statistics questions from this app.
- Never invent data that isn't in the JSON. If the data can't answer the question, say so in "answer".
- Be concise — a sentence or two of narrative in "answer". Put any row-based data (rankings, per-player or per-venue breakdowns, match lists) in "table", not inline in "answer".
- Dates are ISO 8601 (YYYY-MM-DD). Matches with status "pending" or "in_progress" have no score or winner yet; "cancelled" matches were never played.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Concise natural-language answer, 1-3 sentences." },
    in_scope: {
      type: "boolean",
      description: "False if the question was outside statistics scope and was declined.",
    },
    table: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            headers: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
          required: ["headers", "rows"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["answer", "in_scope", "table"],
  additionalProperties: false,
} as const;

export async function askStatsQuestion(question: string, history: ChatTurn[]): Promise<StatsAnswer> {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Ask a question first.");

  const supabase = await createClient();

  const [{ data: players }, { data: gameDays }, { data: matches }, { data: venues }] = await Promise.all([
    supabase.from("players").select("id, name, nickname"),
    supabase.from("game_days").select("id, session_date, status, venue_id, started_at, ended_at"),
    supabase
      .from("matches")
      .select(
        "game_day_id, match_number, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score, winner_team, started_at, ended_at, duration_seconds"
      ),
    supabase.from("venues").select("id, name, location"),
  ]);

  const nameById = new Map(
    ((players ?? []) as Pick<Player, "id" | "name" | "nickname">[]).map((p) => [p.id, p.nickname || p.name])
  );
  const venueById = new Map(((venues ?? []) as Pick<Venue, "id" | "name" | "location">[]).map((v) => [v.id, v]));
  const gameDayById = new Map(
    (
      (gameDays ?? []) as Pick<GameDay, "id" | "session_date" | "status" | "venue_id" | "started_at" | "ended_at">[]
    ).map((gd) => [gd.id, gd])
  );

  const dataset = {
    players: Array.from(nameById.values()),
    venues: ((venues ?? []) as Pick<Venue, "name" | "location">[]).map((v) => ({
      name: v.name,
      location: v.location,
    })),
    gameDays: Array.from(gameDayById.values()).map((gd) => ({
      date: gd.session_date,
      status: gd.status,
      venue: gd.venue_id ? (venueById.get(gd.venue_id)?.name ?? null) : null,
      startedAt: gd.started_at,
      endedAt: gd.ended_at,
    })),
    matches: (
      (matches ?? []) as Pick<
        Match,
        | "game_day_id"
        | "match_number"
        | "status"
        | "team1_player1_id"
        | "team1_player2_id"
        | "team2_player1_id"
        | "team2_player2_id"
        | "team1_score"
        | "team2_score"
        | "winner_team"
        | "started_at"
        | "ended_at"
        | "duration_seconds"
      >[]
    ).map((m) => {
      const gd = gameDayById.get(m.game_day_id);
      return {
        gameDayDate: gd?.session_date ?? null,
        venue: gd?.venue_id ? (venueById.get(gd.venue_id)?.name ?? null) : null,
        matchNumber: m.match_number,
        status: m.status,
        team1: [nameById.get(m.team1_player1_id ?? "") ?? null, nameById.get(m.team1_player2_id ?? "") ?? null],
        team2: [nameById.get(m.team2_player1_id ?? "") ?? null, nameById.get(m.team2_player2_id ?? "") ?? null],
        team1Score: m.team1_score,
        team2Score: m.team2_score,
        winnerTeam: m.winner_team,
        startedAt: m.started_at,
        endedAt: m.ended_at,
        durationSeconds: m.duration_seconds,
      };
    }),
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Statistics assistant isn't configured yet — an admin needs to add ANTHROPIC_API_KEY.");
  }
  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(dataset)}`,
      output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      messages: [...history.map((t) => ({ role: t.role, content: t.content })), { role: "user" as const, content: trimmed }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error("Statistics assistant isn't configured yet — an admin needs to add ANTHROPIC_API_KEY.");
    }
    throw new Error("Something went wrong asking the assistant. Please try again.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("The assistant didn't return an answer. Try again.");
  }

  const parsed = JSON.parse(textBlock.text) as { answer: string; in_scope: boolean; table: StatsAnswer["table"] };
  return { answer: parsed.answer, inScope: parsed.in_scope, table: parsed.table };
}
