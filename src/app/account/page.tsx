import { getSessionUser } from "@/lib/currentUser";
import { changePassword } from "@/lib/authActions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  current: "Your current password is incorrect.",
  short: "New password must be at least 8 characters.",
  match: "New passwords don't match.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Your Account</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="text-ink">{user!.email}</span>
        </p>
      </div>

      <form action={changePassword} className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink">Change Password</h2>
        {error && ERRORS[error] && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{ERRORS[error]}</p>
        )}
        {ok && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            Password updated. ✓
          </p>
        )}
        <div>
          <label className="label">Current password</label>
          <input name="currentPassword" type="password" className="input" required />
        </div>
        <div>
          <label className="label">New password</label>
          <input name="newPassword" type="password" className="input" required />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input name="confirmPassword" type="password" className="input" required />
        </div>
        <button className="btn-primary w-full">Update Password</button>
      </form>
    </div>
  );
}
