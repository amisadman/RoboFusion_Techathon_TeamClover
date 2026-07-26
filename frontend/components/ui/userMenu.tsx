"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, UserAccountIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name?: string | null) {
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role ?? "staff";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Avatar size="sm">
          <AvatarFallback>
            {initials(user?.name || user?.email) || (
              <HugeiconsIcon icon={UserAccountIcon} className="size-3.5" />
            )}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "fixed right-0 top-full z-50 mt-1 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10",
          )}
        >
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-xs font-medium text-foreground">
              {user?.name || user?.email || "User"}
            </span>
            <span className="text-[0.625rem] uppercase tracking-wide text-text-muted">
              {role}
            </span>
          </div>
          <div className="-mx-1 my-1 h-px bg-border/50" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.replace("/login");
            }}
            className="flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
