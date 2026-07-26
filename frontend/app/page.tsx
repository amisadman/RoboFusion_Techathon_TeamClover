"use client";

import { useRequireSession } from "@/hooks/use-require-session";
import { useRealtime } from "@/providers/realtime-provider";
import { useOpenIncidentsByZone } from "@/hooks/use-open-incidents-by-zone";
import { TopBar } from "@/components/layout/top-bar";
import { ZoneMap } from "@/components/dashboard/zone-map";
import { DispatchLedger } from "@/components/dashboard/dispatch-ledger";
import { NLReporter } from "@/components/ai-integration/nl-reporter";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { ready } = useRequireSession();
  const { zones, priorityQueue } = useRealtime();
  const openIncidentsByZone = useOpenIncidentsByZone();

  if (!ready) {
    return (
      <div className="flex min-h-svh flex-col bg-canvas">
        <div className="h-12 border-b border-hairline bg-surface" />
        <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <TopBar />

      <main className="flex flex-1 flex-col">
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
          <section
            aria-label="Zone map"
            className="min-w-0 border-b border-hairline lg:border-r lg:border-b-0"
          >
            <ZoneMap zones={zones} />
          </section>

          <section aria-label="Dispatch ledger" className="flex min-w-0 flex-col overflow-y-auto">
            <div className="border-b border-hairline bg-surface px-3 py-2">
              <h2 className="font-heading text-xs font-semibold tracking-widest text-text-muted uppercase">
                Priority ranking
              </h2>
            </div>
            <DispatchLedger ranked={priorityQueue} zones={zones} openIncidentsByZone={openIncidentsByZone} />
            <NLReporter />
          </section>
        </div>

        <section aria-label="Dashboard charts" className="border-t border-hairline p-3">
          <DashboardCharts />
        </section>
      </main>
    </div>
  );
}
