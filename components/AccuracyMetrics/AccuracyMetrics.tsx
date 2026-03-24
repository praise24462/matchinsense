"use client";
import React, { useState, useEffect } from "react";
import styles from "./AccuracyMetrics.module.scss";

interface AccuracyData {
  totalPredictions: number;
  scoreAccuracy: number;
  outcomeAccuracy: number;
  confidenceDistribution: {
    High: number;
    Medium: number;
    Low: number;
  };
  highConfidenceAccuracy?: number;
  usedFormDataAccuracy?: number;
  usedH2HDataAccuracy?: number;
  summary: string;
}

export default function AccuracyMetrics({
  confidence,
  formDataOnly,
  h2hDataOnly,
}: {
  confidence?: "Low" | "Medium" | "High";
  formDataOnly?: boolean;
  h2hDataOnly?: boolean;
} = {}) {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (confidence) params.append("confidence", confidence);
    if (formDataOnly) params.append("formData", "true");
    if (h2hDataOnly) params.append("h2hData", "true");

    fetch(`/api/prediction-accuracy?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load accuracy metrics");
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        console.error("Accuracy metrics error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [confidence, formDataOnly, h2hDataOnly]);

  if (loading) {
    return (
      <section className={styles.section}>
        <h2>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          Prediction Accuracy
        </h2>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.section}>
        <h2>Prediction Accuracy</h2>
        <div className={styles.error}>{error || "Could not load accuracy data"}</div>
      </section>
    );
  }

  if (data.totalPredictions === 0) {
    return (
      <section className={styles.section}>
        <h2>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          Prediction Accuracy
        </h2>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyText}>No predictions recorded yet</div>
          <div className={styles.emptySubtext}>
            Generate match predictions to start tracking accuracy
          </div>
        </div>
      </section>
    );
  }

  const highConfidenceCount = data.confidenceDistribution.High;
  const highConfidenceAccuracy = data.highConfidenceAccuracy ? (data.highConfidenceAccuracy * 100).toFixed(1) : "0";

  return (
    <section className={styles.section}>
      <h2>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3" />
          <polyline points="12 12 20 7.5" />
          <polyline points="12 12 12 21" />
          <polyline points="12 12 4 7.5" />
        </svg>
        Prediction Accuracy Tracker
      </h2>

      {/* Key Metrics */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.positive}`}>
          <div className={styles.metricLabel}>Total Predictions</div>
          <div className={styles.metricValue}>{data.totalPredictions}</div>
          <div className={styles.metricSubtext}>predictions recorded</div>
        </div>

        <div
          className={`${styles.metricCard} ${
            data.outcomeAccuracy >= 60 ? styles.positive : data.outcomeAccuracy >= 40 ? styles.neutral : styles.negative
          }`}
        >
          <div className={styles.metricLabel}>Outcome Accuracy</div>
          <div className={styles.metricValue}>
            {data.outcomeAccuracy.toFixed(1)}<span className={styles.unit}>%</span>
          </div>
          <div className={styles.metricSubtext}>match result predictions correct</div>
          <div className={styles.progressBar}>
            <div className={styles.fill} style={{ width: `${data.outcomeAccuracy}%` }} />
          </div>
        </div>

        <div
          className={`${styles.metricCard} ${
            data.scoreAccuracy >= 20 ? styles.positive : data.scoreAccuracy >= 10 ? styles.neutral : styles.negative
          }`}
        >
          <div className={styles.metricLabel}>Score Accuracy</div>
          <div className={styles.metricValue}>
            {data.scoreAccuracy.toFixed(1)}<span className={styles.unit}>%</span>
          </div>
          <div className={styles.metricSubtext}>exact score predictions correct</div>
          <div className={styles.progressBar}>
            <div className={styles.fill} style={{ width: `${Math.min(data.scoreAccuracy * 4, 100)}%` }} />
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>High Confidence</div>
          <div className={styles.metricValue}>
            {highConfidenceAccuracy}<span className={styles.unit}>%</span>
          </div>
          <div className={styles.metricSubtext}>
            {highConfidenceCount} high-confidence predictions
          </div>
        </div>
      </div>

      {/* Confidence Distribution */}
      <div className={styles.chartContainer}>
        <h3>Predictions by Confidence Level</h3>
        <div className={styles.confidenceChart}>
          <div className={styles.confidenceBar}>
            <div className={styles.confidenceLabel}>
              <span>High Confidence</span>
              <span>{data.confidenceDistribution.High}</span>
            </div>
            <div className={`${styles.bar} ${styles.high}`}>
              <div
                className={styles.fill}
                style={{
                  width: `${(data.confidenceDistribution.High / data.totalPredictions) * 100}%`,
                }}
              />
            </div>
            <div className={styles.stats}>
              {((data.confidenceDistribution.High / data.totalPredictions) * 100).toFixed(0)}% of all predictions
            </div>
          </div>

          <div className={styles.confidenceBar}>
            <div className={styles.confidenceLabel}>
              <span>Medium Confidence</span>
              <span>{data.confidenceDistribution.Medium}</span>
            </div>
            <div className={`${styles.bar} ${styles.medium}`}>
              <div
                className={styles.fill}
                style={{
                  width: `${(data.confidenceDistribution.Medium / data.totalPredictions) * 100}%`,
                }}
              />
            </div>
            <div className={styles.stats}>
              {((data.confidenceDistribution.Medium / data.totalPredictions) * 100).toFixed(0)}% of all predictions
            </div>
          </div>

          <div className={styles.confidenceBar}>
            <div className={styles.confidenceLabel}>
              <span>Low Confidence</span>
              <span>{data.confidenceDistribution.Low}</span>
            </div>
            <div className={`${styles.bar} ${styles.low}`}>
              <div
                className={styles.fill}
                style={{
                  width: `${(data.confidenceDistribution.Low / data.totalPredictions) * 100}%`,
                }}
              />
            </div>
            <div className={styles.stats}>
              {((data.confidenceDistribution.Low / data.totalPredictions) * 100).toFixed(0)}% of all predictions
            </div>
          </div>
        </div>
      </div>

      <div className={styles.note}>
        <strong>💡 How This Helps:</strong> Monitor accuracy of predictions enhanced with form data and H2H
        records. Higher accuracy with high confidence predictions indicates which data enrichments work best.
      </div>
    </section>
  );
}
