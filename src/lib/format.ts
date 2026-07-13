import { format } from "date-fns";

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}

// time is a bare "HH:MM:SS" with no date or timezone of its own — attach an
// arbitrary date so date-fns can format it. Both the attach and the format
// happen in the same local context, so this just echoes the clock time back
// (e.g. "17:00" -> "5:00 PM") with no timezone conversion involved.
export function formatTimeOfDay(time: string) {
  return format(new Date(`2000-01-01T${time}`), "h:mm a");
}

export function formatHoursMinutes(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursMinutesBetween(startIso: string, endIso: string) {
  const seconds = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000)
  );
  return formatHoursMinutes(seconds);
}
