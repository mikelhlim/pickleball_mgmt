import "server-only";
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "viewer";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Accounts created before roles existed, and any user without an explicit
// role, are treated as admin — this is what keeps the app usable by whoever
// was already signed in when this feature shipped, without a data migration
// being strictly required for every deployment.
export function roleFromAppMetadata(appMetadata: Record<string, unknown> | undefined): AppRole {
  return appMetadata?.role === "viewer" ? "viewer" : "admin";
}

export async function getCurrentRole(supabase: SupabaseServerClient): Promise<AppRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return roleFromAppMetadata(user?.app_metadata);
}

// Server-action guard: throws so the caller sees a clear error instead of a
// generic RLS-violation message. This is defense in depth — RLS policies
// enforce the same restriction at the database layer independently, and the
// service-role actions (user management) have no RLS to fall back on at all,
// so this check is the only thing guarding those.
export async function assertAdmin(supabase: SupabaseServerClient): Promise<void> {
  const role = await getCurrentRole(supabase);
  if (role !== "admin") {
    throw new Error("Only admins can do this.");
  }
}

// Weaker sibling of assertAdmin: for actions any signed-in user (admin or
// viewer) may take — running a game day (create, roster, schedule,
// start/end matches) but not deleting one. Every page behind this app's
// proxy already requires auth, so in practice this mainly guards Server
// Actions invoked directly as untrusted POST endpoints.
export async function assertAuthenticated(supabase: SupabaseServerClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in to do this.");
  }
}

// Page guard: redirects a viewer away from an admin-only page entirely,
// rather than rendering it and hiding pieces of it.
export async function requireAdminPage(supabase: SupabaseServerClient): Promise<void> {
  const role = await getCurrentRole(supabase);
  if (role !== "admin") {
    redirect("/");
  }
}
