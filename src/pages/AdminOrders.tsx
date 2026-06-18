import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { exportToCsv } from "@/lib/exportCsv";
import { useAuth } from "@/contexts/AuthContext";

const orderStatusStyles: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  processing: "bg-accent/10 text-accent border-accent/20",
  shipped: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const AdminOrders = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set(data.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .in("user_id", userIds);
      const profileMap: Record<string, any> = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return data.map((o) => ({ ...o, profile: profileMap[o.user_id] || null }));
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, userId, orderShortId }: { orderId: string; status: string; userId: string; orderShortId: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      // Send notification to member inbox
      if (user) {
        const statusMessages: Record<string, string> = {
          pending: "Your order is now pending review.",
          processing: "Great news! Your order is now being processed.",
          shipped: "Your order has been shipped! It's on its way to you.",
          completed: "Your order has been completed. Thank you for your purchase!",
          cancelled: "Your order has been cancelled. If you have questions, please contact us.",
        };
        await supabase.from("admin_messages").insert({
          sender_id: user.id,
          recipient_id: userId,
          subject: `Order #${orderShortId} — Status Update: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `<p>Hello,</p><p>${statusMessages[status] || `Your order status has been updated to <strong>${status}</strong>.`}</p><p>Order ID: <strong>#${orderShortId}</strong></p><p>New Status: <strong>${status.charAt(0).toUpperCase() + status.slice(1)}</strong></p><p>If you have any questions about your order, please don't hesitate to contact us.</p><p>Best regards,<br/>Pet Palace Team</p>`,
          is_html: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order status updated & member notified");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from("order_items")
      .select("*, products(name, image_url)")
      .eq("order_id", orderId);
    return data || [];
  };

  const handleViewOrder = async (order: any) => {
    const items = await fetchOrderItems(order.id);
    setSelectedOrder({ ...order, items });
  };

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Store Orders</h1>
            <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv("orders", orders.map((o: any) => ({
            order_id: o.id.slice(0, 8).toUpperCase(), customer: o.profile?.full_name || "",
            email: o.profile?.email || "", phone: o.profile?.phone || "",
            total: `$${Number(o.total).toFixed(2)}`, payment_method: o.payment_method || "",
            payment_id: o.payment_id || "", status: o.status,
            date: new Date(o.created_at).toLocaleDateString(),
          })), [
            { key: "order_id", label: "Order ID" }, { key: "customer", label: "Customer" },
            { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
            { key: "total", label: "Total" }, { key: "payment_method", label: "Payment Method" },
            { key: "payment_id", label: "Payment ID" }, { key: "status", label: "Status" },
            { key: "date", label: "Date" },
          ])}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        <div className="mt-6 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by order ID, customer, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>
        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.filter((o: any) => {
                  const q = searchTerm.toLowerCase();
                  return !q || o.id.toLowerCase().includes(q) || (o.profile?.full_name || "").toLowerCase().includes(q) || (o.profile?.email || "").toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
                }).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{searchTerm ? "No orders match your search" : "No orders yet"}</TableCell></TableRow>
                ) : orders.filter((o: any) => {
                  const q = searchTerm.toLowerCase();
                  return !q || o.id.toLowerCase().includes(q) || (o.profile?.full_name || "").toLowerCase().includes(q) || (o.profile?.email || "").toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
                }).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs font-medium">{order.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="font-medium">{order.profile?.full_name || "—"}</TableCell>
                    <TableCell className="text-xs">{order.profile?.email || "—"}</TableCell>
                    <TableCell className="font-medium">${Number(order.total).toFixed(2)}</TableCell>
                    <TableCell>{order.payment_method || "—"}</TableCell>
                    <TableCell>
                      <PermissionGate resource="orders" action="edit" fallback={
                        <Badge variant="outline" className={orderStatusStyles[order.status] || ""}>{order.status}</Badge>
                      }>
                        <Select
                          value={order.status}
                          onValueChange={(status) => updateOrderStatus.mutate({ orderId: order.id, status, userId: order.user_id, orderShortId: order.id.slice(0, 8).toUpperCase() })}
                        >
                          <SelectTrigger className="w-[120px]">
                            <Badge variant="outline" className={orderStatusStyles[order.status] || ""}>{order.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </PermissionGate>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleViewOrder(order)}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Order Details</SheetTitle>
                          </SheetHeader>
                          {selectedOrder && (
                            <div className="mt-6 space-y-4">
                              <DetailRow label="Order ID" value={selectedOrder.id} mono />
                              <DetailRow label="Customer" value={selectedOrder.profile?.full_name} />
                              <DetailRow label="Email" value={selectedOrder.profile?.email} />
                              <DetailRow label="Phone" value={selectedOrder.profile?.phone} />
                              <DetailRow label="Total" value={`$${Number(selectedOrder.total).toFixed(2)}`} />
                              <DetailRow label="Payment Method" value={selectedOrder.payment_method} />
                              <DetailRow label="Payment ID" value={selectedOrder.payment_id} mono />
                              <DetailRow label="Status" value={selectedOrder.status} />
                              <DetailRow label="Date" value={new Date(selectedOrder.created_at).toLocaleString()} />

                              {selectedOrder.items && selectedOrder.items.length > 0 && (
                                <div className="pt-4">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Order Items</p>
                                  <div className="space-y-3">
                                    {selectedOrder.items.map((item: any) => (
                                      <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                                        {item.products?.image_url && (
                                          <img src={item.products.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                                        )}
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">{item.products?.name || "Product"}</p>
                                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ${Number(item.price).toFixed(2)}</p>
                                        </div>
                                        <p className="text-sm font-medium">${(item.quantity * Number(item.price)).toFixed(2)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
  );
};

const DetailRow = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
  <div className="border-b border-border pb-3">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className={`mt-1 text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
  </div>
);

export default AdminOrders;
