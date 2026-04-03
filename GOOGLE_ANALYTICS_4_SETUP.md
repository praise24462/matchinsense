# Google Analytics 4 Setup Guide for MatchInsense

## 1. Environment Variable Configuration

Create or update `.env.local` in your project root with:

```env
NEXT_PUBLIC_GA_ID=G-QT855TYTHH
```

**Important Notes:**
- The `NEXT_PUBLIC_` prefix makes this variable available in the browser (required for GA tracking)
- Never commit `.env.local` to version control (add to `.gitignore`)
- Restart your development server after adding the environment variable

## 2. Files Updated/Created

### Updated: `app/layout.tsx`
- Added `GoogleAnalytics` component import
- Simplified GA initialization  
- Removed conditional rendering (GA loads regardless, tracking depends on env var)

### New: `components/GoogleAnalytics.tsx`
- Client component that tracks page views on route changes
- Uses `usePathname()` and `useSearchParams()` hooks
- Automatically sends page data to GA4 on every navigation
- Integrates seamlessly with Next.js client-side navigation

### New: `services/gtag.ts`
- Helper functions for Google Analytics operations
- TypeScript interfaces for type safety
- Functions included:
  - `initGA()` - Initialize GA (used by layout.tsx)
  - `pageview()` - Track page views (used by GoogleAnalytics component)
  - `trackEvent()` - Track custom events
  - `trackConversion()` - Track conversions
  - `setUserProperty()` - Set user properties

## 3. How It Works

1. **Global Script Loading:** The gtag.js script loads once in `layout.tsx` with `strategy="afterInteractive"` for optimal performance
2. **Initialization:** GA4 is initialized with your measurement ID
3. **Automatic Page Tracking:** The `GoogleAnalytics` component uses Next.js routing hooks to detect every route change and sends pageview events to GA4
4. **SPA Navigation:** Unlike traditional page refreshes, SPA navigation (client-side routing) is properly tracked

## 4. Verification

Check that GA is working:

1. Go to **Google Analytics Console** → Your Property
2. Navigate to **Real-Time** → **Overview**
3. Trigger a page navigation in your app
4. You should see the page views appear in real-time within seconds

## 5. Using GA Functions

### Track Custom Events

In any client component:

```tsx
import { trackEvent } from "@/services/gtag";

export function QuickActionButton() {
  const handleClick = () => {
    trackEvent("prediction_viewed", {
      sport: "football",
      league: "Premier League",
    });
  };

  return <button onClick={handleClick}>View Prediction</button>;
}
```

### Track Conversions

```tsx
import { trackConversion } from "@/services/gtag";

export function PaymentForm() {
  const handleSuccess = (amount: number) => {
    trackConversion({
      value: amount,
      currency: "USD",
    });
  };

  return <form onSubmit={() => handleSuccess(29.99)}>...</form>;
}
```

### Set User Properties

```tsx
import { setUserProperty } from "@/services/gtag";

export function UserDashboard({ user }) {
  useEffect(() => {
    if (user?.subscription) {
      setUserProperty("subscription_tier", "premium");
    }
  }, [user]);

  return <div>...</div>;
}
```

## 6. Performance Considerations

✅ **What this implementation does well:**
- Script loads after page is interactive (`afterInteractive`)
- Single script load across all pages (no duplicates)
- GA is loaded asynchronously, doesn't block page rendering
- Works with Next.js App Router architecture
- Proper handling of SPA navigation

⚠️ **Browser Privacy:**
- GA4 respects user privacy settings and browser do-not-track flags
- Consider adding cookie consent banner for GDPR compliance
- Document GA usage in your privacy policy

## 7. Testing GA Connection

Run in browser console:

```javascript
// Check if gtag is loaded
console.log(window.gtag);

// Manual page tracking test
window.gtag?.('config', 'G-QT855TYTHH', { page_path: '/test' });
```

## 8. Troubleshooting

**GA not showing page views:**
- ✅ Verify `NEXT_PUBLIC_GA_ID=G-QT855TYTHH` in `.env.local`
- ✅ Restart dev server after env changes
- ✅ Check browser DevTools → Network tab → search "gtag" 
- ✅ Verify the measurement ID in Google Analytics Console

**Script errors in console:**
- The gtag script has `async` by default, async errors are safe to ignore
- Check that `NEXT_PUBLIC_GA_ID` is set and valid

**Multiple GA events firing:**
- Normal behavior if you navigate between routes
- Each route change triggers one pageview event

---

**Status:** ✅ Google Analytics 4 is now properly integrated with automatic page tracking on all client-side navigation.
