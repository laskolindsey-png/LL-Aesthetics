// Date helpers. All follow-up math is done in whole days off a midnight anchor.

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

export function todayStart(): Date {
  return startOfDay(new Date());
}

/** Midnight, n calendar months before today. Used for reactivation cutoffs. */
export function monthsAgo(n: number): Date {
  const c = todayStart();
  c.setMonth(c.getMonth() - n);
  return c;
}

/** Whole-day difference (dueDate - today). Negative = overdue. */
export function daysUntil(due: Date | null | undefined): number | null {
  if (!due) return null;
  const ms = startOfDay(due).getTime() - todayStart().getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

/** yyyy-mm-dd for <input type="date"> values. */
export function toDateInput(d: Date): string {
  const c = startOfDay(d);
  const m = String(c.getMonth() + 1).padStart(2, "0");
  const day = String(c.getDate()).padStart(2, "0");
  return `${c.getFullYear()}-${m}-${day}`;
}

/** Parse a yyyy-mm-dd input value as a local midnight date. */
export function fromDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
