"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finances", label: "Dashboard" },
  { href: "/finances/revenue", label: "Revenue" },
  { href: "/finances/expenses", label: "Expenses" },
  { href: "/finances/personal", label: "Personal" },
  { href: "/finances/vendors", label: "Vendors" },
];

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b border-line pb-2">
      {TABS.map((t) => {
        const active = t.href === "/finances" ? pathname === "/finances" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
