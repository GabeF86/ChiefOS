"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon },
  { href: "/todos", label: "Todos", Icon: ChecklistIcon },
  { href: "/costs", label: "Costs", Icon: DollarIcon },
  { href: "/settings/security", label: "More", Icon: GearIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-surface/95 backdrop-blur border-t border-border",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname?.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5",
                  "text-[10px] font-mono uppercase tracking-widest",
                  active ? "text-teal" : "text-ink-3 hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-teal" : "text-ink-2",
                  )}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m3 7 2 2 4-4" />
      <path d="m3 14 2 2 4-4" />
      <path d="M11 8h10" />
      <path d="M11 15h10" />
    </svg>
  );
}
function DollarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v20" />
      <path d="M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
    </svg>
  );
}
function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.14 16.91l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.09 4.14l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
    </svg>
  );
}
