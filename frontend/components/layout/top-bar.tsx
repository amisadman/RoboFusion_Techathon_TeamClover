"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  WifiConnected02Icon,
  WifiDisconnected02Icon,
} from "@hugeicons/core-free-icons";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/providers/realtime-provider";
import { Button } from "@/components/ui/button";
import { UserMenu } from "../ui/userMenu";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/incidents", label: "Incidents" },
  { href: "/admin", label: "Admin" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const load = () => {
      setMounted(true);
    };

    load();
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-xs" aria-label="Toggle theme">
        <Sun className="size-3.5" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { connected, zones } = useRealtime();
  const zoneList = Object.values(zones);
  const criticalCount = zoneList.filter((z) => z.state === "CRITICAL").length;
  const summary =
    zoneList.length === 0
      ? "No zones reporting"
      : criticalCount > 0
        ? `${zoneList.length} zones · ${criticalCount} critical`
        : `${zoneList.length} zones`;

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 overflow-x-auto border-b border-hairline bg-surface px-4">
      <span className="shrink-0 font-heading text-sm font-bold tracking-widest whitespace-nowrap text-foreground">
        SCS-RG
      </span>

      <nav className="flex shrink-0 items-center gap-1" aria-label="Primary">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-sm px-2 py-1 font-heading text-xs font-medium tracking-wide transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-secondary text-foreground"
                  : "text-text-muted hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <span className="hidden shrink-0 font-mono text-xs whitespace-nowrap text-text-muted sm:inline">
        {summary}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="inline-flex items-center gap-1.5" role="status">
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              connected ? "bg-safe" : "bg-offline",
            )}
            aria-hidden="true"
          />
          <HugeiconsIcon
            icon={connected ? WifiConnected02Icon : WifiDisconnected02Icon}
            strokeWidth={2}
            className={cn("size-3.5", connected ? "text-safe" : "text-offline")}
          />
          <span
            className={cn("text-xs", connected ? "text-safe" : "text-offline")}
          >
            {connected ? "live" : "reconnecting"}
          </span>
        </span>

        <ThemeToggle />

        <UserMenu />
      </div>
    </header>
  );
}
