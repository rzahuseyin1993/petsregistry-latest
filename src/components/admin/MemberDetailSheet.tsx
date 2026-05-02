import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Save, X, Crown, Shield, ShoppingBag, Store, CreditCard, PawPrint } from "lucide-react";
import { useState, useEffect } from "react";

interface MemberDetailSheetProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MemberDetailSheet = ({ user, open, onOpenChange }: MemberDetailSheetProps) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        country: user.country || "",
        
      });
      setEditing(false);
    }
  }, [user]);

  const { data: membership } = useQuery({
    queryKey: ["admin-member-membership", user?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, membership_plans(name, plan_type, price)")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.user_id && open,
  });

  const { data: directories } = useQuery({
    queryKey: ["admin-member-directories", user?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_listings")
        .select("id, name, category, is_approved, is_paid, created_at")
        .eq("owner_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.user_id && open,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-member-orders", user?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, payment_method")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.user_id && open,
  });

  const { data: donations } = useQuery({
    queryKey: ["admin-member-donations", user?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("donations")
        .select("id, amount, status, created_at, payment_method")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.user_id && open,
  });

  const { data: pets } = useQuery({
    queryKey: ["admin-member-pets", user?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, pet_code, status, microchip_number, created_at")
        .eq("owner_id", user.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.user_id && open,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          country: form.country,
          
        })
        .eq("user_id", user.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
      toast.success("Member profile updated");
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user) return null;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-success/10 text-success border-success/20",
      completed: "bg-success/10 text-success border-success/20",
      pending: "bg-muted text-muted-foreground border-border",
      processing: "bg-accent/10 text-accent border-accent/20",
      shipped: "bg-primary/10 text-primary border-primary/20",
      cancelled: "bg-destructive/10 text-destructive border-destructive/20",
      expired: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return map[status] || "bg-muted text-muted-foreground border-border";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Member Details</span>
            {!editing ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setForm({ full_name: user.full_name || "", email: user.email || "", phone: user.phone || "", address: user.address || "", city: user.city || "", country: user.country || "" }); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Info */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Profile Information</h3>
            {editing ? (
              <div className="grid gap-3">
                {([ 
                  { key: "full_name", label: "Full Name" },
                  { key: "phone", label: "Phone" },
                  { key: "address", label: "Address" },
                  { key: "city", label: "City" },
                  { key: "country", label: "Country" },
                  
                ] as const).map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <DetailRow label="Full Name" value={user.full_name} />
                <DetailRow label="Email" value={user.email} />
                <DetailRow label="Phone" value={user.phone} />
                <DetailRow label="Address" value={user.address} />
                <DetailRow label="City" value={user.city} />
                <DetailRow label="Country" value={user.country} />
                
                <DetailRow label="Show Name" value={user.show_name ? "Yes" : "No"} />
                <DetailRow label="Show Phone" value={user.show_phone ? "Yes" : "No"} />
                <DetailRow label="Joined" value={new Date(user.created_at).toLocaleString()} />
                <DetailRow label="User ID" value={user.user_id} mono />
              </div>
            )}
          </section>

          <Separator />

          {/* Pets */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <PawPrint className="h-4 w-4 text-primary" /> Registered Pets ({pets?.length || 0})
            </h3>
            {pets && pets.length > 0 ? (
              <div className="space-y-2">
                {pets.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadge(p.status === "registered" ? "active" : p.status)}`}>{p.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{p.species}{p.breed ? ` · ${p.breed}` : ""}</span>
                      {p.pet_code && <span className="font-mono">{p.pet_code}</span>}
                      {p.microchip_number && <span>Chip: {p.microchip_number}</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Registered: {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No pets registered</p>
            )}
          </section>

          <Separator />
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Crown className="h-4 w-4 text-primary" /> Memberships
            </h3>
            {membership && membership.length > 0 ? (
              <div className="space-y-2">
                {membership.map((m: any) => (
                  <div key={m.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.membership_plans?.name || "Plan"}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadge(m.status)}`}>{m.status}</Badge>
                    </div>
                    <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                      <span>Type: {m.membership_plans?.plan_type}</span>
                      <span>Price: ${Number(m.membership_plans?.price || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(m.starts_at).toLocaleDateString()} — {new Date(m.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No memberships found</p>
            )}
          </section>

          <Separator />

          {/* Directory Listings */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Store className="h-4 w-4 text-primary" /> Directory Listings
            </h3>
            {directories && directories.length > 0 ? (
              <div className="space-y-2">
                {directories.map((d: any) => (
                  <div key={d.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.name}</span>
                      <div className="flex gap-1">
                        <Badge variant="outline" className={`text-[10px] ${d.is_approved ? statusBadge("active") : statusBadge("pending")}`}>
                          {d.is_approved ? "Approved" : "Pending"}
                        </Badge>
                        {d.is_paid && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Paid</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Category: {d.category} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No directory listings</p>
            )}
          </section>

          <Separator />

          {/* Orders */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary" /> Orders ({orders?.length || 0})
            </h3>
            {orders && orders.length > 0 ? (
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <p className="font-mono text-[10px] font-medium">#{o.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}{o.payment_method ? ` · ${o.payment_method}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusBadge(o.status)}`}>{o.status}</Badge>
                      <span className="text-sm font-semibold text-primary">${Number(o.total).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No orders</p>
            )}
          </section>

          <Separator />

          {/* Donations */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CreditCard className="h-4 w-4 text-primary" /> Donations ({donations?.length || 0})
            </h3>
            {donations && donations.length > 0 ? (
              <div className="space-y-2">
                {donations.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}{d.payment_method ? ` · ${d.payment_method}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusBadge(d.status)}`}>{d.status}</Badge>
                      <span className="text-sm font-semibold text-primary">${Number(d.amount).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No donations</p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const DetailRow = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
  <div className="border-b border-border pb-2">
    <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    <p className={`mt-0.5 text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
  </div>
);

export default MemberDetailSheet;
