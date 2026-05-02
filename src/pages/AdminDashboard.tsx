import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, PawPrint, ShoppingBag, DollarSign, AlertTriangle, TrendingUp, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, pets, orders, lostReports] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("pets").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, total", { count: "exact" }),
        supabase.from("lost_reports").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      const revenue = (orders.data || []).reduce((sum, o) => sum + Number(o.total), 0);
      return {
        users: users.count || 0,
        pets: pets.count || 0,
        orders: orders.count || 0,
        revenue,
        lostPets: lostReports.count || 0,
      };
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

  const { data: recentOrders = [] } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, payment_method, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      const userIds = [...new Set(data.map((o) => o.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email").in("user_id", userIds);
      const emailMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.email]));
      return data.map((o) => ({ ...o, email: emailMap[o.user_id] || "—" }));
    },
  });

  const statCards = [
    { label: "Total Members", value: stats?.users ?? "...", icon: Users, color: "text-primary", link: "/admin/users" },
    { label: "Registered Pets", value: stats?.pets ?? "...", icon: PawPrint, color: "text-primary", link: "/admin/pets" },
    { label: "Store Orders", value: stats?.orders ?? "...", icon: ShoppingBag, color: "text-accent", link: "/admin/orders" },
    { label: "Revenue", value: stats ? `$${stats.revenue.toFixed(2)}` : "...", icon: DollarSign, color: "text-success", link: "/admin/orders" },
    { label: "Active Lost Reports", value: stats?.lostPets ?? "...", icon: AlertTriangle, color: "text-amber-500", link: "/admin/pets" },
  ];

  const orderStatusStyles: Record<string, string> = {
    completed: "bg-success/10 text-success border-success/20",
    processing: "bg-accent/10 text-accent border-accent/20",
    pending: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">System statistics and management</p>

        {/* Stat Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link to={stat.link} key={stat.label}>
                <Card className="transition-shadow hover:shadow-md">
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Recent Signups */}
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

          {/* Recent Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Recent Orders
              </CardTitle>
              <Link to="/admin/orders" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No orders yet</TableCell></TableRow>
                  ) : recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell className="text-xs">{o.email}</TableCell>
                      <TableCell>${Number(o.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={orderStatusStyles[o.status] || ""}>{o.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
