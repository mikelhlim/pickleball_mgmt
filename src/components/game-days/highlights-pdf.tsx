import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { formatHoursMinutes } from "@/lib/format";
import type { GameDayHighlights } from "@/lib/game-day-highlights";
import type { GameDay, Match, Player, Venue } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#555555", marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginTop: 18, marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#dddddd", marginBottom: 12 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  statLabel: { fontSize: 11, color: "#555555" },
  statValue: { fontSize: 11, fontWeight: "bold", textAlign: "right", maxWidth: 320 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tableName: { flex: 1, fontSize: 10 },
  tableCount: { width: 80, fontSize: 10, textAlign: "right" },
  tableHeaderText: { fontSize: 9, fontWeight: "bold", color: "#555555", textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#999999" },
});

function nameOf(playersById: Map<string, Player>, playerId: string): string {
  const p = playersById.get(playerId);
  return p ? p.nickname || p.name : "Unknown player";
}

function teamNameOf(playersById: Map<string, Player>, aId: string, bId: string): string {
  return `${nameOf(playersById, aId)} & ${nameOf(playersById, bId)}`;
}

function matchTeamsLabel(playersById: Map<string, Player>, match: Match): string {
  const team1 = [match.team1_player1_id, match.team1_player2_id].filter((v): v is string => Boolean(v));
  const team2 = [match.team2_player1_id, match.team2_player2_id].filter((v): v is string => Boolean(v));
  const label1 = team1.map((id) => nameOf(playersById, id)).join(" & ") || "Unknown";
  const label2 = team2.map((id) => nameOf(playersById, id)).join(" & ") || "Unknown";
  return `${label1} vs ${label2} (${match.team1_score}–${match.team2_score})`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function GameDayHighlightsDocument({
  gameDay,
  venue,
  highlights,
  playersById,
}: {
  gameDay: GameDay;
  venue: Venue | null;
  highlights: GameDayHighlights;
  playersById: Map<string, Player>;
}) {
  const dateLabel = format(parseISO(gameDay.session_date), "EEEE, MMMM d, yyyy");

  return (
    <Document title={`Game Day Highlights — ${dateLabel}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Game Day Highlights</Text>
        <Text style={styles.subtitle}>
          {dateLabel}
          {venue ? ` · ${venue.name}` : ""} · {highlights.matchesCompleted} match
          {highlights.matchesCompleted === 1 ? "" : "es"} completed
        </Text>
        <View style={styles.divider} />

        <StatRow
          label="Top Player"
          value={
            highlights.topPlayer
              ? `${nameOf(playersById, highlights.topPlayer.playerId)} (${highlights.topPlayer.wins}-${highlights.topPlayer.losses}, ${Math.round(highlights.topPlayer.winPct * 100)}%)`
              : "—"
          }
        />
        <StatRow
          label="Top Team"
          value={
            highlights.topTeam
              ? `${teamNameOf(playersById, highlights.topTeam.playerAId, highlights.topTeam.playerBId)} (${highlights.topTeam.wins}-${highlights.topTeam.losses}, ${Math.round(highlights.topTeam.winPct * 100)}%)`
              : "—"
          }
        />
        <StatRow
          label="Biggest Blowout"
          value={
            highlights.biggestBlowout
              ? `${matchTeamsLabel(playersById, highlights.biggestBlowout.match)} — margin of ${highlights.biggestBlowout.margin}`
              : "—"
          }
        />
        <StatRow
          label="Closest Match"
          value={
            highlights.closestMatch
              ? `${matchTeamsLabel(playersById, highlights.closestMatch.match)} — margin of ${highlights.closestMatch.margin}`
              : "—"
          }
        />
        <StatRow
          label="Longest Match"
          value={
            highlights.longestMatch
              ? `${matchTeamsLabel(playersById, highlights.longestMatch.match)} — ${formatHoursMinutes(highlights.longestMatch.durationSeconds)}`
              : "—"
          }
        />
        <StatRow
          label="Shortest Match"
          value={
            highlights.shortestMatch
              ? `${matchTeamsLabel(playersById, highlights.shortestMatch.match)} — ${formatHoursMinutes(highlights.shortestMatch.durationSeconds)}`
              : "—"
          }
        />
        <StatRow
          label="Player Win Streak"
          value={
            highlights.topPlayerStreak
              ? `${nameOf(playersById, highlights.topPlayerStreak.playerId)} — ${highlights.topPlayerStreak.streak} in a row`
              : "—"
          }
        />
        <StatRow
          label="Team Win Streak"
          value={
            highlights.topTeamStreak
              ? `${teamNameOf(playersById, highlights.topTeamStreak.playerAId, highlights.topTeamStreak.playerBId)} — ${highlights.topTeamStreak.streak} in a row`
              : "—"
          }
        />

        <Text style={styles.sectionTitle}>Times Played</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableName, styles.tableHeaderText]}>Player</Text>
          <Text style={[styles.tableCount, styles.tableHeaderText]}>Matches</Text>
        </View>
        {highlights.timesPlayed.length === 0 ? (
          <Text style={styles.statLabel}>No players on the roster.</Text>
        ) : (
          highlights.timesPlayed.map((entry) => (
            <View key={entry.playerId} style={styles.tableRow}>
              <Text style={styles.tableName}>{nameOf(playersById, entry.playerId)}</Text>
              <Text style={styles.tableCount}>{entry.count}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Generated by Pickleball Manager on {format(new Date(), "MMMM d, yyyy")}
        </Text>
      </Page>
    </Document>
  );
}
