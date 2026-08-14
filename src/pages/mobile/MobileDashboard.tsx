import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle, PawPrint, Mail, Heart, AlertTriangle,
  Building2, Crown, Settings, LogOut, Activity, ShoppingBag,
  FileText, Award, MapPin, Pencil, HeartHandshake, HandHeart
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import CompleteProfilePrompt from "@/components/CompleteProfilePrompt";

const menuItems = [
  { to: "/m/dashboard/orders", label: "My Orders", icon: ShoppingBag, color: "text-primary" },
  { to: "/m/dashboard/inbox", label: "Inbox", icon: Mail, color: "text-blue-500" },
  { to: "/m/dashboard/health", label: "Pet Health", icon: Activity, color: "text-pink-500" },
  { to: "/m/dashboard/adoption", label: "Adoption", icon: Heart, color: "text-rose-500" },
  { to: "/m/dashboard/lost-reports", label: "Lost Reports", icon: AlertTriangle, color: "text-amber-500" },
  { to: "/m/report-lost", label: "Report Lost / Found Pet", icon: HeartHandshake, color: "text-rose-500" },
  { to: "/m/dashboard/flyer-builder", label: "Flyer Builder", icon: FileText, color: "text-violet-500" },
  { to: "/m/dashboard/certificates", label: "Pet Certificates", icon: Award, color: "text-emerald-500" },
  { to: "/m/dashboard/directory", label: "My Listings", icon: Building2, color: "text-orange-500" },
  { to: "/m/pet-map", label: "Pet Map", icon: MapPin, color: "text-teal-500" },
  { to: "/m/dashboard/membership", label: "Membership", icon: Crown, color: "text-yellow-500" },
  { to: "/m/dashboard/donate", label: "Donate", icon: HandHeart, color: "text-pink-500" },
  { to: "/m/dashboard/settings", label: "Settings", icon: Settings, color: "text-muted-foreground" },
];

const MobileDashboard = () => {
  const { user, signOut } = useAuth();

  const { data: pets = [] } = useQuery({
    queryKey: ["mobile-my-pets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("*, pet_images(image_url, sort_order)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["mobile-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("admin_messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 py-20 text-center">
        <PawPrint className="h-16 w-16 text-primary/30 mb-4" />
        <h2 className="font-display text-lg font-bold">Sign In Required</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your pets</p>
        <div className="mt-4 flex gap-2">
          <Link to="/m/login"><Button size="sm">Sign In</Button></Link>
          <Link to="/m/register"><Button size="sm" variant="outline">Register</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <CompleteProfilePrompt />
      {/* My Pets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-foreground">My Pets</h2>
          <Link to="/m/dashboard/register-pet">
            <Button size="sm" className="h-8 gap-1 rounded-lg text-xs">
              <PlusCircle className="h-3.5 w-3.5" /> Add Pet
            </Button>
          </Link>
        </div>

        {pets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <PawPrint className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No pets registered yet</p>
              <Link to="/m/dashboard/register-pet">
                <Button size="sm" className="mt-3 gap-1 text-xs">
                  <PlusCircle className="h-3 w-3" /> Register Your First Pet
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {pets.map((pet: any) => {
              const img = pet.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
              return (
                <div key={pet.id} className="shrink-0 w-32 space-y-1.5">
                  <Link to={`/m/pet/${pet.id}`}>
                    <Card className="overflow-hidden">
                      <div className="aspect-square bg-muted">
                        <img src={img?.image_url || "/placeholder.svg"} alt={pet.name} className="h-full w-full object-cover" />
                      </div>
                      <CardContent className="p-2">
                        <p className="truncate text-xs font-semibold">{pet.name}</p>
                        <Badge
                          variant={pet.status === "lost" ? "destructive" : "secondary"}
                          className="mt-0.5 text-[9px]"
                        >
                          {pet.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                  <Link to={`/m/dashboard/pets/${pet.id}/edit`}>
                    <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-[10px]">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}>
              <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted">
                <Icon className={`h-5 w-5 ${item.color}`} />
                <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                {item.label === "Inbox" && unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Push Notifications */}
      <div className="px-3">
        <PushNotificationToggle />
      </div>

      <Button variant="ghost" className="w-full gap-2 text-sm text-muted-foreground" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
};

export default MobileDashboard;
