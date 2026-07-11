import { createClient } from "@/lib/supabase/server";
import { VenueDialog } from "@/components/venues/venue-dialog";
import { VenueCard } from "@/components/venues/venue-card";
import type { Venue } from "@/lib/types";

export default async function VenuesPage() {
  const supabase = await createClient();
  const { data: venues } = (await supabase.from("venues").select("*").order("name")) as {
    data: Venue[] | null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
          <p className="text-sm text-muted-foreground">Register and manage game venues.</p>
        </div>
        <VenueDialog mode="create" />
      </div>

      {venues && venues.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
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
