import { Link, useLocation, useNavigate } from "react-router-dom";
import { PawPrint, LayoutDashboard, PlusCircle, Settings, Store, LogOut, Heart, Activity, AlertTriangle, FileText, Building2, Crown, Mail, ShoppingBag, Award, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import MembershipBadge from "@/components/MembershipBadge";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import { useIsMobileRoute } from "@/hooks/useIsMobileRoute";

const sidebarLinks = [
  { to: "/dashboard", label: "My Pets", icon: LayoutDashboard },
  { to: "/dashboard/inbox", label: "Inbox", icon: Mail },
  { to: "/dashboard/orders", label: "My Orders", icon: ShoppingBag },
  { to: "/dashboard/register-pet", label: "Register Pet", icon: PlusCircle },
  { to: "/dashboard/health", label: "Pet Health", icon: Activity },
  { to: "/dashboard/adoption", label: "Adoption", icon: Heart },
  { to: "/dashboard/lost-reports", label: "Lost Reports", icon: AlertTriangle },
  { to: "/dashboard/flyer-builder", label: "Flyer Builder", icon: FileText },
  { to: "/dashboard/certificates", label: "Pet Certificates", icon: Award },
  { to: "/dashboard/directory", label: "My Listings", icon: Building2 },
  
  { to: "/pet-map", label: "Pet Map", icon: MapPin },
  { to: "/dashboard/membership", label: "Membership", icon: Crown },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const MEMBERSHIP_UPGRADE_PATH = "/dashboard/membership#upgrade-plans";

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, membership, canUpgradeMembership } = useAuth();
  const { storeEnabled } = useStoreEnabled();
  const isMobileRoute = useIsMobileRoute();

  if (isMobileRoute) return null;

  const goToUpgradePlans = () => {
    navigate(MEMBERSHIP_UPGRADE_PATH);
    if (location.pathname === "/dashboard/membership") {
      requestAnimationFrame(() => {
        document.getElementById("upgrade-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 rounded-lg transition-colors hover:opacity-80">
            <PawPrint className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">PetsRegistry</span>
          </Link>
          <NotificationBell mode="sheet" />
        </div>
        {membership && (
          <div className="mt-2">
            <MembershipBadge planType={membership.planType} planName={membership.planName} size="sm" />
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link key={link.to} to={link.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-md font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <Icon className="h-5 w-5" />{link.label}
            </Link>
          );
        })}
      </nav>

      {canUpgradeMembership && (
        <div className="border-t border-border p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-accent text-accent text-md"
            onClick={goToUpgradePlans}
          >
            <Crown className="h-4 w-4" /> Upgrade Plan
          </Button>
        </div>
      )}

      <div className="border-t border-border p-4">
        {storeEnabled && (
          <Button asChild variant="outline" className="mb-2 w-full gap-2 text-md">
            <Link to="/store">
              <Store className="h-5 w-5" /> Visit Store
            </Link>
          </Button>
        )}
        <Button variant="ghost" className="w-full gap-2 text-md text-muted-foreground" onClick={signOut}>
          <LogOut className="h-5 w-5" /> Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
