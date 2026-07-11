import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth-role";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const role = await getCurrentRole(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav isAdmin={role === "admin"} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 md:pb-6">{children}</main>
    </div>
  );
}
