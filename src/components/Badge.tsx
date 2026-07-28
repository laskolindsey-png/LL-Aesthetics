import { ReactNode } from "react";

const TONES: Record<string, string> = {
  neutral: "bg-canvas text-muted border-line",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-[#9a6f28] border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  accent: "bg-accent/25 text-ink border-accent/40",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function priorityTone(priority: string): keyof typeof TONES {
  switch (priority) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Low":
      return "neutral";
    default:
      return "accent";
  }
}

export function statusTone(status: string): keyof typeof TONES {
  switch (status) {
    case "Completed":
      return "success";
    case "Cancelled":
    case "Closed":
      return "neutral";
    case "In Progress":
      return "accent";
    default:
      return "warning";
  }
}
