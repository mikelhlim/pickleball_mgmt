"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-role";

const GameDaySchema = z.object({
  session_date: z.string().min(1, "Date is required."),
  num_matches: z.coerce.number().int().min(1, "At least 1 match is required."),
  venue_id: z.string().uuid().optional().or(z.literal("")),
});

export type GameDayFormState = { error?: string } | undefined;

export async function createGameDay(
  _prev: GameDayFormState,
  formData: FormData
): Promise<GameDayFormState> {
  const parsed = GameDaySchema.safeParse({
    session_date: formData.get("session_date"),
    num_matches: formData.get("num_matches"),
    venue_id: formData.get("venue_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { data, error } = await supabase
    .from("game_days")
    .insert({
      session_date: parsed.data.session_date,
      num_matches: parsed.data.num_matches,
      venue_id: parsed.data.venue_id || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create game day." };

  revalidatePath("/game-days");
  redirect(`/game-days/${data.id}`);
}
