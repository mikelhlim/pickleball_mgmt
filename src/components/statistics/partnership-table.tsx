"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PartnershipStats } from "@/lib/types";

type SortField = "pairing" | "matches_played" | "wins" | "losses" | "win_pct";

const columns: { field: SortField; label: string; align: "left" | "right" }[] = [
  { field: "pairing", label: "Pairing", align: "left" },
  { field: "matches_played", label: "Played", align: "right" },
  { field: "wins", label: "Wins", align: "right" },
  { field: "losses", label: "Losses", align: "right" },
  { field: "win_pct", label: "Win %", align: "right" },
];

export function PartnershipTable({
  partnerships,
  nameById,
}: {
  partnerships: PartnershipStats[];
  nameById: Map<string, string>;
}) {
  const [sortField, setSortField] = useState<SortField>("matches_played");
  const [sortDesc, setSortDesc] = useState(true);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDesc((d) => !d);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  }

  const rows = useMemo(() => {
    const withNames = partnerships
      .filter((p) => p.matches_played > 0)
      .map((p) => ({
        ...p,
        pairing: `${nameById.get(p.player_a_id) ?? "Unknown"} & ${nameById.get(p.player_b_id) ?? "Unknown"}`,
        win_pct: p.matches_played > 0 ? p.wins / p.matches_played : 0,
      }));

    const sorted = withNames.sort((a, b) => {
      if (sortField === "pairing") return a.pairing.localeCompare(b.pairing);
      return a[sortField] - b[sortField];
    });
    if (sortDesc) sorted.reverse();
    return sorted;
  }, [partnerships, nameById, sortField, sortDesc]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed matches yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.field} className={col.align === "right" ? "text-right" : ""}>
              <button
                type="button"
                onClick={() => toggleSort(col.field)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {col.label}
                {sortField === col.field ? (
                  sortDesc ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )
                ) : (
                  <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                )}
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.player_a_id}-${row.player_b_id}`}>
            <TableCell className="font-medium">{row.pairing}</TableCell>
            <TableCell className="text-right tabular-nums">{row.matches_played}</TableCell>
            <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
            <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
            <TableCell className="text-right tabular-nums">{Math.round(row.win_pct * 100)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
