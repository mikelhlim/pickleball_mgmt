"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-role";

const VenueSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required."),
  location: z.string().trim().nullable().optional(),
  contact_number: z.string().trim().nullable().optional(),
  // Bare domains ("example.com") are common input — treat them as https
  // rather than rejecting them.
  url: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val, ctx) => {
      if (!val) return null;
      const withProtocol = /^https?:\/\//i.test(val) ? val : `https://${val}`;
      if (!z.string().url().safeParse(withProtocol).success) {
        ctx.addIssue({ code: "custom", message: "Enter a valid venue website URL." });
        return z.NEVER;
      }
      return withProtocol;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .nullable()
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success, "Enter a valid venue email address."),
});

export type VenueFormState =
  | { error?: string; success?: boolean; venue?: { id: string; name: string } }
  | undefined;

export async function createVenue(
  _prev: VenueFormState,
  formData: FormData
): Promise<VenueFormState> {
  const parsed = VenueSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    contact_number: formData.get("contact_number"),
    url: formData.get("url"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: parsed.data.name,
      location: parsed.data.location || null,
      contact_number: parsed.data.contact_number || null,
      url: parsed.data.url,
      email: parsed.data.email || null,
    })
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

  const parsed = VenueSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    contact_number: formData.get("contact_number"),
    url: formData.get("url"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const { error } = await supabase
    .from("venues")
    .update({
      name: parsed.data.name,
      location: parsed.data.location || null,
      contact_number: parsed.data.contact_number || null,
      url: parsed.data.url,
      email: parsed.data.email || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/venues");
  revalidatePath("/game-days");
  return { success: true };
}

export async function deleteVenue(id: string) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const { error } = await supabase.from("venues").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/venues");
  revalidatePath("/game-days");
}
