import { useState, useRef } from "react";
import PermissionGate from "@/components/PermissionGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadRaw, removeFile } from "@/lib/imageUpload";
import MembershipBadge from "@/components/MembershipBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Pencil, Crown, Users, UserPlus, ShieldCheck, Download, Upload, ImageIcon, X } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const AdminMemberships = () => {
  const queryClient = useQueryClient();
  const [editPlan, setEditPlan] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", price: "5", monthly_price: "0", duration_days: "365" });
  const [grantDialog, setGrantDialog] = useState(false);
  const [grantForm, setGrantForm] = useState({ userId: "", planId: "", durationDays: "365" });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membership_plans").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*, membership_plans(name, plan_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-for-memberships"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return data || [];
    },
  });

  const getProfileName = (userId: string) => {
    const p = profiles.find((p: any) => p.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const getProfileLabel = (p: any) => `${p.full_name || "No name"} (${p.email})`;

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("membership_plans").update({
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        monthly_price: Number(editForm.monthly_price),
        duration_days: Number(editForm.duration_days),
      }).eq("id", editPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] });
      setEditPlan(null);
      toast({ title: "Plan updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update plan", description: e.message, variant: "destructive" }),
  });

  const togglePlanMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("membership_plans").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] }),
    onError: (e: any) => toast({ title: "Failed to toggle plan", description: e.message, variant: "destructive" }),
  });

  const updateMembershipStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("memberships").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
      toast({ title: "Membership status updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const extendMembershipMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const membership = memberships.find((m: any) => m.id === id);
      if (!membership) throw new Error("Membership not found");
      const currentExpiry = new Date(membership.expires_at);
      const newExpiry = new Date(currentExpiry.getTime() + days * 86400000);
      const { error } = await supabase.from("memberships").update({
        expires_at: newExpiry.toISOString(),
        status: "active",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
      toast({ title: "Membership extended" });
    },
    onError: (e: any) => toast({ title: "Failed to extend membership", description: e.message, variant: "destructive" }),
  });

  const grantMembershipMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + Number(grantForm.durationDays) * 86400000);
      const { error } = await supabase.from("memberships").insert({
        user_id: grantForm.userId,
        plan_id: grantForm.planId,
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
      setGrantDialog(false);
      setGrantForm({ userId: "", planId: "", durationDays: "365" });
      toast({ title: "Membership granted successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Membership Management</h1>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans"><Crown className="mr-2 h-4 w-4" />Plans</TabsTrigger>
            <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Members</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan: any) => (
                <Card key={plan.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      {plan.badge_icon_url ? (
                        <img src={plan.badge_icon_url} alt={plan.name} className="h-8 w-8 rounded-full object-cover border border-border" />
                      ) : (
                        <MembershipBadge planType={plan.plan_type} showLabel={false} size="lg" />
                      )}
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={plan.is_active} onCheckedChange={(v) => togglePlanMutation.mutate({ id: plan.id, is_active: v })} />
                      <Button variant="outline" size="icon" onClick={() => {
                        setEditPlan(plan);
                        setEditForm({ name: plan.name, description: plan.description || "", price: String(plan.price), monthly_price: String(plan.monthly_price || 0), duration_days: String(plan.duration_days) });
                      }}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">${plan.price}<span className="text-sm font-normal text-muted-foreground">/yr</span> · ${plan.monthly_price || (plan.price / 12).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline">{plan.plan_type}</Badge>
                      <BadgeIconUploader planId={plan.id} currentUrl={plan.badge_icon_url} onUploaded={() => queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] })} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Dialog open={!!editPlan} onOpenChange={(o) => { if (!o) setEditPlan(null); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Plan</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); updatePlanMutation.mutate(); }} className="space-y-4">
                  <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Yearly Price ($)</Label><Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></div>
                    <div><Label>Monthly Price ($)</Label><Input type="number" step="0.01" value={editForm.monthly_price} onChange={(e) => setEditForm({ ...editForm, monthly_price: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">0 = auto-calculate</p></div>
                    <div><Label>Duration (days)</Label><Input type="number" value={editForm.duration_days} onChange={(e) => setEditForm({ ...editForm, duration_days: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={updatePlanMutation.isPending}>Save Changes</Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input placeholder="Search by member name, email, plan…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
              <div className="flex-1" />
            
              <Button variant="outline" className="gap-2" onClick={() => exportToCsv("memberships", memberships.map((m: any) => ({
                member: getProfileName(m.user_id),
                email: (() => { const p = profiles.find((p: any) => p.user_id === m.user_id); return p?.email || ""; })(),
                plan: (m as any).membership_plans?.name || "",
                type: (m as any).membership_plans?.plan_type || "", status: m.status,
                billing_interval: m.billing_interval || "",
                starts: new Date(m.starts_at).toLocaleDateString(),
                expires: new Date(m.expires_at).toLocaleDateString(),
                is_active: m.status === "active" && new Date(m.expires_at) > new Date() ? "Yes" : "No",
                payment_id: m.payment_id || "",
                stripe_customer_id: m.stripe_customer_id || "",
                stripe_subscription_id: m.stripe_subscription_id || "",
              })), [
                { key: "member", label: "Member" }, { key: "email", label: "Email" },
                { key: "plan", label: "Plan" },
                { key: "type", label: "Type" }, { key: "status", label: "Status" },
                { key: "billing_interval", label: "Billing Interval" },
                { key: "starts", label: "Start Date" }, { key: "expires", label: "Expiry Date" },
                { key: "is_active", label: "Currently Active" },
                { key: "payment_id", label: "Payment ID" },
                { key: "stripe_customer_id", label: "Stripe Customer ID" },
                { key: "stripe_subscription_id", label: "Stripe Subscription ID" },
              ])}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button className="gap-2" onClick={() => setGrantDialog(true)}>
                <UserPlus className="h-4 w-4" /> Grant Membership
              </Button>
            </div>

            <div className="space-y-3">
              {memberships.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">No memberships yet</p>
              ) : (() => {
                const q = searchTerm.toLowerCase();
                const filtered = memberships.filter((m: any) => {
                  if (!q) return true;
                  const name = getProfileName(m.user_id).toLowerCase();
                  const plan = ((m as any).membership_plans?.name || "").toLowerCase();
                  const type = ((m as any).membership_plans?.plan_type || "").toLowerCase();
                  return name.includes(q) || plan.includes(q) || type.includes(q) || m.status.toLowerCase().includes(q);
                });
                return filtered.length === 0 ? <p className="py-10 text-center text-muted-foreground">No results for "{searchTerm}"</p> : filtered.map((m: any) => {
                const isActive = m.status === "active" && new Date(m.expires_at) > new Date();
                return (
                  <Card key={m.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex-1">
                        <p className="font-semibold">{getProfileName(m.user_id)}</p>
                        <p className="text-sm text-muted-foreground">
                          {(m as any).membership_plans?.name} • Expires {new Date(m.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {isActive ? "Active" : m.status === "cancelled" ? "Cancelled" : "Expired"}
                        </Badge>
                        <Select
                          value={m.status}
                          onValueChange={(v) => updateMembershipStatusMutation.mutate({ id: m.id, status: v })}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                            <SelectItem value="expired">Expire</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => extendMembershipMutation.mutate({ id: m.id, days: 365 })}
                        >
                          +1 Year
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              });
              })()}
            </div>

            {/* Grant Membership Dialog */}
            <Dialog open={grantDialog} onOpenChange={setGrantDialog}>
              <DialogContent>
                <DialogHeader><DialogTitle>Grant Membership to User</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); grantMembershipMutation.mutate(); }} className="space-y-4">
                  <div>
                    <Label>User</Label>
                    <Select value={grantForm.userId} onValueChange={(v) => setGrantForm({ ...grantForm, userId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{getProfileLabel(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={grantForm.planId} onValueChange={(v) => setGrantForm({ ...grantForm, planId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration (days)</Label>
                    <Input type="number" value={grantForm.durationDays} onChange={(e) => setGrantForm({ ...grantForm, durationDays: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={grantMembershipMutation.isPending || !grantForm.userId || !grantForm.planId}>
                    <ShieldCheck className="h-4 w-4" />
                    {grantMembershipMutation.isPending ? "Granting..." : "Grant Membership"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>
  );
};

// Badge icon upload sub-component
const BadgeIconUploader = ({ planId, currentUrl, onUploaded }: { planId: string; currentUrl: string | null; onUploaded: () => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Please upload an image file", variant: "destructive" }); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${planId}.${ext}`;
    await removeFile("membership-badges", [path]);
    try {
      const url = await uploadRaw({ bucket: "membership-badges", path, body: file, upsert: true });
      const publicUrl = url + "?v=" + Date.now();
      await supabase.from("membership_plans").update({ badge_icon_url: publicUrl }).eq("id", planId);
      toast({ title: "Badge icon updated!" });
      onUploaded();
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await supabase.from("membership_plans").update({ badge_icon_url: null }).eq("id", planId);
    toast({ title: "Badge icon removed, using default" });
    onUploaded();
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : currentUrl ? "Change Icon" : "Upload Icon"}
      </Button>
      {currentUrl && (
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive" onClick={handleRemove}>
          <X className="h-3 w-3" /> Remove
        </Button>
      )}
    </div>
  );
};

export default AdminMemberships;
