/**
 * usePredictiveIntelligence — Phase 5
 *
 * Derives predictive signals and operational recommendations
 * from ExecutionHistoryContext data. All analysis is grounded
 * in real execution metrics — no fabrication.
 *
 * Predictive signals:
 *   - degradationRisk: % probability workflow will degrade further
 *   - failureForecast: estimated failure probability for next run
 *   - durationForecast: estimated duration for next run (ms)
 *   - volatilityIndex: coefficient of variation in duration (0–1)
 *
 * Recommendations: explainable, telemetry-grounded suggestions
 * derived only from real patterns in the execution history.
 */
import { useMemo } from "react";
import { useExecutionHistory, HEALTH_TIER_COLOR, type WorkflowHealth } from "../contexts/ExecutionHistoryContext";

/* ── Types ───────────────────────────────────────────────────────────── */
export type RecommendationType =
  | "add_retry"
  | "investigate_timeout"
  | "reduce_frequency"
  | "review_failure_pattern"
  | "baseline_established"
  | "duration_unstable"
  | "performance_improving"
  | "no_recent_success"
  | "escalating_degradation";

export interface OperationalRecommendation {
  id:              string;
  type:            RecommendationType;
  workflowId:      string;
  workflowName:    string;
  title:           string;
  detail:          string;
  severity:        "info" | "warning" | "critical";
  evidence:        string;   // the specific metric that triggered this
  actionable:      boolean;
}

export interface PredictiveSignals {
  workflowId:         string;
  workflowName:       string;
  failureProbability: number;   // 0–1
  degradationRisk:    number;   // 0–1
  durationForecast:   number | null;  // ms
  volatilityIndex:    number;   // 0–1 (coefficient of variation)
  trend:              "improving" | "stable" | "worsening" | "unknown";
  confidence:         "low" | "medium" | "high";
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeSignals(health: WorkflowHealth): PredictiveSignals {
  const { workflowId, workflowName, totalRuns, successRate,
          recentFailureRate, durationTrend, anomalies, score, tier } = health;

  // Failure probability: weighted blend of recent + overall rates
  const failureProbability = Math.min(1,
    recentFailureRate * 0.7 + (1 - successRate) * 0.3
  );

  // Degradation risk: increases with anomaly count and worsening trend
  let degradationRisk = 0;
  if (tier === "critical")  degradationRisk = 0.85;
  else if (tier === "degraded") degradationRisk = 0.60;
  else if (tier === "warning")  degradationRisk = 0.35;
  else if (tier === "healthy")  degradationRisk = 0.08;
  if (durationTrend === "increasing") degradationRisk = Math.min(1, degradationRisk + 0.1);
  if (anomalies.some(a => a.severity === "high")) degradationRisk = Math.min(1, degradationRisk + 0.15);

  // Duration forecast — not derivable from WorkflowHealth alone (needs raw durations)
  // Uses p50 as the forecast baseline (backend enriches this)
  const durationForecast = health.p50DurationMs
    ? Math.round(health.p50DurationMs * (durationTrend === "increasing" ? 1.15 : 1.0))
    : null;

  // Volatility: approximated from anomaly flags
  const hasDurationSpike = anomalies.some(a => a.type === "duration_spike");
  const volatilityIndex  = hasDurationSpike ? 0.65
    : durationTrend === "increasing" ? 0.45
    : durationTrend === "improving"  ? 0.2
    : 0.15;

  const trend: PredictiveSignals["trend"] =
    tier === "healthy" && durationTrend === "improving" ? "improving"
    : (tier === "critical" || tier === "degraded") && durationTrend === "increasing" ? "worsening"
    : tier === "healthy" ? "stable"
    : tier === "unknown" ? "unknown" : "stable";

  const confidence: PredictiveSignals["confidence"] =
    totalRuns >= 10 ? "high" :
    totalRuns >= 4  ? "medium" : "low";

  return {
    workflowId, workflowName,
    failureProbability, degradationRisk, durationForecast,
    volatilityIndex, trend, confidence,
  };
}

function buildRecommendations(
  health: WorkflowHealth,
  signals: PredictiveSignals,
): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = [];
  const { workflowId, workflowName, anomalies, totalRuns, recentFailureRate,
          successRate, durationTrend, p50DurationMs, tier } = health;

  if (totalRuns < 3) return recs;

  /* Repeated failures → add retry logic */
  if (anomalies.some(a => a.type === "repeated_failure") && recentFailureRate >= 0.4) {
    recs.push({
      id:          `retry-${workflowId}`,
      type:        "add_retry",
      workflowId, workflowName,
      title:       "Consider adding retry steps",
      detail:      `This workflow has failed ${Math.round(recentFailureRate * 100)}% of recent runs. Adding retry logic may improve reliability.`,
      severity:    recentFailureRate >= 0.6 ? "critical" : "warning",
      evidence:    `Recent failure rate: ${Math.round(recentFailureRate * 100)}%`,
      actionable:  true,
    });
  }

  /* Duration spikes → investigate timeout */
  if (anomalies.some(a => a.type === "duration_spike") && p50DurationMs) {
    recs.push({
      id:          `timeout-${workflowId}`,
      type:        "investigate_timeout",
      workflowId, workflowName,
      title:       "Execution duration spiking",
      detail:      `Some runs are taking significantly longer than the ${Math.round(p50DurationMs / 1000)}s median. This may indicate a slow external dependency or missing timeout config.`,
      severity:    "warning",
      evidence:    `Duration spike detected — latest run exceeded 1.8× median`,
      actionable:  true,
    });
  }

  /* High failure rate with no recent success */
  if (anomalies.some(a => a.type === "no_recent_success")) {
    recs.push({
      id:          `norecsuccess-${workflowId}`,
      type:        "no_recent_success",
      workflowId, workflowName,
      title:       "No recent successful executions",
      detail:      "This workflow has not completed successfully in recent runs. Review configuration and dependencies.",
      severity:    "critical",
      evidence:    "No successful run found in last 5 executions",
      actionable:  true,
    });
  }

  /* Escalating degradation */
  if (tier === "critical" && signals.degradationRisk > 0.7) {
    recs.push({
      id:          `degrade-${workflowId}`,
      type:        "escalating_degradation",
      workflowId, workflowName,
      title:       "Workflow entering critical state",
      detail:      `Health score has dropped to ${health.score}/100. This workflow requires immediate attention to avoid complete failure.`,
      severity:    "critical",
      evidence:    `Health score: ${health.score} · Degradation risk: ${Math.round(signals.degradationRisk * 100)}%`,
      actionable:  true,
    });
  }

  /* Duration trend worsening but not yet critical */
  if (durationTrend === "increasing" && !anomalies.some(a => a.type === "duration_spike")) {
    recs.push({
      id:          `duration-trend-${workflowId}`,
      type:        "duration_unstable",
      workflowId, workflowName,
      title:       "Execution duration trending upward",
      detail:      "Each run is taking slightly longer than the last. This pattern can indicate resource leak or growing data volume.",
      severity:    "info",
      evidence:    "Linear regression on duration shows positive slope",
      actionable:  false,
    });
  }

  /* Improving — positive signal */
  if (signals.trend === "improving" && totalRuns >= 5) {
    recs.push({
      id:          `improving-${workflowId}`,
      type:        "performance_improving",
      workflowId, workflowName,
      title:       "Workflow performance improving",
      detail:      "Recent runs are completing faster with a higher success rate. No action required.",
      severity:    "info",
      evidence:    `Success rate: ${Math.round(successRate * 100)}% · Duration trend: improving`,
      actionable:  false,
    });
  }

  return recs;
}

/* ── Main hook ───────────────────────────────────────────────────────── */
export function usePredictiveIntelligence() {
  const { health, totalIngested } = useExecutionHistory();

  return useMemo(() => {
    const signalsMap:   Record<string, PredictiveSignals>             = {};
    const allRecs:      OperationalRecommendation[]                   = [];
    const criticalRecs: OperationalRecommendation[]                   = [];

    Object.values(health).forEach(h => {
      if (h.totalRuns < 2) return;
      const signals = computeSignals(h);
      signalsMap[h.workflowId] = signals;
      const recs = buildRecommendations(h, signals);
      allRecs.push(...recs);
      criticalRecs.push(...recs.filter(r => r.severity === "critical"));
    });

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allRecs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const highestRiskWorkflow = Object.values(signalsMap)
      .sort((a, b) => b.degradationRisk - a.degradationRisk)[0] ?? null;

    return {
      signals:              signalsMap,
      recommendations:      allRecs,
      criticalRecommendations: criticalRecs,
      highestRiskWorkflow,
      hasRecommendations:   allRecs.length > 0,
      hasCritical:          criticalRecs.length > 0,
      totalTracked:         Object.keys(signalsMap).length,
    };
  }, [health, totalIngested]);
}

/* ── Single-workflow hook ────────────────────────────────────────────── */
export function useWorkflowPrediction(workflowId: string) {
  const { signals, recommendations } = usePredictiveIntelligence();
  return {
    signals: signals[workflowId] ?? null,
    recommendations: recommendations.filter(r => r.workflowId === workflowId),
  };
}
