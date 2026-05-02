import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PawPrint, Users, ShoppingBag, Settings, LayoutDashboard, LogOut, CreditCard, Layout, Heart, AlertTriangle, FileText, Building2, Crown, Mail, HandHeart, Shield, Send, Award, MapPin, Search, BookOpen, Receipt, ShieldAlert } from "lucide-react";
import logo from "@/assets/logo.png";
import { usePermissions, Resource } from "@/hooks/usePermissions";

const adminLinks: Array<{ to: string; label: string; icon: any; resource: Resource }> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, resource: "dashboard" },
  { to: "/admin/users", label: "Users & Roles", icon: Users, resource: "members" },
  { to: "/admin/pets", label: "All Pets", icon: PawPrint, resource: "pets" },
  { to: "/admin/products", label: "Products", icon: ShoppingBag, resource: "products" },
  { to: "/admin/orders", label: "Store Orders", icon: ShoppingBag, resource: "orders" },
  { to: "/admin/adoptions", label: "Adoptions", icon: Heart, resource: "pets" },
  { to: "/admin/lost-reports", label: "Lost Reports", icon: AlertTriangle, resource: "lost_reports" },
  { to: "/admin/flyer-templates", label: "Flyer Templates", icon: FileText, resource: "flyer_templates" },
  { to: "/admin/certificates", label: "Pet Certificates", icon: Award, resource: "certificates" },
  { to: "/admin/directory", label: "Directory", icon: Building2, resource: "directory" },
  { to: "/admin/map-settings", label: "Pet Map", icon: MapPin, resource: "settings" },
  { to: "/admin/memberships", label: "Memberships", icon: Crown, resource: "memberships" },
  { to: "/admin/contacts", label: "Inbox & Messages", icon: Mail, resource: "contacts" },
  { to: "/admin/donations", label: "Donations", icon: HandHeart, resource: "donations" },
  { to: "/admin/payments", label: "Payment Settings", icon: CreditCard, resource: "payments" },
  { to: "/admin/service-subscriptions", label: "Service Subscriptions", icon: Receipt, resource: "payments" },
  { to: "/admin/page-builder", label: "Page Builder", icon: Layout, resource: "page_builder" },
  { to: "/admin/permissions", label: "Permissions", icon: Shield, resource: "permissions" },
  { to: "/admin/moderation", label: "AI Moderation", icon: ShieldAlert, resource: "permissions" },
  { to: "/admin/blog", label: "Resources / Blog", icon: BookOpen, resource: "blog" },
  { to: "/admin/seo", label: "SEO & Tracking", icon: Search, resource: "seo" },
  { to: "/admin/settings", label: "Settings", icon: Settings, resource: "settings" },
];

const AdminSidebar = () => {
  const location = useLocation();
  const { canView, isLoading } = usePermissions();

  const visibleLinks = adminLinks.filter((link) => canView(link.resource));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-4">
        <img src={logo} alt="Pets Registry" className="h-8 w-auto" />
      </div>
      <nav className="flex-1 space-y-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          visibleLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })
        )}
      </nav>
      <div className="border-t border-border p-4">
        <Link to="/">
          <Button variant="ghost" className="w-full gap-2 text-sm text-muted-foreground">
            <LogOut className="h-4 w-4" /> Exit Admin
          </Button>
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;
