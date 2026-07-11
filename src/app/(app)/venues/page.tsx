import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth-role";
import { VenueDialog } from "@/components/venues/venue-dialog";
import { VenueCard } from "@/components/venues/venue-card";

export default async function VenuesPage() {
  const supabase = await createClient();
  const [{ data: venues }, role] = await Promise.all([
    supabase.from("venues").select("*").order("name"),
    getCurrentRole(supabase),
  ]);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Venues</h1>
          <p className="text-sm text-muted-foreground">Register and manage game venues.</p>
        </div>
        {isAdmin && <VenueDialog mode="create" />}
      </div>

      {venues && venues.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No venues yet. Add your first venue to get started.
        </p>
      )}
    </div>
  );
}
