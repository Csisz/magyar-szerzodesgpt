"use client";

import Link from "next/link";
import Image from "next/image";
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

        {/* ▾ LOGÓ + felirat */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            width={45}
            height={39}
            alt="Magyar SzerződésGPT logó"
            className="rounded-md"
          />
          <span className="text-base font-semibold text-emerald-400 tracking-wide">
            Magyar SzerződésGPT
          </span>
        </Link>

        {/* ▾ Menü linkek */}
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
