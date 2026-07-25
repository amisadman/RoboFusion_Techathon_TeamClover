"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Key02Icon } from "@hugeicons/core-free-icons";
import { useRequireSession } from "@/hooks/use-require-session";
import { useRealtime } from "@/providers/realtime-provider";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OverrideTargetState = "SAFE" | "WARNING" | "CRITICAL";
const OVERRIDE_STATES: OverrideTargetState[] = ["SAFE", "WARNING", "CRITICAL"];

export default function AdminPage() {
  const { session, ready } = useRequireSession();
  const router = useRouter();
  const { zones } = useRealtime();

  // Client-side check only -- this hides the admin controls from non-admin
  // staff for UX purposes. It enforces nothing: the real gate is the
  // backend's requireAdmin() middleware (backend/src/app/middlewares/auth.middleware.ts),
  // which rejects non-admin requests to these endpoints regardless of what
  // this page does.
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (ready && role !== "admin") {
      router.replace("/");
    }
  }, [ready, role, router]);

  const [overrideZone, setOverrideZone] = useState("");
  const [overrideState, setOverrideState] = useState<OverrideTargetState | "">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const [keyZone, setKeyZone] = useState("");
  const [zoneKey, setZoneKey] = useState<{ zone_id: string; name: string; api_key: string } | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  const zoneOptions = Object.values(zones);
  const overrideZoneName = zones[overrideZone]?.name ?? overrideZone;

  async function submitOverride() {
    if (!overrideZone || !overrideState) return;
    setOverrideSubmitting(true);
    try {
      await api.override(overrideZone, overrideState);
      toast.success("Override applied");
      setConfirmOpen(false);
    } catch (err) {
      toast.error("Override failed", {
        description: err instanceof ApiError ? err.message : "Check the connection and try again.",
      });
    } finally {
      setOverrideSubmitting(false);
    }
  }

  async function fetchZoneKey() {
    if (!keyZone) return;
    setKeyLoading(true);
    setZoneKey(null);
    try {
      const result = await api.getZoneKey(keyZone);
      setZoneKey(result);
    } catch (err) {
      toast.error("Could not retrieve zone key", {
        description: err instanceof ApiError ? err.message : "Check the connection and try again.",
      });
    } finally {
      setKeyLoading(false);
    }
  }

  async function copyKey() {
    if (!zoneKey) return;
    await navigator.clipboard.writeText(zoneKey.api_key);
    toast.success("API key copied");
  }

  if (!ready || role !== "admin") {
    return (
      <div className="flex min-h-svh flex-col bg-canvas">
        <div className="h-12 border-b border-hairline bg-surface" />
        <div className="p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <TopBar />

      <main className="flex flex-1 flex-col gap-4 p-4 lg:max-w-2xl">
        <h1 className="font-heading text-sm font-semibold tracking-wide text-foreground">Admin</h1>

        <Card className="rounded-sm border-hairline bg-surface">
          <CardHeader>
            <CardTitle>Override</CardTitle>
            <CardDescription>Force a zone into a specific hazard state.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-zone">Zone</Label>
              <Select value={overrideZone} onValueChange={(v) => setOverrideZone(v ?? "")}>
                <SelectTrigger id="override-zone" className="w-44">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((zone) => (
                    <SelectItem key={zone.zone_id} value={zone.zone_id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-state">Target state</Label>
              <Select value={overrideState} onValueChange={(v) => setOverrideState((v as OverrideTargetState) ?? "")}>
                <SelectTrigger id="override-state" className="w-40">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="destructive"
              disabled={!overrideZone || !overrideState}
              onClick={() => setConfirmOpen(true)}
            >
              Apply override
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-hairline bg-surface">
          <CardHeader>
            <CardTitle>Zone API key</CardTitle>
            <CardDescription>Retrieve a zone&apos;s API key for firmware setup.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key-zone">Zone</Label>
                <Select value={keyZone} onValueChange={(v) => setKeyZone(v ?? "")}>
                  <SelectTrigger id="key-zone" className="w-44">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((zone) => (
                      <SelectItem key={zone.zone_id} value={zone.zone_id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={!keyZone || keyLoading} onClick={fetchZoneKey}>
                {keyLoading ? "Retrieving..." : "Retrieve key"}
              </Button>
            </div>

            {zoneKey && (
              <div className="flex items-center gap-2 border border-hairline bg-canvas px-3 py-2">
                <HugeiconsIcon icon={Key02Icon} strokeWidth={2} className="size-3.5 shrink-0 text-text-muted" />
                <code className="flex-1 truncate font-mono text-sm text-foreground">{zoneKey.api_key}</code>
                <Button size="icon-sm" variant="ghost" onClick={copyKey} aria-label="Copy API key">
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm override</DialogTitle>
            <DialogDescription>
              This forces {overrideZoneName} into {overrideState}. Dispatch and zone state update immediately for
              every connected user.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={overrideSubmitting} onClick={submitOverride}>
              {overrideSubmitting ? "Applying..." : "Confirm override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
