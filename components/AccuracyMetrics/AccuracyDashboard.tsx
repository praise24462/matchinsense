"use client";

import React, { useEffect, useState } from "react";
import styles from "./accuracy.module.scss";

interface AccuracyMetrics {
  period: string;
  startDate: string;
  endDate: string;
  totalPredictions: number;
  totalPredictionsSaved?: number;
  correctOutcomes: number;
  correctScores: number;
  overallAccuracy: string;
  byConfidence: {
    High: { total: number; correct: number; accuracy: string | number };
    Medium: { total: number; correct: number; accuracy: string | number };
    Low: { total: number; correct: number; accuracy: string | number };
  };
  byDataReliability: {
    high: { total: number; correct: number; accuracy: string | number };
    medium: { total: number; correct: number; accuracy: string | number };
    low: { total: number; correct: number; accuracy: string | number };
  };
  recentPredictions: any[];
  status?: "success" | "no-data";
}

interface DashboardProps {
  period?: "7d" | "30d" | "all-time";
  confidence?: "Low" | "Medium" | "High";
}

export default function AccuracyDashboard({ period = "7d", confidence }: DashboardProps) {
  const [metrics, setMetrics] = useState<AccuracyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "all-time">(period);

  useEffect(() => {
    fetchMetrics();
  }, [selectedPeriod]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("period", selectedPeriod);
      if (confidence) params.append("confidence", confidence);

      const response = await fetch(`/api/prediction-accuracy?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      // Now we accept 200 responses with or without data
      if (response.ok || data.status === "no-data") {
        setMetrics(data);
        setError(null);
      } else {
        throw new Error(data.error || "Failed to fetch metrics");
      }
    } catch (err) {
      console.error("Error fetching accuracy metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load metrics");
      // Still set a default metric state so dashboard shows "no data"
      setMetrics({
        period: selectedPeriod,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        totalPredictions: 0,
        totalPredictionsSaved: 0,
        correctOutcomes: 0,
        correctScores: 0,
        overallAccuracy: "0.0",
        byConfidence: {
          High: { total: 0, correct: 0, accuracy: "N/A" },
          Medium: { total: 0, correct: 0, accuracy: "N/A" },
          Low: { total: 0, correct: 0, accuracy: "N/A" },
        },
        byDataReliability: {
          high: { total: 0, correct: 0, accuracy: "N/A" },
          medium: { total: 0, correct: 0, accuracy: "N/A" },
          low: { total: 0, correct: 0, accuracy: "N/A" },
        },
        recentPredictions: [],
        note: "Waiting for prediction data...",
        status: "no-data",
      } as any);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading accuracy metrics...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        ⚠️ {error}
        <div style={{ fontSize: "0.9rem", marginTop: "0.5rem", opacity: 0.7 }}>
          System is running. Waiting for prediction data to arrive from match processors.
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div className={styles.noData}>No prediction data available yet</div>;
  }

  // Show message when no predictions saved yet
  if (metrics.totalPredictionsSaved === 0) {
    return (
      <div className={styles.noData}>
        <h3>🚀 Accuracy System is Ready!</h3>
        <p>No predictions recorded yet. The system will start tracking accuracy once predictions are saved.</p>
        <p style={{ fontSize: "0.9rem", opacity: 0.7 }}>
          Predictions will appear here as they are created and match results are updated.
        </p>
      </div>
    );
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 70) return "high";
    if (accuracy >= 50) return "medium";
    return "low";
  };

  const overallAccuracyNum = parseFloat(metrics.overallAccuracy);
  const accuracyColor = getAccuracyColor(overallAccuracyNum);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h2>Prediction Accuracy Dashboard</h2>
        <div className={styles.periodSelector}>
          {(["7d", "30d", "all-time"] as const).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${selectedPeriod === p ? styles.active : ""}`}
              onClick={() => setSelectedPeriod(p)}
            >
              {p === "all-time" ? "All Time" : p === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.dateRange}>
        <small>
          {new Date(metrics.startDate).toLocaleDateString()} -{" "}
          {new Date(metrics.endDate).toLocaleDateString()}
        </small>
      </div>

      {/* Overall Accuracy Card */}
      <div className={`${styles.card} ${styles[`accuracy-${accuracyColor}`]}`}>
        <h3>Overall Accuracy</h3>
        <div className={styles.accuracyValue}>{metrics.overallAccuracy}%</div>
        <div className={styles.accuracyDetails}>
          <span>{metrics.correctOutcomes} correct outcomes</span>
          <span>{metrics.totalPredictions} total predictions</span>
        </div>
      </div>

      {/* Score Accuracy Card */}
      <div className={styles.card}>
        <h3>Score Predictions</h3>
        <div className={styles.scoreValue}>
          {metrics.correctScores} / {metrics.totalPredictions}
        </div>
        <div className={styles.scorePercent}>
          {metrics.totalPredictions > 0
            ? ((metrics.correctScores / metrics.totalPredictions) * 100).toFixed(1)
            : 0}
          %
        </div>
      </div>

      {/* By Confidence Level */}
      <div className={styles.section}>
        <h3>Accuracy by Confidence Level</h3>
        <div className={styles.gridContainer}>
          {Object.entries(metrics.byConfidence).map(([level, data]) => (
            <div key={level} className={styles.metricBox}>
              <div className={styles.metricLabel}>{level}</div>
              <div className={styles.metricValue}>{data.accuracy}%</div>
              <div className={styles.metricDetail}>
                {data.correct} / {data.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Data Reliability */}
      <div className={styles.section}>
        <h3>Accuracy by Data Reliability</h3>
        <div className={styles.gridContainer}>
          {Object.entries(metrics.byDataReliability).map(([level, data]) => (
            <div key={level} className={styles.metricBox}>
              <div className={styles.metricLabel}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </div>
              <div className={styles.metricValue}>{data.accuracy}%</div>
              <div className={styles.metricDetail}>
                {data.correct} / {data.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Predictions */}
      {metrics.recentPredictions.length > 0 && (
        <div className={styles.section}>
          <h3>Recent Predictions</h3>
          <div className={styles.recentTable}>
            <table>
              <thead>
                <tr>
                  <th>Prediction</th>
                  <th>Actual</th>
                  <th>Confidence</th>
                  <th>Correct</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentPredictions.map((pred, idx) => (
                  <tr key={idx} className={pred.outcomeCorrect ? styles.correctRow : styles.incorrectRow}>
                    <td>
                      {pred.homeTeam} vs {pred.awayTeam}
                    </td>
                    <td>{pred.actualOutcome || "-"}</td>
                    <td>{pred.confidence}</td>
                    <td>{pred.outcomeCorrect ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={styles.note}>
        <small>
          Note: Accuracy metrics are updated as matches complete and results are recorded.
        </small>
      </div>
    </div>
  );
}
