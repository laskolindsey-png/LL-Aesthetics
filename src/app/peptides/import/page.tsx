import { importPeptidesCsv } from "@/lib/peptideActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  nofile: "No file was selected. Choose your .csv file and try again.",
  empty: "That file looked empty. Make sure it has a header row plus your orders.",
  cols: "Couldn't find the key columns. The header row needs at least a name column (e.g. 'Full Name') and an order/product column (e.g. 'Order').",
};

export default async function PeptideImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/peptides" className="text-sm text-muted hover:text-ink">
          ← Peptide Orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Import past peptide orders</h1>
        <p className="mt-1 text-sm text-muted">
          Load your order history from your tracker spreadsheet — for record.
          They come in marked <strong>Received</strong> (completed), so your
          history is preserved and stays out of your active &ldquo;To Fill&rdquo;
          list. Your data goes straight into your database, never into the
          app&apos;s code, and nothing syncs to your director&apos;s sheet.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {ERRORS[error] ?? "Something went wrong with that file. Please try again."}
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Save your peptide tracker as a <strong>CSV</strong> file (or use the one prepared for you).</li>
          <li>
            It should have a header row with your columns —{" "}
            <em>Full Name, Order, Order Amount, Tracking Number, Status/Notes</em>, etc.
          </li>
          <li>Everything imports as <strong>Received</strong> so it reads as completed history.</li>
          <li>Re-uploading is safe — duplicates (same name + product + tracking) are skipped.</li>
        </ol>
      </div>

      <form action={importPeptidesCsv} className="card space-y-4 p-5">
        <div>
          <label className="label">Choose your CSV file</label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-ink/90"
          />
        </div>
        <div>
          <label className="label">Import these as</label>
          <select name="status" defaultValue="Received" className="input w-auto">
            <option value="Received">Received (completed history)</option>
            <option value="Requested">Requested (active — to fill)</option>
          </select>
          <p className="mt-1 text-xs text-muted">
            Leave on &ldquo;Received&rdquo; for old orders you just want on record.
          </p>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary">Import orders</button>
        </div>
      </form>
    </div>
  );
}
