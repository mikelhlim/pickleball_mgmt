"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, MapPin, BarChart3, Settings, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { PickleballIcon } from "@/components/pickleball-icon";

const baseLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/game-days", label: "Game Days", icon: CalendarDays },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];
const adminLink = { href: "/admin", label: "Admin", icon: Settings };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...baseLinks, adminLink] : baseLinks;

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <PickleballIcon className="size-5 shrink-0" />
            Pickleball Manager
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(pathname, href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium",
              isActive(pathname, href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
