/**
 * Google Analytics 4 Helper Functions
 * Provides typed interfaces for common GA operations
 */

export interface GtagCommand {
  (command: "event", eventName: string, eventParams?: Record<string, unknown>): void;
  (command: "config", gtagId: string, config?: Record<string, unknown>): void;
  (command: "js", timestamp: Date): void;
  (command: "consent", consentType: string, consentValue: string, additionalParams?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag?: GtagCommand;
  }
}

/**
 * Initialize Google Analytics (called from layout.tsx)
 */
export const initGA = (gaId: string) => {
  if (typeof window === "undefined") return;
  
  if (!window.dataLayer) {
    window.dataLayer = [];
  }

  if (!window.gtag) {
    window.gtag = function () {
      // @ts-ignore
      window.dataLayer.push(arguments);
    };
  }

  window.gtag("js", new Date());
  window.gtag("config", gaId, {
    page_path: window.location.pathname,
  });
};

/**
 * Track page view (called when route changes)
 * Important for SPA navigation in Next.js
 */
export const pageview = (path: string, title?: string) => {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("config", process.env.NEXT_PUBLIC_GA_ID || "", {
    page_path: path,
    page_title: title,
  });
};

/**
 * Track custom events
 * Example: trackEvent('button_click', { button_name: 'Sign Up' })
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>
) => {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", eventName, eventParams);
};

/**
 * Track conversions
 * Example: trackConversion({ value: 29.99, currency: 'USD' })
 */
export const trackConversion = (conversionData: Record<string, unknown>) => {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", "conversion", conversionData);
};

/**
 * Set user properties (e.g., logged-in status, subscription type)
 */
export const setUserProperty = (propertyName: string, value: unknown) => {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("config", process.env.NEXT_PUBLIC_GA_ID || "", {
    user_properties: {
      [propertyName]: value,
    },
  });
};
