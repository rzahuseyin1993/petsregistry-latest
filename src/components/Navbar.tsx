import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  Search,
  ShoppingCart,
  User,
  LogIn,
  LogOut,
  UserPlus,
  Sparkles,
  Heart,
  AlertTriangle,
  Building2,
  ShieldCheck,
  Tag,
  Bell,
  ChevronDown,
} from "lucide-react";
import logo from "@/assets/logo.png";
import NotificationBell from "@/components/NotificationBell";
import MembershipBadge from "@/components/MembershipBadge";
import CartDrawer from "@/components/CartDrawer";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import CmsRenderer from "@/components/CmsRenderer";
import { useIsMobileRoute } from "@/hooks/useIsMobileRoute";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import { useNotifications } from "@/hooks/useNotifications";

function getUserAbbreviation(fullName: string | null | undefined, email: string | undefined): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = email?.split("@")[0] ?? "";
  if (!local) return "?";
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

const navLinks = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/adopt", label: "Adopt", icon: Heart },
  { to: "/store", label: "Store", icon: ShoppingCart },
  { to: "/pet-expert", label: "AI Expert", icon: Sparkles },
  { to: "/lost-pets", label: "Lost Pets", icon: AlertTriangle },
  { to: "/directory", label: "Directory", icon: Building2 },
  { to: "/fees", label: "Fees", icon: Tag },
  { to: "/verify", label: "Verify", icon: ShieldCheck },
];

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, profile, membership, signOut } = useAuth();
  const userAbbreviation = getUserAbbreviation(profile?.full_name, user?.email);
  const { totalItems } = useCart();
  const isMobileRoute = useIsMobileRoute();
  const { storeEnabled } = useStoreEnabled();

  const visibleNavLinks = navLinks.filter((link) => link.to !== "/store" || storeEnabled);

  const { unreadCount } = useNotifications();

  if (isMobileRoute) return null;

  const defaultNavbar = (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      {user && storeEnabled && (
        <>
          <CartDrawer open={cartOpen} onOpenChange={setCartOpen} showTrigger={false} />
          <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} showTrigger={false} />
        </>
      )}
      {user && !storeEnabled && (
        <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} showTrigger={false} />
      )}
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Pets Registry" className="h-12 w-auto" width={176} height={48} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-md font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-lg" aria-label="Account menu">
                    {membership && (
                      <MembershipBadge planType={membership.planType} size="sm" showLabel={false} />
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {userAbbreviation}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {storeEnabled && (
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center gap-2"
                      onClick={() => setCartOpen(true)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Shopping Cart
                      {totalItems > 0 && (
                        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {totalItems}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => setNotifOpen(true)}
                  >
                    <Bell className="h-4 w-4" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex cursor-pointer items-center gap-2">
                      <User className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                    onClick={() => { signOut(); }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {storeEnabled && totalItems > 0 && <CartDrawer />}
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                  <LogIn className="h-4 w-4" /> Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="gap-2 rounded-lg">
                  <UserPlus className="h-4 w-4" /> Register
                </Button>
              </Link>
            </>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="mt-8 flex flex-col gap-2">
              {visibleNavLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-md font-medium text-foreground hover:bg-muted"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {link.label}
                  </Link>
                );
              })}
              <hr className="my-2 border-border" />
              {user ? (
                <>
                  {storeEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setCartOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-md font-medium text-foreground hover:bg-muted"
                    >
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      Shopping Cart
                      {totalItems > 0 && (
                        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          {totalItems}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setNotifOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-md font-medium text-foreground hover:bg-muted"
                  >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    <Button className="w-full gap-2">
                      <User className="h-4 w-4" /> Dashboard
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-muted-foreground hover:text-destructive"
                    onClick={() => { setOpen(false); signOut(); }}
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/register" onClick={() => setOpen(false)}>
                    <Button className="w-full gap-2">
                      <UserPlus className="h-4 w-4" /> Register
                    </Button>
                  </Link>
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full gap-2">
                      <LogIn className="h-4 w-4" /> Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );

  return <CmsRenderer slug="header" fallback={defaultNavbar} className="sticky top-0 z-50" />;
};

export default Navbar;
