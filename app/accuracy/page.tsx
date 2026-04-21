import React from "react";
import AccuracyDashboard from "@/components/AccuracyMetrics/AccuracyDashboard";

/**
 * Accuracy Metrics Dashboard Page
 * 
 * Displays real-time prediction accuracy metrics with:
 * - Overall accuracy statistics
 * - Breakdown by confidence level
 * - Breakdown by data reliability
 * - Recent predictions
 * - Historical trends by time period
 */

export const metadata = {
  title: "Prediction Accuracy Dashboard | Matchinsense",
  description: "View detailed accuracy metrics for AI predictions across different confidence levels and data reliability scores.",
};

export default function AccuracyPage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1rem" }}>
      <AccuracyDashboard period="7d" />
    </div>
  );
}
