import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, PawPrint, ShoppingBag, DollarSign, AlertTriangle, TrendingUp, UserPlus,
  Building2, Heart, CheckCircle, Clock, Award, HandHeart, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const directoryCategories: Record<string, string> = {
  pet_shop: "Pet Shop",
  veterinary: "Veterinary",
  grooming: "Grooming",
  boarding: "Boarding",
  training: "Training",
  pet_food: "Pet Food",
  other: "Other",
};

type AdminTransaction = {
  id: string;
  kind: "store" | "certificate" | "donation";
  created_at: string;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_id: string | null;
  customer: string;
  details: string;
};

const statusStyles: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  paid: "bg-success/10 text-success border-success/20",
  processing: "bg-accent/10 text-accent border-accent/20",
  pending: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

const kindStyles: Record<string, string> = {
  store: "bg-blue-100 text-blue-800",
  certificate: "bg-violet-100 text-violet-800",
  donation: "bg-rose-100 text-rose-800",
};

const AdminDashboard = () => {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, pets, orders, lostReports, pendingDir, pendingAdopt, certOrders, donations] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("pets").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, total, status"),
        supabase.from("lost_reports").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("business_listings").select("id", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("pet_adoptions").select("id", { count: "exact", head: true }).eq("admin_approved", false).eq("status", "available"),
        supabase.from("certificate_credit_orders" as any).select("total, status"),
        supabase.from("donations").select("amount, status").eq("status", "completed"),
      ]);

      const storeRevenue = (orders.data || [])
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + Number(o.total), 0);
      const certRevenue = ((certOrders.data || []) as any[])
        .filter((o) => o.status === "paid")
        .reduce((sum, o) => sum + Number(o.total), 0);
      const donationRevenue = (donations.data || []).reduce((sum, d) => sum + Number(d.amount), 0);

      return {
        users: users.count || 0,
        pets: pets.count || 0,
        orders: orders.data?.length || 0,
        revenue: storeRevenue + certRevenue + donationRevenue,
        lostPets: lostReports.count || 0,
        pendingDirectory: pendingDir.count || 0,
        pendingAdoptions: pendingAdopt.count || 0,
      };
    },
  });

  const { data: pendingDirectory = [] } = useQuery({
    queryKey: ["admin-pending-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_listings")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const ownerIds = [...new Set((data || []).map((l) => l.owner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", ownerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((l) => ({
        ...l,
        ownerProfile: profileMap[l.owner_id] || null,
      }));
    },
  });

  const { data: pendingAdoptions = [] } = useQuery({
    queryKey: ["admin-pending-adoptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_adoptions")
        .select("*, pets(id, name, species, breed, pet_code)")
        .eq("admin_approved", false)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      const ownerIds = [...new Set((data || []).map((l) => l.owner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ownerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((l) => ({
        ...l,
        ownerName: profileMap[l.owner_id]?.full_name || profileMap[l.owner_id]?.email || "—",
      }));
    },
  });

  const { data: recentSignups = [] } = useQuery({
    queryKey: ["admin-recent-signups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, country, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: recentTransactions = [] } = useQuery({
    queryKey: ["admin-recent-transactions"],
    queryFn: async () => {
      const [storeRes, certRes, donationRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, status, payment_method, payment_id, created_at, user_id, order_items(quantity, price, products(name))")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("certificate_credit_orders" as any)
          .select("id, total, status, payment_method, payment_id, created_at, user_id, quantity")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("donations")
          .select("id, amount, status, payment_method, payment_id, created_at, donor_name, donor_email, user_id")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const userIds = new Set<string>();
      (storeRes.data || []).forEach((o) => userIds.add(o.user_id));
      ((certRes.data || []) as any[]).forEach((o) => userIds.add(o.user_id));
      (donationRes.data || []).forEach((d) => { if (d.user_id) userIds.add(d.user_id); });

      const { data: profiles } = userIds.size
        ? await supabase.from("profiles").select("user_id, email, full_name").in("user_id", [...userIds])
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

      const rows: AdminTransaction[] = [];

      (storeRes.data || []).forEach((o) => {
        const items = (o.order_items || []) as any[];
        const itemSummary = items.length
          ? items.map((i) => `${i.products?.name || "Item"} ×${i.quantity}`).join(", ")
          : "Store order";
        rows.push({
          id: o.id,
          kind: "store",
          created_at: o.created_at,
          amount: Number(o.total),
          status: o.status,
          payment_method: o.payment_method,
          payment_id: o.payment_id,
          customer: profileMap[o.user_id]?.full_name || profileMap[o.user_id]?.email || "—",
          details: itemSummary,
        });
      });

      ((certRes.data || []) as any[]).forEach((o) => {
        rows.push({
          id: o.id,
          kind: "certificate",
          created_at: o.created_at,
          amount: Number(o.total),
          status: o.status === "paid" ? "completed" : o.status,
          payment_method: o.payment_method,
          payment_id: o.payment_id,
          customer: profileMap[o.user_id]?.full_name || profileMap[o.user_id]?.email || "—",
          details: `${o.quantity} certificate credit${o.quantity === 1 ? "" : "s"}`,
        });
      });

      (donationRes.data || []).forEach((d) => {
        rows.push({
          id: d.id,
          kind: "donation",
          created_at: d.created_at,
          amount: Number(d.amount),
          status: d.status,
          payment_method: d.payment_method,
          payment_id: d.payment_id,
          customer: d.donor_name || d.donor_email || (d.user_id ? profileMap[d.user_id]?.email : null) || "Guest",
          details: "Donation",
        });
      });

      return rows
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12);
    },
  });

  const approveDirectory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_listings").update({ is_approved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-business-listings"] });
      toast.success("Directory listing approved");
    },
    onError: () => toast.error("Failed to approve listing"),
  });

  const approveAdoption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pet_adoptions").update({ admin_approved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-adoptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-adoptions"] });
      toast.success("Adoption listing approved");
    },
    onError: () => toast.error("Failed to approve adoption"),
  });

  const statCards = [
    { label: "Total Members", value: stats?.users ?? "…", icon: Users, color: "text-primary", link: "/admin/users" },
    { label: "Registered Pets", value: stats?.pets ?? "…", icon: PawPrint, color: "text-primary", link: "/admin/pets" },
    { label: "Pending Directory", value: stats?.pendingDirectory ?? "…", icon: Building2, color: "text-orange-500", link: "/admin/directory", highlight: (stats?.pendingDirectory || 0) > 0 },
    { label: "Pending Adoptions", value: stats?.pendingAdoptions ?? "…", icon: Heart, color: "text-rose-500", link: "/admin/adoptions", highlight: (stats?.pendingAdoptions || 0) > 0 },
    { label: "Store Orders", value: stats?.orders ?? "…", icon: ShoppingBag, color: "text-accent", link: "/admin/orders" },
    { label: "Total Revenue", value: stats ? `$${stats.revenue.toFixed(2)}` : "…", icon: DollarSign, color: "text-success", link: "/admin/orders" },
    { label: "Active Lost Reports", value: stats?.lostPets ?? "…", icon: AlertTriangle, color: "text-amber-500", link: "/admin/lost-reports" },
  ];

  const pendingTotal = (stats?.pendingDirectory || 0) + (stats?.pendingAdoptions || 0);

  return (
    <main className="flex-1 bg-background p-6 md:p-8">
      <h1 className="font-display text-2xl font-bold text-foreground">Admin Overview</h1>
      <p className="text-sm text-muted-foreground">Approvals, transactions, and system activity at a glance</p>

      {pendingTotal > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            <strong>{pendingTotal}</strong> item{pendingTotal === 1 ? "" : "s"} need your review
            {(stats?.pendingDirectory || 0) > 0 && ` · ${stats!.pendingDirectory} directory listing${stats!.pendingDirectory === 1 ? "" : "s"}`}
            {(stats?.pendingAdoptions || 0) > 0 && ` · ${stats!.pendingAdoptions} adoption listing${stats!.pendingAdoptions === 1 ? "" : "s"}`}
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link to={stat.link} key={stat.label}>
              <Card className={`transition-shadow hover:shadow-md ${stat.highlight ? "border-amber-300 ring-1 ring-amber-200" : ""}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pending Directory */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-orange-500" />
            Directory Submissions Awaiting Approval
            {(stats?.pendingDirectory || 0) > 0 && (
              <Badge variant="destructive">{stats!.pendingDirectory}</Badge>
            )}
          </CardTitle>
          <Link to="/admin/directory" className="text-xs font-medium text-primary hover:underline">Manage all</Link>
        </CardHeader>
        <CardContent className="p-0">
          {pendingDirectory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No pending directory listings</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDirectory.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <p className="font-medium">{l.name}</p>
                      {l.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">{l.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{directoryCategories[l.category] || l.category}</TableCell>
                    <TableCell className="text-xs">
                      {[l.address, l.city, l.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{l.phone || l.whatsapp || "—"}</div>
                      <div className="text-muted-foreground">{l.email || "—"}</div>
                      {l.website && (
                        <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{l.ownerProfile?.full_name || "—"}</div>
                      <div className="text-muted-foreground">{l.ownerProfile?.email}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="gap-1 h-8"
                        disabled={approveDirectory.isPending}
                        onClick={() => approveDirectory.mutate(l.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Adoptions */}
      {pendingAdoptions.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-rose-500" />
              Adoption Listings Awaiting Approval
              <Badge variant="destructive">{pendingAdoptions.length}</Badge>
            </CardTitle>
            <Link to="/admin/adoptions" className="text-xs font-medium text-primary hover:underline">Manage all</Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdoptions.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-sm">
                      {l.pets?.name || "—"}
                      <span className="block text-xs text-muted-foreground">{l.pets?.species} · {l.pets?.breed || "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs">{l.ownerName}</TableCell>
                    <TableCell className="text-xs">
                      {l.adoption_fee > 0 ? `$${l.adoption_fee}` : "Free"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{l.description || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="gap-1 h-8"
                        disabled={approveAdoption.isPending}
                        onClick={() => approveAdoption.mutate(l.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Transactions
          </CardTitle>
          <div className="flex gap-3 text-xs">
            <Link to="/admin/orders" className="font-medium text-primary hover:underline">Orders</Link>
            <Link to="/admin/donations" className="font-medium text-primary hover:underline">Donations</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No transactions yet</TableCell>
                </TableRow>
              ) : recentTransactions.map((tx) => (
                <TableRow key={`${tx.kind}-${tx.id}`}>
                  <TableCell>
                    <Badge className={`text-[10px] ${kindStyles[tx.kind]}`}>
                      {tx.kind === "store" && <ShoppingBag className="h-3 w-3 mr-1 inline" />}
                      {tx.kind === "certificate" && <Award className="h-3 w-3 mr-1 inline" />}
                      {tx.kind === "donation" && <HandHeart className="h-3 w-3 mr-1 inline" />}
                      {tx.kind.charAt(0).toUpperCase() + tx.kind.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{tx.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{tx.customer}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{tx.details}</TableCell>
                  <TableCell className="font-medium">${tx.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">
                    <div>{tx.payment_method || "—"}</div>
                    {tx.payment_id && (
                      <div className="text-muted-foreground font-mono truncate max-w-[100px]" title={tx.payment_id}>
                        {tx.payment_id.slice(0, 12)}…
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[tx.status] || ""}>{tx.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-primary" />
              Recent Signups
            </CardTitle>
            <Link to="/admin/users" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSignups.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell>{u.country || "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {[
              { to: "/admin/directory", label: "Directory", icon: Building2 },
              { to: "/admin/adoptions", label: "Adoptions", icon: Heart },
              { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
              { to: "/admin/certificates", label: "Certificates", icon: Award },
              { to: "/admin/donations", label: "Donations", icon: HandHeart },
              { to: "/admin/memberships", label: "Memberships", icon: Users },
              { to: "/admin/lost-reports", label: "Lost Reports", icon: AlertTriangle },
              { to: "/admin/contacts", label: "Inbox", icon: UserPlus },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminDashboard;
