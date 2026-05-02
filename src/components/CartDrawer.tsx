import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CartDrawer = () => {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to checkout");
      setOpen(false);
      navigate("/login");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setProcessing(true);
    try {
      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({ user_id: user.id, total: totalPrice, status: "pending", payment_method: "pending" })
        .select("id")
        .single();

      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Deduct stock for each product
      for (const item of items) {
        await supabase.rpc("deduct_stock" as any, { _product_id: item.id, _quantity: item.quantity });
      }

      // Send order confirmation to member inbox
      const orderShortId = order.id.slice(0, 8).toUpperCase();
      const itemsList = items.map(i => `<li>${i.name} × ${i.quantity} — $${(i.price * i.quantity).toFixed(2)}</li>`).join("");
      await supabase.from("admin_messages").insert({
        sender_id: user.id,
        recipient_id: user.id,
        subject: `Order Confirmation — #${orderShortId}`,
        message: `<p>Thank you for your order!</p><p><strong>Order ID:</strong> #${orderShortId}</p><p><strong>Items:</strong></p><ul>${itemsList}</ul><p><strong>Total:</strong> $${totalPrice.toFixed(2)}</p><p><strong>Status:</strong> Pending</p><p>We'll notify you when your order status changes.</p><p>Best regards,<br/>Pet Palace Team</p>`,
        is_html: true,
      });

      clearCart();
      setOpen(false);
      toast.success("Order placed successfully! Order ID: " + orderShortId);
      navigate("/dashboard/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Shopping cart">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Shopping Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBag className="h-12 w-12" />
            <p className="text-sm">Your cart is empty</p>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); navigate("/store"); }}>
              Browse Store
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 mt-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-sm font-bold text-primary">${item.price.toFixed(2)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        disabled={item.quantity >= item.stock}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                <span className="text-lg font-bold text-foreground">${totalPrice.toFixed(2)}</span>
              </div>
              <Button className="w-full gap-2" disabled={processing} onClick={handleCheckout}>
                {processing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                {processing ? "Processing..." : "Place Order"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={clearCart}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear Cart
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
