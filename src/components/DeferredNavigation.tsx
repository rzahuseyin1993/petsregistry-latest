import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Routes, useLocation, type Location } from "react-router-dom";
import NavigationOverlay from "@/components/NavigationOverlay";

type Props = {
  children: ReactNode;
};

/** Keeps the previous route on screen until the next lazy chunk has loaded */
const RouteReadyNotifier = ({ onReady, children }: { onReady: () => void; children: ReactNode }) => {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <>{children}</>;
};

const HiddenRouteLoader = ({
  location,
  onReady,
  children,
}: {
  location: Location;
  onReady: () => void;
  children: ReactNode;
}) => (
  <div className="hidden" aria-hidden>
    <Suspense fallback={null}>
      <RouteReadyNotifier onReady={onReady}>
        <Routes location={location}>{children}</Routes>
      </RouteReadyNotifier>
    </Suspense>
  </div>
);

const DeferredNavigation = ({ children }: Props) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const isPending = location.key !== displayLocation.key;

  return (
    <>
      {isPending && <NavigationOverlay />}
      <Routes location={displayLocation}>{children}</Routes>
      {isPending && (
        <HiddenRouteLoader
          location={location}
          onReady={() => setDisplayLocation(location)}
        >
          {children}
        </HiddenRouteLoader>
      )}
    </>
  );
};

export default DeferredNavigation;
