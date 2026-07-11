import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PartnershipStats } from "@/lib/types";

export function PartnershipTable({
  partnerships,
  nameById,
}: {
  partnerships: PartnershipStats[];
  nameById: Map<string, string>;
}) {
  const rows = partnerships
    .filter((p) => p.matches_played > 0)
    .sort((a, b) => b.matches_played - a.matches_played);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed matches yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pairing</TableHead>
          <TableHead className="text-right">Played</TableHead>
          <TableHead className="text-right">Wins</TableHead>
          <TableHead className="text-right">Losses</TableHead>
          <TableHead className="text-right">Win %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const nameA = nameById.get(row.player_a_id) ?? "Unknown";
          const nameB = nameById.get(row.player_b_id) ?? "Unknown";
          const winPct = row.matches_played > 0 ? Math.round((row.wins / row.matches_played) * 100) : 0;
          return (
            <TableRow key={`${row.player_a_id}-${row.player_b_id}`}>
              <TableCell className="font-medium">
                {nameA} & {nameB}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.matches_played}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
              <TableCell className="text-right tabular-nums">{winPct}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
