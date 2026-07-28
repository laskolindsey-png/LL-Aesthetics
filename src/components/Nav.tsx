"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Today's Tasks" },
  { href: "/workflow", label: "Patient Workflow" },
  { href: "/patients", label: "Patients" },
  { href: "/plans", label: "Plans" },
  { href: "/peptides", label: "Peptides" },
  { href: "/tox", label: "Botox Tracker" },
  { href: "/leads", label: "Leads" },
  { href: "/rules", label: "Service Rules" },
  { href: "/settings", label: "Settings" },
];

const OWNER_LINKS = [
  { href: "/insights", label: "Insights" },
  { href: "/integrations", label: "Integrations" },
  { href: "/team", label: "Team" },
];

export function Nav({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const links = isOwner ? [...BASE_LINKS, ...OWNER_LINKS] : BASE_LINKS;
  return (
    <nav className="flex flex-wrap gap-1">
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-ink text-white"
                : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
