import { listAppUsers } from "./actions";
import { AddUserForm } from "@/components/admin/add-user-form";
import { UserRow } from "@/components/admin/user-row";
import { DeleteAllDialog } from "@/components/admin/delete-all-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireAdminPage } from "@/lib/auth-role";

// The admin client has no cookies() dependency to signal dynamic rendering
// on its own, but this page must never be statically prerendered — it calls
// the privileged service-role API for live, per-request user data.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  await requireAdminPage(supabase);

  const [users, {
    data: { user: currentUser },
  }] = await Promise.all([listAppUsers(), supabase.auth.getUser()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Administrative actions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Add a new user with the temporary password <strong>123456</strong> — they&apos;ll be required
            to set their own password the first time they sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddUserForm />
          <div className="space-y-1">
            {users.map((user) => (
              <UserRow key={user.id} user={user} isCurrentUser={user.id === currentUser?.id} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Delete All Game Data</CardTitle>
          <CardDescription>
            Permanently deletes every game day, roster, and match record. Registered players and venues
            are kept. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAllDialog />
        </CardContent>
      </Card>
    </div>
  );
}
