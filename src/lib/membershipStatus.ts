export const MEMBERSHIP_STATUSES = ["Active", "Paused", "Cancelled"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function membershipStatusTone(
  status: string
): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "Active":
      return "success";
    case "Paused":
      return "warning";
    case "Cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}
