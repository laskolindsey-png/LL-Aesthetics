// Aura scan → treatment-plan parsing.
//
// Aura exports a "Treatment Plan" PDF whose OVERVIEW section lists, per line,
// a category, then a treatment with its date, optional duration, and price.
// We extract those into plan items so the plan builds itself on upload — the
// front desk just confirms. Runs server-side only (Node).

export type ParsedPlanItem = {
  category: string | null;
  treatment: string;
  date: string | null; // MM/DD/YYYY as printed
  durationMin: number | null;
  price: number | null;
};

const DATE_RE = /(\d{2}\/\d{2}\/\d{4})/;
// Prices print as "USD 1,500.00", "$1,500.00", or "1,500.00 USD" across exports.
const PRICE_RE = /(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*USD/i;
function extractPrice(s: string): number | null {
  const m = (s ?? "").match(PRICE_RE);
  if (!m) return null;
  const v = Number((m[1] ?? m[2] ?? "").replace(/,/g, ""));
  return isNaN(v) ? null : v;
}
const isPageHeader = (l: string) =>
  /^-+\s*\d+\s*of\s*\d+\s*-+$/i.test(l) || /^\d{1,2}\s+\d{2}\/\d{2}\/\d{4}$/.test(l);

/** Parse the OVERVIEW table out of an Aura plan's extracted text. */
export function parseAuraOverview(text: string): ParsedPlanItem[] {
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  // Match "OVERVIEW" alone or a header ending in it (e.g. "TREATMENT PLAN OVERVIEW").
  const start = lines.findIndex((l) => /^(?:.*\s)?OVERVIEW$/i.test(l));
  if (start < 0) return [];

  const items: ParsedPlanItem[] = [];
  let category: string | null = null;
  let pending: string[] = [];
  let expectCategory = true;

  for (let k = start + 1; k < lines.length; k++) {
    const l = lines[k];
    if (/^Total\b/i.test(l)) break;
    if (isPageHeader(l)) continue;

    const m = l.match(DATE_RE);
    if (m) {
      // Treatment name is the text before the date, minus a price if it printed there.
      const before = l
        .slice(0, m.index)
        .replace(/\s*(?:USD|\$)\s*[\d,]+(?:\.\d{1,2})?\s*$/i, "")
        .trim();
      const treatment = [...pending, before].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const after = l.slice((m.index ?? 0) + m[0].length);
      const dur = after.match(/(\d+)\s*min/i);
      // Price usually follows the date; fall back to scanning the whole line.
      const price = extractPrice(after) ?? extractPrice(l);
      if (treatment) {
        items.push({
          category,
          treatment,
          date: m[1],
          durationMin: dur ? Number(dur[1]) : null,
          price,
        });
      }
      pending = [];
      expectCategory = true;
    } else if (expectCategory) {
      category = l;
      expectCategory = false;
    } else {
      pending.push(l);
    }
  }
  return items;
}

/** Read a PDF buffer and pull the plan items out of it. */
export async function parseAuraPdf(
  buffer: Buffer
): Promise<{ items: ParsedPlanItem[]; text: string }> {
  const mod: Record<string, unknown> = await import("pdf-parse");
  const d = mod.default as Record<string, unknown> | undefined;
  const PDFParse = (mod.PDFParse || d?.PDFParse || d) as
    | (new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> })
    | undefined;
  if (typeof PDFParse !== "function") {
    throw new Error(`pdf-parse: PDFParse not found (keys: ${Object.keys(mod).join(",")})`);
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const res = await parser.getText();
  const text = res?.text ?? "";
  return { items: parseAuraOverview(text), text };
}

/** "MM/DD/YYYY" → Date (local noon to dodge tz drift), or null. */
export function auraDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
