import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Package } from "lucide-react";

const statusStyles: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  processing: "bg-accent/10 text-accent border-accent/20",
  shipped: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const DashboardOrders = () => {
  const { user } = useAuth();

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const [storeRes, certRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(*, products(name, image_url))")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("certificate_credit_orders" as any)
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
      ]);
      if (storeRes.error) throw storeRes.error;
      if (certRes.error) throw certRes.error;

      const storeOrders = (storeRes.data || []).map((o: any) => ({ ...o, orderKind: "store" as const }));
      const certOrders = (certRes.data || []).map((o: any) => ({
        id: o.id,
        created_at: o.created_at,
        total: o.total,
        status: o.status === "paid" ? "completed" : o.status,
        payment_method: o.payment_method,
        orderKind: "certificate" as const,
        order_items: [{
          id: o.id,
          quantity: o.quantity,
          price: o.unit_price,
          products: { name: `${o.quantity} Certificate Credit${o.quantity === 1 ? "" : "s"}` },
        }],
      }));

      return [...storeOrders, ...certOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user,
  });

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">My Orders</h1>
            <p className="text-sm text-muted-foreground">{orders.length} orders</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Could not load your orders. Please refresh the page.
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-3" />
              <p>No orders yet. Visit the store to start shopping!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Card key={order.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-mono text-xs font-medium text-muted-foreground">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                        {order.orderKind === "certificate" && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Certificate</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()} · {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={statusStyles[order.status] || ""}>
                        {order.status}
                      </Badge>
                      <span className="font-display text-lg font-bold text-primary">
                        ${Number(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {order.order_items && order.order_items.length > 0 && (
                    <div className="space-y-2">
                      {order.order_items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                          {item.products?.image_url && (
                            <img src={item.products.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.products?.name || "Product"}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity} × ${Number(item.price).toFixed(2)}
                            </p>
                          </div>
                          <p className="text-sm font-medium">${(item.quantity * Number(item.price)).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardOrders;
