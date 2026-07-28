import { login } from "@/lib/authActions";
import { LogoTile } from "@/components/Logo";
import { getSessionUser } from "@/lib/currentUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await getSessionUser()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoTile size={104} wordmark />
          <div className="mt-4 text-xs uppercase tracking-widest text-muted">
            Operating System
          </div>
        </div>

        <form action={login} className="card space-y-4 p-6">
          <input type="hidden" name="next" value={next ?? "/"} />
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Incorrect email or password. Please try again.
            </p>
          )}
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" autoComplete="username" required autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <button className="btn-primary w-full">Sign In</button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Private system · authorized staff only
        </p>
      </div>
    </div>
  );
}
