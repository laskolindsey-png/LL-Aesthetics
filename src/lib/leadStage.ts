// Ordered pipeline stages before a lead converts.
export const OPEN_STAGES = ["New", "Contacted", "Nurturing"] as const;
export const ALL_STAGES = ["New", "Contacted", "Nurturing", "Booked", "Lost"] as const;

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

export function stageTone(stage: string): Tone {
  switch (stage) {
    case "Booked":
      return "success";
    case "Lost":
      return "neutral";
    case "New":
      return "warning";
    default:
      return "accent";
  }
}
