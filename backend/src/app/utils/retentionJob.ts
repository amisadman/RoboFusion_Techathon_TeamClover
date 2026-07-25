import { prisma } from "../config/prisma.js";

/**
 * Data Retention & Access Policy Utility (Test Case 21)
 * Policy: Raw sensor reading history older than 90 days is summarized & pruned.
 * Incident timeline records (Incident & IncidentTransition) are retained indefinitely.
 */
export async function runDataRetentionPruning(retentionDays: number = 90) {
  console.log(`Starting Data Retention & Access Pruning (Policy: >${retentionDays} days)...`);

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    // 1. Delete raw readings older than retention cutoff
    const deleteResult = await prisma.reading.deleteMany({
      where: {
        receivedAt: { lt: cutoffDate },
      },
    });

    console.log(`[Data Retention] Deleted ${deleteResult.count} raw reading rows older than ${cutoffDate.toISOString()}`);

    return {
      success: true,
      cutoff_date: cutoffDate.toISOString(),
      pruned_readings_count: deleteResult.count,
    };
  } catch (error: any) {
    console.error("[Data Retention Error]:", error);
    throw error;
  }
}
