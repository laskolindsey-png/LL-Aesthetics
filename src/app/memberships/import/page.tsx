import { importMembershipsCsv } from "@/lib/membershipActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MembershipImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const msg =
    error === "nofile"
      ? "Please choose a CSV file first."
      : error === "empty"
      ? "That file looked empty — check it has a header row and members."
      : error === "noname"
      ? "Couldn't find a Member Name column. Add a header row with a Name column."
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/memberships" className="text-sm text-muted hover:text-ink">
          ← Memberships
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Import your members</h1>
        <p className="mt-1 text-sm text-muted">
          Load your whole roster at once from a spreadsheet — no re-typing. Member
          info goes straight into your database and is never stored in the app&apos;s code.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {msg}
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Save your roster as a <strong>CSV</strong> file (or use the one prepared for you).</li>
          <li>Header row with columns like <em>Member Name, Tier, Billing Day, Status</em>.</li>
          <li>The <strong>Status</strong> column reads <em>Active</em>, <em>Paused</em>, or <em>Cancelled</em>.</li>
          <li>Choose the file below and click Import.</li>
        </ol>
      </div>

      <form action={importMembershipsCsv} className="card space-y-4 p-5">
        <div>
          <label className="label">Choose your CSV file</label>
          <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" required />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="replace" className="h-4 w-4" />
          Replace everything currently in memberships (start fresh from this file)
        </label>
        <p className="text-xs text-muted">
          Leave the box unchecked to add these members alongside any already listed.
        </p>
        <div className="flex justify-end">
          <button className="btn-primary">Import members</button>
        </div>
      </form>
    </div>
  );
}
