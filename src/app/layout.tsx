import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { LogoTile } from "@/components/Logo";
import { getSessionUser } from "@/lib/currentUser";
import { logout } from "@/lib/authActions";

export const metadata: Metadata = {
  title: "TOOL — LL Aesthetics",
  description:
    "Treatment Operations & Optimization Logic — the LL Aesthetics operating system.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {user ? (
          <>
            <header className="border-b border-line bg-card">
              <div className="mx-auto max-w-6xl px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LogoTile size={44} />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold tracking-tight text-ink">
                          LL Aesthetics
                        </span>
                        <span className="hidden text-xs text-muted sm:inline">· TOOL</span>
                      </div>
                      <div className="text-xs text-muted">
                        Treatment Operations &amp; Optimization Logic
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <Link href="/account" className="hover:text-ink">
                      {user.email}
                    </Link>
                    <form action={logout}>
                      <button className="rounded-lg border border-line px-2.5 py-1 hover:bg-canvas hover:text-ink">
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
                <div className="mt-4">
                  <Nav isOwner={user.role === "owner"} />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
            <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted">
              TOOL™ · Built for LL Aesthetics
            </footer>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
