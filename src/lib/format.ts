import { format } from "date-fns";

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}
