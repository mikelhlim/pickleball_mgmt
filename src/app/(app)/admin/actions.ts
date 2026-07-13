"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin, roleFromAppMetadata, type AppRole } from "@/lib/auth-role";

export async function deleteAllGameData() {
  const supabase = await createClient();
  await assertAdmin(supabase);

  // Supabase requires a filter on delete; this matches every row since no
  // real game day will ever have this id. game_day_players and matches
  // cascade via their foreign keys — players and venues are untouched.
  // scheduled_game_days rows cascade too, but only ones already promoted
  // into a game day being deleted here; still-upcoming scheduled sessions
  // have no game_days reference yet, so they're untouched.
  const { error } = await supabase
    .from("game_days")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);

  revalidatePath("/game-days");
  revalidatePath("/statistics");
  revalidatePath("/");
}

const NewUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export type CreateUserState = { error?: string; success?: boolean } | undefined;

export async function createAppUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const supabase = await createClient();
  try {
    await assertAdmin(supabase);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const parsed = NewUserSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  // Users added through this form only ever get view (read-only) access —
  // granting write access to a new account is a deliberate step an admin
  // takes directly in Supabase, not something this form offers.
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: "123456",
    email_confirm: true,
    app_metadata: { must_change_password: true, role: "viewer" satisfies AppRole },
  });

  if (error) {
    return {
      error: error.message.toLowerCase().includes("already")
        ? "A user with that email already exists."
        : error.message,
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function resetUserPassword(userId: string) {
  const supabase = await createClient();
  await assertAdmin(supabase);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: "123456",
    app_metadata: { must_change_password: true },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteAppUser(userId: string) {
  const supabase = await createClient();
  await assertAdmin(supabase);

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (currentUser?.id === userId) {
    throw new Error("You can't delete your own account while signed in.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export type AppUserSummary = {
  id: string;
  email: string;
  createdAt: string;
  mustChangePassword: boolean;
  role: AppRole;
};

export async function listAppUsers(): Promise<AppUserSummary[]> {
  const supabase = await createClient();
  await assertAdmin(supabase);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);

  return data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      createdAt: u.created_at,
      mustChangePassword: Boolean(u.app_metadata?.must_change_password),
      role: roleFromAppMetadata(u.app_metadata),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
