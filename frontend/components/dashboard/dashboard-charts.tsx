"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
  LabelList,
} from "recharts";
import { useRealtime } from "@/providers/realtime-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRiskScore } from "@/lib/format";
import type { ZoneSummary } from "@/types/contract";

function useResolvedThemeColors() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return {
    grid: isLight ? "#E1E4E9" : "#232b35",
    textMuted: isLight ? "#5B6472" : "#7c8896",
    textPrimary: isLight ? "#1B1B1B" : "#e7ecf2",
    surface: isLight ? "#FFFFFF" : "#121820",
    hairline: isLight ? "#E1E4E9" : "#232b35",
    safe: isLight ? "#15A966" : "#34d399",
    warning: isLight ? "#B45309" : "#f5a623",
    critical: isLight ? "#DC2626" : "#f0453a",
    offline: isLight ? "#6B7280" : "#56616d",
    zoneLinePalette: isLight
      ? ["#0284c7", "#7e22ce", "#be123c", "#d97706", "#059669"]
      : ["#38bdf8", "#c084fc", "#fb7185", "#fbbf24", "#34d399"],
    zoneLineMap: (isLight
      ? {
          server_room: "#0284c7",
          iot_lab: "#7e22ce",
          data_science_lab: "#be123c",
        }
      : {
          server_room: "#38bdf8",
          iot_lab: "#c084fc",
          data_science_lab: "#fb7185",
        }) as Record<string, string>,
  };
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function DashboardCharts() {
  const { zones, historyBuffer } = useRealtime();
  const themeColors = useResolvedThemeColors();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const zoneList = Object.values(zones);

  // --- Chart A Data (Current Risk Score Bar Chart) ---
  const barData = zoneList.map((z) => ({
    zone_id: z.zone_id,
    name: z.name,
    risk_score: z.risk_score,
    state: z.state,
  }));

  const getStatusColor = (state: ZoneSummary["state"]) => {
    switch (state) {
      case "SAFE":
        return themeColors.safe;
      case "WARNING":
        return themeColors.warning;
      case "CRITICAL":
        return themeColors.critical;
      case "OFFLINE":
      default:
        return themeColors.offline;
    }
  };

  // --- Chart B Data (Risk History Line Chart) ---
  // Combine all timestamps across zone history buffers
  const timestampSet = new Set<string>();
  Object.values(historyBuffer).forEach((pts) => {
    pts.forEach((p) => timestampSet.add(p.timestamp));
  });

  const sortedTimestamps = Array.from(timestampSet).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const lineData = sortedTimestamps.map((ts) => {
    const row: Record<string, unknown> = {
      timestamp: ts,
      timeLabel: formatTime(ts),
    };
    zoneList.forEach((z) => {
      const zoneBuffer = historyBuffer[z.zone_id] || [];
      const match = zoneBuffer.find((p) => p.timestamp === ts);
      if (match) {
        row[z.zone_id] = match.risk_score;
      }
    });
    return row;
  });

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Chart A: Current Risk Score per Zone */}
      <Card className="rounded-sm border border-hairline bg-surface p-3">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="font-heading text-xs font-semibold uppercase tracking-widest text-text-muted">
            Current Risk Score per Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {barData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-text-muted">
              Waiting for zone data...
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 18, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={themeColors.textMuted}
                    tick={{ fill: themeColors.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: themeColors.hairline }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={themeColors.textMuted}
                    tick={{ fill: themeColors.textMuted, fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: themeColors.hairline }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.hairline,
                      borderRadius: "4px",
                      color: themeColors.textPrimary,
                      fontSize: "12px",
                    }}
                    formatter={(val: unknown) => [
                      typeof val === "number" ? formatRiskScore(val) : "—",
                      "Risk Score",
                    ]}
                  />
                  <Bar dataKey="risk_score" radius={[2, 2, 0, 0]}>
                    <LabelList
                      dataKey="risk_score"
                      position="top"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        fill: themeColors.textMuted,
                      }}
                      formatter={(v: unknown) => (typeof v === "number" ? formatRiskScore(v) : "—")}
                    />
                    {barData.map((entry) => (
                      <Cell key={entry.zone_id} fill={getStatusColor(entry.state)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart B: Risk Score History per Zone */}
      <Card className="rounded-sm border border-hairline bg-surface p-3">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="font-heading text-xs font-semibold uppercase tracking-widest text-text-muted">
            Risk Score History per Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lineData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-text-muted">
              Collecting live data...
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
                  <XAxis
                    dataKey="timeLabel"
                    stroke={themeColors.textMuted}
                    tick={{ fill: themeColors.textMuted, fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: themeColors.hairline }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={themeColors.textMuted}
                    tick={{ fill: themeColors.textMuted, fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: themeColors.hairline }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.hairline,
                      borderRadius: "4px",
                      color: themeColors.textPrimary,
                      fontSize: "12px",
                    }}
                    formatter={(val: unknown) => [
                      typeof val === "number" ? formatRiskScore(val) : "—",
                      "Risk Score",
                    ]}
                  />
                  <ReferenceLine
                    y={30}
                    stroke={themeColors.warning}
                    strokeDasharray="3 3"
                    label={{
                      value: "WARNING (30)",
                      fill: themeColors.warning,
                      fontSize: 9,
                      position: "insideBottomLeft",
                    }}
                  />
                  <ReferenceLine
                    y={65}
                    stroke={themeColors.critical}
                    strokeDasharray="3 3"
                    label={{
                      value: "CRITICAL (65)",
                      fill: themeColors.critical,
                      fontSize: 9,
                      position: "insideTopLeft",
                    }}
                  />
                  {zoneList.map((z, idx) => {
                    const strokeColor =
                      themeColors.zoneLineMap[z.zone_id] ||
                      themeColors.zoneLinePalette[idx % themeColors.zoneLinePalette.length];
                    return (
                      <Line
                        key={z.zone_id}
                        type="monotone"
                        dataKey={z.zone_id}
                        name={z.name}
                        stroke={strokeColor}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
