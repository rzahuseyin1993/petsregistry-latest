import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Search, ShoppingCart, User, LogIn, Shield, Sparkles, Heart, AlertTriangle, Building2, Smartphone, HandHeart, ShieldCheck, Tag } from "lucide-react";
import logo from "@/assets/logo.png";
import NotificationBell from "@/components/NotificationBell";
import MembershipBadge from "@/components/MembershipBadge";
import CartDrawer from "@/components/CartDrawer";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CmsRenderer from "@/components/CmsRenderer";
import { useIsMobileRoute } from "@/hooks/useIsMobileRoute";

const navLinks = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/adopt", label: "Adopt", icon: Heart },
  { to: "/store", label: "Store", icon: ShoppingCart },
  { to: "/pet-expert", label: "AI Expert", icon: Sparkles },
  { to: "/lost-pets", label: "Lost Pets", icon: AlertTriangle },
  { to: "/directory", label: "Directory", icon: Building2 },
  { to: "/fees", label: "Fees", icon: Tag },
  { to: "/donate", label: "Donate", icon: HandHeart },
  { to: "/verify", label: "Verify", icon: ShieldCheck },
];

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, isAdmin, membership } = useAuth();
  const isMobileRoute = useIsMobileRoute();

  if (isMobileRoute) return null;

  const defaultNavbar = (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Pets Registry" className="h-10 w-auto" width={147} height={40} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/m" title="Switch to Mobile View">
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Switch to mobile view">
              <Smartphone className="h-4 w-4" />
            </Button>
          </Link>
          <CartDrawer />
          <NotificationBell />
          {/* Admin link hidden from navbar for security — admins are auto-redirected on login */}
          {user ? (
            <div className="flex items-center gap-2">
              {membership && <MembershipBadge planType={membership.planType} size="sm" showLabel={false} />}
              <Link to="/dashboard">
                <Button size="sm" className="gap-2 rounded-lg">
                  <User className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" className="gap-2 rounded-lg">
                <LogIn className="h-4 w-4" /> Sign In
              </Button>
            </Link>
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
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {link.label}
                  </Link>
                );
              })}
              <hr className="my-2 border-border" />
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    <Button className="w-full gap-2"><User className="h-4 w-4" /> Dashboard</Button>
                  </Link>
                   {/* Admin link hidden from mobile nav for security */}
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)}>
                  <Button className="w-full gap-2"><LogIn className="h-4 w-4" /> Sign In</Button>
                </Link>
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
