import { importToxCsv } from "@/lib/toxActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  nofile: "No file was selected. Choose your .csv file and try again.",
  empty: "That file looked empty. Make sure it has a header row plus your patients.",
  noname: "Couldn't find a Name column. The first row should include a 'Name' header.",
};

export default async function ToxImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/tox" className="text-sm text-muted hover:text-ink">
          ← Tox Tracker
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Import your tox patients</h1>
        <p className="mt-1 text-sm text-muted">
          Load your whole list at once from a spreadsheet — no re-typing. Your
          patient info goes straight into your database and is never stored in
          the app&apos;s code.
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
          <li>Save your Botox workbook as a <strong>CSV</strong> file (or use the one prepared for you).</li>
          <li>It should have a header row with columns like <em>Name, Contact, Status, Comments</em>.</li>
          <li>
            The <strong>Status</strong> column carries the color: <em>Happy</em>,{" "}
            <em>Not Happy</em>, <em>Tough</em>, or blank for awaiting.
          </li>
          <li>Choose the file below and click Import.</li>
        </ol>
      </div>

      <form action={importToxCsv} className="card space-y-4 p-5">
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
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="replace" className="h-4 w-4" />
          Replace everything currently in the tracker (start fresh from this file)
        </label>
        <p className="text-xs text-muted">
          Leave the box unchecked to add these patients alongside any already in
          the tracker.
        </p>
        <div className="flex justify-end">
          <button className="btn-primary">Import patients</button>
        </div>
      </form>
    </div>
  );
}
