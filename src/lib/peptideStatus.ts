export const PEPTIDE_STATUSES = ["Requested", "Approved", "Filled", "Shipped", "Received", "Cancelled"] as const;

export function peptideStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "Received":
      return "success";
    case "Shipped":
      return "accent";
    case "Cancelled":
      return "neutral";
    case "Requested":
      return "warning";
    default:
      return "accent"; // Approved / Filled
  }
}
