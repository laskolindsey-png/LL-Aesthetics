import { todayStart, addDays } from "./dates";

// How far ahead we start nudging staff to book an unscheduled plan item.
export const REMINDER_WINDOW_DAYS = 21;

export type PlanItemLike = {
  status: string;
  targetDate: Date | null;
};

/** An item needs booking if it's still "Recommended" and its target is within the window (or past). */
export function isDueToBook(item: PlanItemLike, now = todayStart()): boolean {
  if (item.status !== "Recommended") return false;
  if (!item.targetDate) return false;
  return item.targetDate <= addDays(now, REMINDER_WINDOW_DAYS);
}

export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function planItemStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "Scheduled":
      return "accent";
    case "Completed":
      return "success";
    case "Declined":
      return "neutral";
    default:
      return "warning"; // Recommended
  }
}
