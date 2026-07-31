// LL Aesthetics peptide & GLP-1 catalog — the orderable products with their
// price and typical dosing, taken from the practice's master "Peptide Pricing"
// sheet. This is the reference list that powers the New Peptide Order form:
// the product dropdown, and the price + dosing auto-fill.
//
// This is catalog/reference data only (no patient info). For a licensed
// multi-tenant future, this would move to per-tenant Settings; for now LL's
// list lives here so the order form is fast and the prices are always right.

export type PeptideCatalogItem = {
  name: string;
  type: string;
  price: number;
  dosing?: string;
};

export const PEPTIDE_CATALOG: PeptideCatalogItem[] = [
  // Growth-hormone secretagogues
  { name: "AOD-9604 3mg", type: "Injectable", price: 69, dosing: "200mcg sub-Q every day at bedtime" },
  { name: "CJC 1295/Ipamorelin 3mg/3mg — 3ml", type: "Injectable", price: 77, dosing: "200mcg (0.2ml / 20 units) sub-Q nightly" },
  { name: "CJC 1295/Ipamorelin 6mg/6mg — 6ml", type: "Injectable", price: 154, dosing: "200mcg (0.2ml / 20 units) sub-Q nightly" },
  { name: "CJC 1295/Ipamorelin 9mg/9mg — 9ml", type: "Injectable", price: 210, dosing: "200mcg (0.2ml / 20 units) sub-Q nightly" },
  { name: "Sermorelin/Ipamorelin 3mg/3mg", type: "Injectable", price: 69, dosing: "200mcg (0.2ml / 20 units) sub-Q nightly" },
  { name: "Sermorelin/Ipamorelin 9mg/9mg", type: "Injectable", price: 189, dosing: "200mcg (0.2ml / 20 units) sub-Q nightly" },
  { name: "Sermorelin/Ipamorelin 3mg/15ml (Sublingual Drops)", type: "Sublingual Drops", price: 77, dosing: "200mcg sub-Q nightly" },
  { name: "Tesamorelin 30mg/3ml", type: "Injectable", price: 251, dosing: "Inject 0.1ml (10 units) sub-Q once daily" },
  { name: "Tesamorelin 30mg / AOD-9604 6mg / 3ml", type: "Injectable", price: 265, dosing: "Inject 0.1ml (10 units) sub-Q once daily" },

  // Recovery / repair
  { name: "BPC-157 5mg", type: "Injectable", price: 84, dosing: "Inject 200–300mcg sub-Q 1–2x daily" },
  { name: "BPC-157 10mg", type: "Injectable", price: 147, dosing: "Inject 200–300mcg sub-Q 1–2x daily" },
  { name: "BPC-157 0.5mg", type: "Capsule 30 CT", price: 105 },
  { name: "GHK-Cu 10mg/ml", type: "Injectable", price: 120, dosing: "Inject 10 units (1mg) sub-Q every other day" },
  { name: "NAD+ 1000mg/10ml (100mg/1ml)", type: "Injectable", price: 155, dosing: "Inject SQ 100mg (1–2x weekly)" },

  // Sexual wellness
  { name: "PT-141 10mg (Bremelanotide)", type: "Injectable", price: 91, dosing: "Inject 200–300mcg sub-Q 1–2x daily" },
  { name: "Tadalafil 7mg/Oxytocin 200 IU (Daily Use)", type: "Capsule 30 CT", price: 83 },
  { name: "Tadalafil 20mg/Oxytocin 200 IU", type: "Capsule 10 CT", price: 35 },
  { name: "Tadalafil 40mg/Oxytocin 200 IU", type: "Capsule 10 CT", price: 49 },
  { name: "Sildenafil 55mg/Oxytocin 200 IU", type: "Capsule 10 CT", price: 35 },
  { name: "Sildenafil 110mg/Oxytocin 200 IU", type: "Capsule 10 CT", price: 49 },
  { name: "Sildenafil 55mg/Tadalafil 22mg/Oxytocin 200 IU", type: "Capsule 10 CT", price: 63 },

  // GLP-1 weight management (per titration schedule)
  { name: "Tirzepatide 15mg / B6 25mg — 1ml", type: "Injectable", price: 234, dosing: "Per titration schedule" },
  { name: "Tirzepatide 30mg / B6 50mg — 2ml", type: "Injectable", price: 384, dosing: "Per titration schedule" },
  { name: "Tirzepatide 60mg / B6 100mg — 4ml", type: "Injectable", price: 450, dosing: "Per titration schedule" },
  { name: "Semaglutide 2.5mg / B6 50mg — 1ml", type: "Injectable", price: 145, dosing: "Per titration schedule" },
  { name: "Semaglutide 5mg / B6 100mg — 2ml", type: "Injectable", price: 195, dosing: "Per titration schedule" },
  { name: "Semaglutide 10mg / B6 200mg — 4ml", type: "Injectable", price: 300, dosing: "Per titration schedule" },
];

// Normalize a product name for tolerant matching (case/space/dash-insensitive).
export function normalizeProductKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// name -> { price, dosing } for the order form's auto-fill.
export const PEPTIDE_PRICEBOOK: Record<string, { price: number; dosing: string }> =
  Object.fromEntries(
    PEPTIDE_CATALOG.map((p) => [
      normalizeProductKey(p.name),
      { price: p.price, dosing: p.dosing ?? "" },
    ])
  );

// Just the display names, for the product dropdown.
export const PEPTIDE_PRODUCT_NAMES: string[] = PEPTIDE_CATALOG.map((p) => p.name);
