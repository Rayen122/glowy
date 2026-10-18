"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  exact,
  className,
  activeClassName = "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground [&_svg]:size-[18px] [&_svg]:shrink-0",
        className,
        active && activeClassName
      )}
    >
      {children}
    </Link>
  );
}
