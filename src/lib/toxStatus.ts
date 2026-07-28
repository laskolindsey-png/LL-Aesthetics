// Satisfaction statuses for the Botox / Tox Tracker, mirroring the color codes
// Lindsey uses in her workbook. Kept in a plain (non-"use server") module so
// both client and server components can import the labels and tones.

export const TOX_STATUSES = ["happy", "watch", "not_happy", "awaiting"] as const;
export type ToxStatus = (typeof TOX_STATUSES)[number];

// Botox patients typically return ~every 3 months. Past this many months since
// the last visit, they're considered lapsed and due for a reactivation reach-out.
export const REACTIVATE_MONTHS = 6;

// The step name / template used for the reactivation task (matches the seed).
export const REACTIVATION_STEP = "6-Month Reactivation";

// The statuses that represent an actual results-check judgment. "awaiting" is
// the absence of a check, so it isn't something you log.
export const TOX_CHECK_STATUSES = ["happy", "watch", "not_happy"] as const;

export const TOX_LABEL: Record<string, string> = {
  happy: "Happy",
  watch: "Tough Patient",
  not_happy: "Not Happy",
  awaiting: "Awaiting Check",
};

// Short helper text shown next to each color so staff know what it means.
export const TOX_HINT: Record<string, string> = {
  happy: "Happy with results",
  watch: "Never quite happy, but still coming",
  not_happy: "Not happy with results",
  awaiting: "No results check logged yet",
};

// The dot/emoji cue (matches the workbook colors).
export const TOX_DOT: Record<string, string> = {
  happy: "🟢",
  watch: "🟡",
  not_happy: "🔴",
  awaiting: "⚪",
};

export function toxStatusTone(
  status: string
): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "happy":
      return "success";
    case "not_happy":
      return "danger";
    case "watch":
      return "warning";
    default:
      return "neutral"; // awaiting
  }
}

// Subtle row tint for the tracker table, echoing the spreadsheet's shading.
export const TOX_ROW_TINT: Record<string, string> = {
  happy: "bg-success/[0.06]",
  not_happy: "bg-danger/[0.06]",
  watch: "bg-warning/[0.08]",
  awaiting: "",
};

// Map free-text status labels (from an imported spreadsheet) to internal codes.
export function normalizeToxStatus(raw: string): ToxStatus {
  const s = raw.trim().toLowerCase();
  if (["happy", "green", "good", "yes"].includes(s)) return "happy";
  if (["not happy", "not_happy", "unhappy", "red", "no"].includes(s)) return "not_happy";
  if (["watch", "tough", "tough patient", "flag", "yellow", "manage"].includes(s))
    return "watch";
  return "awaiting";
}
