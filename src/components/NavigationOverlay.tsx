/** Fixed overlay spinner — page content stays visible underneath */
const NavigationOverlay = () => (
  <div
    className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center pt-[min(30vh,12rem)]"
    aria-live="polite"
    aria-busy="true"
    role="status"
  >
    <div className="pointer-events-none absolute inset-0 bg-background/25" />
    <div className="relative h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-sm" />
  </div>
);

export default NavigationOverlay;
