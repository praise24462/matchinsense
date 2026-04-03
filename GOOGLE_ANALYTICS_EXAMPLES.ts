/**
 * Google Analytics 4 - Usage Examples for MatchInsense Components
 * 
 * This file demonstrates how to use GA tracking functions throughout your app.
 * Copy these patterns into your components as needed.
 */

// ──────────────────────────────────────────────────────────────────────────
// Example 1: Track Button Clicks
// ──────────────────────────────────────────────────────────────────────────

import { trackEvent } from "@/services/gtag";

export function PredictionCTA() {
  const handleViewPrediction = (matchId: string) => {
    trackEvent("prediction_clicked", {
      match_id: matchId,
      click_source: "match_card",
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <button onClick={() => handleViewPrediction("match_123")}>
      View Full Prediction
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 2: Track User Preferences Changes
// ──────────────────────────────────────────────────────────────────────────

export function PreferenceToggle() {
  const handleToggleNotifications = (enabled: boolean) => {
    trackEvent("notifications_toggled", {
      enabled,
      user_setting_type: "notifications",
    });
  };

  return (
    <button onClick={() => handleToggleNotifications(true)}>
      Enable Notifications
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 3: Track Tab Switches in Tabbed Interface
// ──────────────────────────────────────────────────────────────────────────

export function MatchTabs() {
  const handleTabChange = (tabName: string) => {
    trackEvent("tab_switched", {
      tab_name: tabName, // "stats", "lineups", "predictions", etc.
      page: "match_detail",
    });
  };

  return (
    <div>
      <button onClick={() => handleTabChange("stats")}>Stats</button>
      <button onClick={() => handleTabChange("lineups")}>Lineups</button>
      <button onClick={() => handleTabChange("predictions")}>AI Predictions</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 4: Track Form Submissions
// ──────────────────────────────────────────────────────────────────────────

export function ContactForm() {
  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      // Submit form...
      
      // Track on success
      trackEvent("contact_form_submitted", {
        form_type: "support_inquiry",
        has_attachment: Boolean(formData.attachment),
      });
    } catch (error) {
      trackEvent("contact_form_error", {
        error_type: "submission_failed",
      });
    }
  };

  return <form onSubmit={(e) => {
    e.preventDefault();
    handleSubmit({});
  }}>Contact</form>;
}

// ──────────────────────────────────────────────────────────────────────────
// Example 5: Track Search Queries
// ──────────────────────────────────────────────────────────────────────────

export function SearchMatches() {
  const handleSearch = (query: string) => {
    trackEvent("search_performed", {
      search_query: query,
      result_count: 0, // Add actual count
      search_type: "matches", // could be "teams", "matches", "predictions"
    });
  };

  return (
    <input
      placeholder="Search matches..."
      onKeyPress={(e) => {
        if (e.key === "Enter") {
          handleSearch((e.target as HTMLInputElement).value);
        }
      }}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 6: Track Subscription/Monetization Events
// ──────────────────────────────────────────────────────────────────────────

import { trackConversion } from "@/services/gtag";

export function SubscriptionCheckout() {
  const handleSubscription = async (plan: string, price: number) => {
    try {
      // Process payment...
      
      // Track conversion
      trackConversion({
        value: price,
        currency: "USD",
        items: [
          {
            item_name: plan,
            item_id: `plan_${plan}`,
            price: price,
            quantity: 1,
          },
        ],
        event_category: "subscription",
      });
    } catch (error) {
      trackEvent("subscription_error", {
        plan,
        error_message: error instanceof Error ? error.message : "Unknown",
      });
    }
  };

  return (
    <button onClick={() => handleSubscription("premium", 29.99)}>
      Subscribe
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 7: Track API Errors and Performance Issues
// ──────────────────────────────────────────────────────────────────────────

export function MatchCardWithErrorTracking() {
  const [match, setMatch] = React.useState(null);

  React.useEffect(() => {
    fetchMatch()
      .then(setMatch)
      .catch((error) => {
        trackEvent("api_error_match_fetch", {
          error_type: error.code,
          error_message: error.message,
          endpoint: "/api/match",
          severity: "high",
        });
      });
  }, []);

  return match ? <div>{match.home} vs {match.away}</div> : null;
}

// ──────────────────────────────────────────────────────────────────────────
// Example 8: Track Feature Adoption and Usage
// ──────────────────────────────────────────────────────────────────────────

export function AIInsightsCard() {
  const handleExpandInsights = () => {
    trackEvent("ai_insights_expanded", {
      feature: "match_predictions",
      component: "match_card",
    });
  };

  const handleSharePrediction = () => {
    trackEvent("prediction_shared", {
      share_method: "copy_link", // or "email", "twitter", etc.
    });
  };

  return (
    <div>
      <button onClick={handleExpandInsights}>Expand Insights</button>
      <button onClick={handleSharePrediction}>Share</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Example 9: Track User Progress and Engagement
// ──────────────────────────────────────────────────────────────────────────

export function PredictionAccuracyTracker() {
  const handleTrackingStart = (userId: string) => {
    trackEvent("prediction_tracking_started", {
      user_id: userId,
      tracking_type: "accuracy_monitor",
    });
  };

  const handleMilestone = (milestoneName: string, accuracy: number) => {
    trackEvent("prediction_accuracy_milestone", {
      milestone: milestoneName, // "50_accurate", "100_predictions", etc.
      accuracy_score: accuracy,
    });
  };

  return <div>Tracking Setup</div>;
}

// ──────────────────────────────────────────────────────────────────────────
// Example 10: Use in useEffect for Page/Component Load
// ──────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";

export function LiveMatches() {
  useEffect(() => {
    trackEvent("page_loaded", {
      page_name: "live_matches",
      layout_type: "grid",
    });
  }, []);

  return <div>Live Matches Component</div>;
}

// ──────────────────────────────────────────────────────────────────────────
// Best Practices:
// ──────────────────────────────────────────────────────────────────────────
// 
// 1. Event Names: Use snake_case (e.g., prediction_clicked)
// 2. Be Specific: Include enough context to analyze behavior
// 3. Avoid PII: Never track passwords, emails, or sensitive user data
// 4. Performance: GA calls are async and non-blocking
// 5. User Privacy: Only track data you have consent for
// 6. Organization: Use consistent naming across your app
// 7. Documentation: Comment complex GA tracking logic
//
// For more info: https://developer.google.com/analytics/devguides/collection/ga4
