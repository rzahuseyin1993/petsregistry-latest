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

const MobileOrders = () => {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, image_url))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <ShoppingBag className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-foreground">My Orders</h1>
          <p className="text-xs text-muted-foreground">{orders.length} orders</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mb-2" />
            <p className="text-sm">No orders yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] font-medium text-muted-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${statusStyles[order.status] || ""}`}>
                      {order.status}
                    </Badge>
                    <span className="font-display text-sm font-bold text-primary">
                      ${Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>

                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 mb-1.5 last:mb-0">
                    {item.products?.image_url && (
                      <img src={item.products.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.products?.name || "Product"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} × ${Number(item.price).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs font-medium">${(item.quantity * Number(item.price)).toFixed(2)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileOrders;
