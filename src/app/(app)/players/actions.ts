"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PlayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  nickname: z.string().trim().optional(),
});

export type PlayerFormState = { error?: string; success?: boolean } | undefined;

async function uploadPhotoIfProvided(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photo: FormDataEntryValue | null
): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null;

  const ext = photo.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("player-photos")
    .upload(path, photo, { contentType: photo.type || "image/jpeg" });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from("player-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function createPlayer(
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const parsed = PlayerSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();

  let photoUrl: string | null;
  try {
    photoUrl = await uploadPhotoIfProvided(supabase, formData.get("photo"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Photo upload failed." };
  }

  const { error } = await supabase.from("players").insert({
    name: parsed.data.name,
    nickname: parsed.data.nickname || null,
    photo_url: photoUrl,
  });
  if (error) return { error: error.message };

  revalidatePath("/players");
  return { success: true };
}

export async function updatePlayer(
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing player id." };

  const parsed = PlayerSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();

  let photoUrl: string | null = null;
  try {
    photoUrl = await uploadPhotoIfProvided(supabase, formData.get("photo"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Photo upload failed." };
  }

  const { error } = await supabase
    .from("players")
    .update({
      name: parsed.data.name,
      nickname: parsed.data.nickname || null,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/players");
  return { success: true };
}

export async function deletePlayer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/players");
}
