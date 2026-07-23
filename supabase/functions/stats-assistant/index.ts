// Supabase Edge Function powering the iOS app's Stats Assistant.
//
// Ports src/app/(app)/statistics/actions.ts's `askStatsQuestion` verbatim
// (same system prompt, dataset shape, model, and JSON schema). The web app
// calls Anthropic directly from a Next.js Server Action using
// `process.env.ANTHROPIC_API_KEY`; a mobile app binary can't hold that key
// safely, so the iOS client instead calls this function (authenticated
// with the signed-in user's own JWT — Edge Functions verify JWTs by
// default, matching the "authenticated read" RLS posture used everywhere
// else in supabase/schema.sql) and this function holds the Anthropic key
// server-side as a Supabase secret instead.
//
// One-time setup (from the pickleball-app directory, with the Supabase CLI
// installed and linked to your project):
//   supabase functions deploy stats-assistant
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "jsr:@supabase/supabase-js@2";

const SYSTEM_PROMPT = `You are a statistics assistant embedded in a pickleball club management app. You answer natural-language questions about player, team, match, venue, and game-day statistics using ONLY the JSON data provided below in this system prompt.

Rules:
- Only answer questions about this app's statistics (players, teams, matches, scores, venues, game days, win/loss records, streaks, etc).
- If the question is unrelated to these statistics — general chat, advice, other topics, or a request to change or delete data — set "in_scope" to false and politely explain in "answer" that you can only help with statistics questions from this app.
- Never invent data that isn't in the JSON. If the data can't answer the question, say so in "answer".
- Be concise — a sentence or two of narrative in "answer". Put any row-based data (rankings, per-player or per-venue breakdowns, match lists) in "table", not inline in "answer".
- When the question asks for a list of matching items ("which matches...", "any pending...", "list..."), the table must include every matching row, not a sample — count what you list and make sure it matches any total you state in "answer". Every cell in a row must be filled in from the data; never leave a cell blank or emit a duplicate row.
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
};

type ChatTurn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let question: string;
  let history: ChatTurn[];
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
    history = Array.isArray(body.history) ? body.history : [];
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!question) return json({ error: "Ask a question first." }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

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

  const nameById = new Map((players ?? []).map((p) => [p.id, p.nickname || p.name]));
  const venueById = new Map((venues ?? []).map((v) => [v.id, v]));
  const gameDayById = new Map((gameDays ?? []).map((gd) => [gd.id, gd]));

  const dataset = {
    players: Array.from(nameById.values()),
    venues: (venues ?? []).map((v) => ({ name: v.name, location: v.location })),
    gameDays: Array.from(gameDayById.values()).map((gd) => ({
      date: gd.session_date,
      status: gd.status,
      venue: gd.venue_id ? (venueById.get(gd.venue_id)?.name ?? null) : null,
      startedAt: gd.started_at,
      endedAt: gd.ended_at,
    })),
    matches: (matches ?? []).map((m) => {
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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "Statistics assistant isn't configured yet — an admin needs to add ANTHROPIC_API_KEY." }, 500);
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(dataset)}`,
      output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      messages: [...history.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: question }],
    }),
  });

  if (anthropicResponse.status === 401) {
    return json({ error: "Statistics assistant isn't configured yet — an admin needs to add ANTHROPIC_API_KEY." }, 500);
  }
  if (!anthropicResponse.ok) {
    return json({ error: "Something went wrong asking the assistant. Please try again." }, 502);
  }

  const payload = await anthropicResponse.json();
  const textBlock = (payload.content ?? []).find((b: { type: string }) => b.type === "text");
  if (!textBlock) {
    return json({ error: "The assistant didn't return an answer. Try again." }, 502);
  }

  let parsed: { answer: string; in_scope: boolean; table: unknown };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return json({ error: "The answer was too long to complete. Try asking a narrower question." }, 502);
  }

  return json({ answer: parsed.answer, in_scope: parsed.in_scope, table: parsed.table }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
