# Fix Next.js useEffect error in layout.tsx

## Steps:
- [x] 1. Create components/ServiceWorkerProvider.tsx with service worker registration
- [x] 2. Edit app/layout.tsx: remove useEffect, import and wrap with ServiceWorkerProvider
- [ ] 3. Test: npm run dev, verify no error and service worker registers

## Status: Files updated. Test to confirm.
