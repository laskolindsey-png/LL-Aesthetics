// Financials vocabulary + helpers — modeled on the Financial Management sheet.
// Owner-only. Categories mirror the sheet's "Financial Rules"; vendor defaults
// mirror "Reference Data".

export const REVENUE_CATEGORIES = [
  "Service Revenue",
  "Retail Sales",
  "Membership Revenue",
  "Other Revenue",
] as const;

// Expense category → its subcategories (from the sheet's Financial Rules).
export const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Inventory: ["Injectables", "Skincare / Retail", "Consumables", "Peptides"],
  Operating: [
    "Rent",
    "Utilities",
    "Software",
    "Marketing",
    "Office Supplies",
    "Payroll",
    "Insurance",
    "Professional Services",
    "Merchant Fees",
  ],
  Equipment: ["Devices", "Maintenance", "Financing"],
  "Owner Activity": ["Owner Draw", "Owner Contribution"],
  Banking: ["Bank Fees", "Interest", "Transfers"],
};

export const EXPENSE_CATEGORY_NAMES = Object.keys(EXPENSE_CATEGORIES);

// Seed vendors with their default category/subcategory (from Reference Data).
export const SEED_VENDORS: { name: string; defaultCategory: string; defaultSubcategory: string }[] = [
  { name: "Allergan", defaultCategory: "Inventory", defaultSubcategory: "Injectables" },
  { name: "Galderma", defaultCategory: "Inventory", defaultSubcategory: "Injectables" },
  { name: "Evolus (Jeuveau)", defaultCategory: "Inventory", defaultSubcategory: "Injectables" },
  { name: "SkinMedica", defaultCategory: "Inventory", defaultSubcategory: "Skincare / Retail" },
  { name: "Amazon", defaultCategory: "Inventory", defaultSubcategory: "Consumables" },
  { name: "Canva", defaultCategory: "Operating", defaultSubcategory: "Marketing" },
  { name: "Google Workspace", defaultCategory: "Operating", defaultSubcategory: "Software" },
];

export type FinancePeriod = "month" | "year";

/** Start/end of the selected period around a reference date. */
export function periodRange(period: FinancePeriod, ref: Date): { start: Date; end: Date; label: string } {
  const y = ref.getFullYear();
  if (period === "year") {
    return {
      start: new Date(y, 0, 1),
      end: new Date(y + 1, 0, 1),
      label: String(y),
    };
  }
  const m = ref.getMonth();
  return {
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 1),
    label: ref.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

/** Whole months covered by a [start,end) range — used to scale monthly MRR. */
export function monthsInRange(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
