import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 秒 → 「1分30秒」表記 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}分` : `${minutes}分${rest}秒`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatFollowers(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(count % 10000 === 0 ? 0 : 1)}万`;
  return count.toLocaleString("ja-JP");
}

/**
 * パーセンタイル（高いほど上位）に応じた色トークン。
 * 上位25%以内 = good / 上位50%以内 = mid / それ以外 = bad
 */
export function percentileTone(percentile: number): "good" | "mid" | "bad" {
  if (percentile >= 75) return "good";
  if (percentile >= 50) return "mid";
  return "bad";
}
