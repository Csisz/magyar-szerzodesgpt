"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "text-sm px-3 py-1.5 rounded-md transition-colors",
        active
          ? "bg-emerald-500 text-white"
          : "text-slate-200 hover:bg-slate-800 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

export function MainNav() {
  return (
    <nav className="w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Bal oldal – “logó” / név */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">
            Magyar SzerződésGPT
          </span>
        </Link>

        {/* Jobb oldal – menü linkek */}
        <div className="flex items-center gap-2">
          <NavLink href="/" label="Főoldal" />
          <NavLink href="/contracts/generate" label="Szerződés generálása" />
          <NavLink href="/contracts/review" label="Szerződés review" />
          <NavLink href="/contracts/diff" label="Diff / javítások" />
        </div>
      </div>
    </nav>
  );
}
