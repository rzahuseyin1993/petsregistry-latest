import { useLocation } from "react-router-dom";

/**
 * Returns true when the current route is under /m (mobile site).
 * Use to conditionally hide desktop-only chrome (sidebar, navbar, footer).
 */
export function useIsMobileRoute() {
  const { pathname } = useLocation();
  return pathname === "/m" || pathname.startsWith("/m/");
}

/**
 * Returns a helper that prefixes paths with /m when on the mobile site.
 */
export function useMobilePath() {
  const isMobile = useIsMobileRoute();
  return (path: string) => (isMobile ? `/m${path.startsWith("/") ? path : `/${path}`}` : path);
}
