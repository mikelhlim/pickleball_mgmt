"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const VenueSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required."),
});

export type VenueFormState =
  | { error?: string; success?: boolean; venue?: { id: string; name: string } }
  | undefined;

export async function createVenue(
  _prev: VenueFormState,
  formData: FormData
): Promise<VenueFormState> {
  const parsed = VenueSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({ name: parsed.data.name })
    .select("id, name")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to add venue." };

  revalidatePath("/venues");
  revalidatePath("/game-days");
  return { success: true, venue: { id: data.id, name: data.name } };
}

export async function updateVenue(
  _prev: VenueFormState,
  formData: FormData
): Promise<VenueFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing venue id." };

  const parsed = VenueSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("venues").update({ name: parsed.data.name }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/venues");
  revalidatePath("/game-days");
  return { success: true };
}

export async function deleteVenue(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("venues").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/venues");
  revalidatePath("/game-days");
}
