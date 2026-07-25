"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { WifiConnected02Icon, WifiDisconnected02Icon, Logout01Icon, UserAccountIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/providers/realtime-provider";
import { useSession, signOut } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/incidents", label: "Incidents" },
  { href: "/admin", label: "Admin" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, zones } = useRealtime();
  const { data: session } = useSession();

  const zoneList = Object.values(zones);
  const criticalCount = zoneList.filter((z) => z.state === "CRITICAL").length;
  const summary =
    zoneList.length === 0
      ? "No zones reporting"
      : criticalCount > 0
        ? `${zoneList.length} zones · ${criticalCount} critical`
        : `${zoneList.length} zones`;

  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role ?? "staff";

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 overflow-x-auto border-b border-hairline bg-surface px-4">
      <span className="shrink-0 font-heading text-sm font-bold tracking-widest whitespace-nowrap text-foreground">
        SCS-RG
      </span>

      <nav className="flex shrink-0 items-center gap-1" aria-label="Primary">
        {NAV_LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-sm px-2 py-1 font-heading text-xs font-medium tracking-wide transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active ? "bg-secondary text-foreground" : "text-text-muted hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <span className="hidden shrink-0 font-mono text-xs whitespace-nowrap text-text-muted sm:inline">{summary}</span>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <span className="inline-flex items-center gap-1.5" role="status">
          <span
            className={cn("inline-block size-1.5 rounded-full", connected ? "bg-safe" : "bg-offline")}
            aria-hidden="true"
          />
          <HugeiconsIcon
            icon={connected ? WifiConnected02Icon : WifiDisconnected02Icon}
            strokeWidth={2}
            className={cn("size-3.5", connected ? "text-safe" : "text-offline")}
          />
          <span className={cn("text-xs", connected ? "text-safe" : "text-offline")}>
            {connected ? "live" : "reconnecting"}
          </span>
        </span>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="User menu"
            >
              <Avatar size="sm">
                <AvatarFallback>
                  {initials(user.name || user.email) || <HugeiconsIcon icon={UserAccountIcon} className="size-3.5" />}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{user.name || user.email}</span>
                <span className="text-[0.625rem] uppercase tracking-wide text-text-muted">{role}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
