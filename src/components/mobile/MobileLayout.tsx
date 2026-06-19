import { Link, useLocation, Outlet } from "react-router-dom";
import { Home, Search, Heart, User, ShoppingCart, ScanLine, Monitor } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import NotificationBell from "@/components/NotificationBell";
import logo from "@/assets/logo.png";

const tabs = [
  { to: "/m", label: "Home", icon: Home },
  { to: "/m/search", label: "Search", icon: Search },
  { to: "/m/scan", label: "Scan", icon: ScanLine, highlight: true },
  { to: "/m/store", label: "Store", icon: ShoppingCart },
  { to: "/m/dashboard", label: "Me", icon: User },
];

const MobileLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { storeEnabled } = useStoreEnabled();

  const visibleTabs = tabs.filter((tab) => tab.to !== "/m/store" || storeEnabled);

  const isActive = (path: string) => {
    if (path === "/m") return location.pathname === "/m";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md">
        <Link to="/m" className="flex items-center gap-2">
          <img src={logo} alt="PetsRegistry" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground border border-border transition-colors hover:bg-muted" title="Switch to Desktop">
            <Monitor className="h-4 w-4" />
            <span>Desktop</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
        <div className="flex h-16 items-stretch">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to === "/m/dashboard" && !user ? "/m/login" : tab.to}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  tab.highlight
                    ? ""
                    : active
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {tab.highlight ? (
                  <div className="-mt-5 flex flex-col items-center gap-0.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <span className="text-[10px] font-medium text-primary">{tab.label}</span>
                  </div>
                ) : (
                  <>
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                    {tab.label}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;
