import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/currentUser";
import { createUser, resetUserPassword, setUserActive, deleteUser } from "@/lib/userActions";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/Badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { tone: "ok" | "err"; text: string }> = {
  created: { tone: "ok", text: "Staff member added. ✓" },
  reset: { tone: "ok", text: "Password reset. ✓" },
  deleted: { tone: "ok", text: "Staff member removed." },
  email: { tone: "err", text: "Please enter a valid email." },
  short: { tone: "err", text: "Password must be at least 8 characters." },
  exists: { tone: "err", text: "That email already has a login." },
  self: { tone: "err", text: "You can't change your own access here." },
  lastowner: { tone: "err", text: "You can't remove the last owner." },
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");

  const { ok, error } = await searchParams;
  const flag = ok ? MESSAGES[ok] : error ? MESSAGES[error] : null;

  const tenantId = await getCurrentTenantId();
  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Give each staff member their own secure login. Owners can manage the
          team and rules; staff can work the daily tasks and patients.
        </p>
      </div>

      {flag && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            flag.tone === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {flag.text}
        </p>
      )}

      {/* Add staff */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Add a Team Member</h2>
        <form action={createUser} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" placeholder="First Last" />
          </div>
          <div>
            <label className="label">Email (their login)</label>
            <input name="email" type="email" className="input" placeholder="name@example.com" required />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="staff">
              <option value="staff">Staff — daily tasks &amp; patients</option>
              <option value="owner">Owner — full access</option>
            </select>
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input name="password" className="input" placeholder="At least 8 characters" required />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary">Add Team Member</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted">
          Share the temporary password with them — they can change it under their
          own Account after signing in.
        </p>
      </div>

      {/* Team list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/50 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
              <th className="px-4 py-3 font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === me.userId;
              return (
                <tr key={u.id} className="border-b border-line/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{u.name || u.email}</div>
                    <div className="text-xs text-muted">{u.email}{isMe && " (you)"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "owner" ? "accent" : "neutral"}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? "success" : "neutral"}>
                      {u.active ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isMe ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <div className="space-y-2">
                        <form action={resetUserPassword} className="flex items-center gap-1.5">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            name="password"
                            className="input w-40 py-1 text-xs"
                            placeholder="New password"
                          />
                          <button className="btn-ghost py-1 text-xs">Reset</button>
                        </form>
                        <div className="flex items-center gap-3">
                          <form action={setUserActive}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                            <button className="text-xs text-muted hover:text-ink">
                              {u.active ? "Disable" : "Enable"}
                            </button>
                          </form>
                          <form action={deleteUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button className="text-xs text-danger hover:underline">Remove</button>
                          </form>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
