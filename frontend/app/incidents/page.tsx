"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useRequireSession } from "@/hooks/use-require-session";
import { useRealtime } from "@/providers/realtime-provider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRiskScore } from "@/lib/format";
import { INCIDENT_STATUS_CONFIG } from "@/lib/status";
import { TopBar } from "@/components/layout/top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Incident, IncidentFilters, IncidentStatus } from "@/types/contract";

function acknowledgedByLabel(value: Incident["acknowledged_by_user"]): string {
  if (!value) return "—";
  return value.name || value.email || "—";
}

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const config = INCIDENT_STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs", config.bgSoftClass, config.textClass)}>
      <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3" />
      {config.label}
    </span>
  );
}

function TransitionsTimeline({ incident }: { incident: Incident }) {
  const transitions = [...incident.transitions].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  if (transitions.length === 0) {
    return <p className="py-2 text-xs text-text-muted">No transitions recorded for this incident.</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5 py-2">
      {transitions.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-text-muted tabular-nums">{formatDateTime(t.occurredAt)}</span>
          <span className="text-text-muted">{t.fromState ?? "—"}</span>
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3 text-text-muted" />
          <span className="font-medium text-foreground">{t.toState}</span>
          <span className="font-mono text-text-muted tabular-nums">risk {formatRiskScore(t.riskScore)}</span>
        </li>
      ))}
    </ol>
  );
}

const STATUS_OPTIONS: IncidentStatus[] = ["OPEN", "ACKED", "RESOLVED"];

export default function IncidentsPage() {
  const { ready } = useRequireSession();
  const { zones } = useRealtime();

  const [filters, setFilters] = useState<IncidentFilters>({});
  const [pendingFilters, setPendingFilters] = useState<IncidentFilters>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Documented data-fetching pattern (react.dev/learn/synchronizing-with-effects#fetching-data):
    // toggling a loading flag around the request, guarded by `cancelled` for
    // out-of-order responses when filters change quickly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .getIncidents(filters)
      .then((data) => {
        if (!cancelled) setIncidents(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load incidents", { description: "Check the connection and try again." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, filters]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setFilters(pendingFilters);
  }

  function clearFilters() {
    setPendingFilters({});
    setFilters({});
  }

  const zoneOptions = Object.values(zones);

  if (!ready) {
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

      <main className="flex-1 p-4">
        <h1 className="font-heading text-sm font-semibold tracking-wide text-foreground">Incidents</h1>

        <form onSubmit={applyFilters} className="mt-3 flex flex-wrap items-end gap-3 border border-hairline bg-surface p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-zone">Zone</Label>
            <Select
              value={pendingFilters.zone_id ?? "all"}
              onValueChange={(value) =>
                setPendingFilters((f) => ({ ...f, zone_id: !value || value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger id="filter-zone" size="sm" className="w-40">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                {zoneOptions.map((zone) => (
                  <SelectItem key={zone.zone_id} value={zone.zone_id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              value={pendingFilters.status ?? "all"}
              onValueChange={(value) =>
                setPendingFilters((f) => ({
                  ...f,
                  status: value === "all" ? undefined : (value as IncidentStatus),
                }))
              }
            >
              <SelectTrigger id="filter-status" size="sm" className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {INCIDENT_STATUS_CONFIG[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              className="w-36"
              value={pendingFilters.from ?? ""}
              onChange={(e) => setPendingFilters((f) => ({ ...f, from: e.target.value || undefined }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              className="w-36"
              value={pendingFilters.to ?? ""}
              onChange={(e) => setPendingFilters((f) => ({ ...f, to: e.target.value || undefined }))}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </form>

        <div className="mt-3 border border-hairline bg-surface">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : incidents.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">No incidents match these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hazard types</TableHead>
                  <TableHead>Peak risk</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Acknowledged by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => {
                  const expanded = expandedId === incident.id;
                  return (
                    <Fragment key={incident.id}>
                      <TableRow
                        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                        onClick={() => setExpandedId(expanded ? null : incident.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedId(expanded ? null : incident.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={expanded}
                      >
                        <TableCell>
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            strokeWidth={2}
                            className={cn("size-3.5 text-text-muted transition-transform", expanded && "rotate-180")}
                          />
                        </TableCell>
                        <TableCell className="font-heading font-medium text-foreground">{incident.zone_name}</TableCell>
                        <TableCell>
                          <IncidentStatusBadge status={incident.status} />
                        </TableCell>
                        <TableCell className="text-text-muted">
                          {incident.hazard_types.length > 0 ? incident.hazard_types.join(", ") : "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{formatRiskScore(incident.peak_risk_score)}</TableCell>
                        <TableCell className="text-text-muted">{incident.source}</TableCell>
                        <TableCell className="font-mono text-text-muted tabular-nums">
                          {formatDateTime(incident.opened_at)}
                        </TableCell>
                        <TableCell className="text-text-muted">{acknowledgedByLabel(incident.acknowledged_by_user)}</TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-canvas/60">
                            <TransitionsTimeline incident={incident} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}
