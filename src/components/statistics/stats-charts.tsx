"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerStats } from "@/lib/types";

export function StatsCharts({ playerStats }: { playerStats: PlayerStats[] }) {
  const data = playerStats
    .filter((p) => p.matches_played > 0)
    .sort((a, b) => b.matches_played - a.matches_played)
    .map((p) => ({
      name: p.nickname || p.name,
      Wins: p.wins,
      Losses: p.losses,
    }));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed matches yet.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Wins" stackId="record" fill="var(--chart-1)" radius={[0, 0, 4, 4]} />
          <Bar dataKey="Losses" stackId="record" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
